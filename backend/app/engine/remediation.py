import os
import json
import time
import uuid
import asyncio
import httpx
from typing import Dict, Any, Optional, Tuple, List
from pathlib import Path
from dotenv import load_dotenv

def _ensure_env_loaded():
    backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
    root_env = Path(__file__).resolve().parent.parent.parent.parent / ".env"
    if backend_env.exists():
        load_dotenv(backend_env, override=False)
    if root_env.exists():
        load_dotenv(root_env, override=False)
    load_dotenv(override=False)

# Load .env variables from backend dir or current working dir
_ensure_env_loaded()

from app.db import save_remediation, get_last_real_remediation

OFFLINE_V1_TEMPLATE = """# [Illustrative template, not model output]
# Common pitfall: Authentication-only check (fails to verify tenant resource ownership)

@app.{method_lower}("{path}")
def {func_name}({params_sig}, current_user: User = Depends(get_current_user)):
    # Vulnerable: Only verifies that caller is authenticated, not that they own {resource}
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return execute_export(project_id)
"""

OFFLINE_V2_TEMPLATE = """# [Illustrative template, not model output]
# Reference fix: Resource-level owner verification

@app.{method_lower}("{path}")
def {func_name}({params_sig}, current_user: User = Depends(get_current_user)):
    # 1. Fetch parent resource and verify existence
    project = get_project_or_404(project_id)

    # 2. Enforce Graph-Inferred Owner-Only Authorization Policy
    if project.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to access this resource"
        )

    # 3. Authorized access allowed
    return execute_authorized_export(project)
"""

OFFLINE_UNIT_TEST = """def test_bola_remediation_blocked():
    # Verify unauthorized identity is rejected with HTTP 403 Forbidden
    client = TestClient(app)
    response = client.get(
        "{endpoint_url}",
        headers={{"Authorization": "Bearer " + taaran_token}}
    )
    assert response.status_code == 403
    assert "forbidden" in response.json().get("detail", "").lower()
"""

# Track whether any real generation succeeded during this server session
SESSION_REAL_MODEL_CALL_SUCCEEDED = False
LAST_WORKING_OPENROUTER_MODEL: Optional[str] = "recursive/flint-v1.0:free"

class RemediationEngine:
    """
    Provider-agnostic BOLA remediation engine.
    Provider Order:
      1. OpenRouter (if OPENROUTER_API_KEY is configured)
         - Model from OPENROUTER_MODEL or auto-discovering :free models via GET /api/v1/models
      2. Google Gemini (if GEMINI_API_KEY is configured)
         - Tries gemini-3.8-flash, gemini-3.6-flash, gemini-3.5-flash-lite, etc. in order
      3. SQLite Cached Real Remediation (labeled 'recorded <timestamp>' for offline resilience)
      4. Deterministic Offline Template (labeled 'Offline template (illustrative, not model output)')
    """
    def __init__(self):
        # Reload env in case .env was modified at runtime
        _ensure_env_loaded()
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
        self.openrouter_model = os.environ.get("OPENROUTER_MODEL")
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY")
        self.gemini_model = os.environ.get("GEMINI_MODEL")
        self.last_error: Optional[str] = None
        self.last_provider_used: Optional[str] = None
        self.last_model_used: Optional[str] = None

    async def get_status(self) -> Dict[str, Any]:
        """
        Returns telemetry on configured providers, active keys, and session test status.
        """
        _ensure_env_loaded()
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY")

        active_provider = "None"
        if self.openrouter_api_key:
            active_provider = "OpenRouter"
        elif self.gemini_api_key:
            active_provider = "Gemini"

        return {
            "openrouter_key_present": bool(self.openrouter_api_key),
            "gemini_key_present": bool(self.gemini_api_key),
            "active_provider": active_provider,
            "configured_model": self.openrouter_model if active_provider == "OpenRouter" else self.gemini_model,
            "last_error": self.last_error,
            "status": "active" if active_provider != "None" else "offline_template_only",
            "session_real_model_call_succeeded": SESSION_REAL_MODEL_CALL_SUCCEEDED
        }

    async def test_connection(self) -> Dict[str, Any]:
        """
        Executes a minimal test prompt to verify LLM connectivity.
        """
        global SESSION_REAL_MODEL_CALL_SUCCEEDED
        _ensure_env_loaded()
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY")

        test_prompt = "Say OK in one word."
        start_t = time.time()

        # 1. Try OpenRouter
        if self.openrouter_api_key:
            out, model, err = await self._call_openrouter(test_prompt)
            if out:
                SESSION_REAL_MODEL_CALL_SUCCEEDED = True
                dur = int((time.time() - start_t) * 1000)
                return {
                    "success": True,
                    "provider": "OpenRouter",
                    "model": model,
                    "output": out.strip()[:60],
                    "duration_ms": dur
                }
            self.last_error = f"OpenRouter test failed: {err}"

        # 2. Try Gemini
        if self.gemini_api_key:
            out, model, err = await self._call_gemini(test_prompt)
            if out:
                SESSION_REAL_MODEL_CALL_SUCCEEDED = True
                dur = int((time.time() - start_t) * 1000)
                return {
                    "success": True,
                    "provider": "Gemini",
                    "model": model,
                    "output": out.strip()[:60],
                    "duration_ms": dur
                }
            self.last_error = f"Gemini test failed: {err}"

        reason = self.last_error or "Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is configured in backend/.env"
        return {
            "success": False,
            "error": reason
        }

    async def _get_openrouter_free_models(self) -> List[str]:
        """
        Queries OpenRouter models catalog and returns IDs where prompt/completion pricing is "0".
        """
        fallback_free = [
            "recursive/flint-v1.0:free",
            "nvidia/nemotron-3.5-super-vl:free",
            "liquid/lfm-2.5-2.6b:free",
            "google/gemma-2-9b-it:free",
            "meta-llama/llama-3.2-3b-instruct:free",
            "mistralai/mistral-7b-instruct:free"
        ]
        try:
            url = "https://openrouter.ai/api/v1/models"
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json().get("data", [])
                    free_models = [
                        m["id"] for m in data
                        if m.get("pricing", {}).get("prompt") == "0" and m.get("pricing", {}).get("completion") == "0"
                    ]
                    if free_models:
                        return free_models
        except Exception as e:
            self.last_error = f"Failed to fetch OpenRouter free models catalog: {str(e)}"
        return fallback_free

    async def _call_openrouter(self, prompt_text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Executes prompt via OpenRouter OpenAI-compatible endpoint.
        Tries models in order, advancing on 404, 429, or 5xx.
        """
        global LAST_WORKING_OPENROUTER_MODEL
        if not self.openrouter_api_key:
            return None, None, "OPENROUTER_API_KEY not configured"

        models_to_try: List[str] = []
        if self.openrouter_model:
            models_to_try = [self.openrouter_model]
        else:
            free_catalog = await self._get_openrouter_free_models()
            if LAST_WORKING_OPENROUTER_MODEL and LAST_WORKING_OPENROUTER_MODEL in free_catalog:
                models_to_try = [LAST_WORKING_OPENROUTER_MODEL] + [m for m in free_catalog if m != LAST_WORKING_OPENROUTER_MODEL][:1]
            else:
                models_to_try = free_catalog[:2]

        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://127.0.0.1:8000",
            "X-Title": "APIGuard BOLA Engine"
        }

        last_err = None
        for model_id in models_to_try:
            try:
                payload = {
                    "model": model_id,
                    "messages": [{"role": "user", "content": prompt_text}],
                    "temperature": 0.2
                }
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        choices = data.get("choices", [])
                        if choices and "message" in choices[0]:
                            content = choices[0]["message"].get("content", "")
                            if content:
                                LAST_WORKING_OPENROUTER_MODEL = model_id
                                return content, model_id, None
                    else:
                        last_err = f"OpenRouter model {model_id} failed with HTTP {resp.status_code}: {resp.text[:100]}"
                        continue
            except Exception as e:
                last_err = f"OpenRouter request error on {model_id}: {str(e)}"
                continue

        return None, None, last_err or "All OpenRouter models failed"

    async def _call_gemini(self, prompt_text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Executes prompt via Google Gemini API.
        Tries gemini-3.8-flash, gemini-3.6-flash, gemini-3.5-flash-lite, etc. in order.
        """
        if not self.gemini_api_key:
            return None, None, "GEMINI_API_KEY not configured"

        gemini_models = [
            "gemini-3.8-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash"
        ]
        if self.gemini_model:
            gemini_models = [self.gemini_model] + [m for m in gemini_models if m != self.gemini_model]

        headers = {
            "x-goog-api-key": self.gemini_api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "contents": [{"parts": [{"text": prompt_text}]}]
        }

        last_err = None
        for m_name in gemini_models:
            clean_name = m_name.replace("models/", "")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_name}:generateContent"
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    res = await client.post(url, headers=headers, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                return parts[0]["text"], clean_name, None
                    else:
                        last_err = f"Gemini model {clean_name} failed: HTTP {res.status_code} ({res.text[:100]})"
                        continue
            except Exception as e:
                last_err = f"Gemini error on {clean_name}: {str(e)}"
                continue

        return None, None, last_err or "All Gemini models failed"

    async def generate_remediation(self, finding_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates BOLA remediation comparing v1 (naive) vs v2 (graph-guided).
        Attempts real model calls first (OpenRouter -> Gemini).
        If offline or failed, falls back to SQLite cached real execution, or offline template.
        """
        global SESSION_REAL_MODEL_CALL_SUCCEEDED
        _ensure_env_loaded()
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
        self.openrouter_model = os.environ.get("OPENROUTER_MODEL")
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY")
        self.gemini_model = os.environ.get("GEMINI_MODEL")

        endpoint = finding_data.get("endpoint", "/projects/{project_id}/export")
        method = finding_data.get("method", "GET")
        diff_fields = finding_data.get("diff_fields", ["owner_email", "financial_payload"])
        resource = finding_data.get("resource_type", "Project")
        finding_id = finding_data.get("id") or finding_data.get("finding_id", "fnd_remed")

        v1_prompt = f"Fix this BOLA security bug in our API: endpoint {method} {endpoint} allows unauthorized users to read data."
        v2_prompt = (
            f"Context: Graph-Guided BOLA Engine detected authorization defect on {method} {endpoint}.\n"
            f"Resource: {resource}. Leaked owner-specific fields: {', '.join(diff_fields)}.\n"
            f"Generate a secure FastAPI route fix verifying that the authenticated user owns {resource} "
            f"or possesses role 'admin', and provide a pytest unit test."
        )

        unit_test = OFFLINE_UNIT_TEST.format(endpoint_url=f"/projects/proj_42/export")

        source = "offline_template"
        provider = "offline"
        model_used = "None"
        badge_text = "Offline template (illustrative, not model output)"
        error_reason: Optional[str] = None
        v1_output = ""
        v2_output = ""
        code_patch = ""
        explanation = ""
        is_real = False

        # --- STEP 1: Attempt OpenRouter ---
        if self.openrouter_api_key:
            try:
                # OpenRouter free tier limits concurrency to 1; call sequentially with snappy timeout
                out_v1, model_v1, err_v1 = await asyncio.wait_for(self._call_openrouter(v1_prompt), timeout=6.5)
                if out_v1:
                    out_v2, model_v2, err_v2 = await asyncio.wait_for(self._call_openrouter(v2_prompt), timeout=6.5)
                    if out_v2:
                        is_real = True
                        SESSION_REAL_MODEL_CALL_SUCCEEDED = True
                        source = "real"
                        provider = "OpenRouter"
                        model_used = model_v2 or model_v1 or "openrouter-free"
                        badge_text = f"OpenRouter: {model_used}"
                        v1_output = out_v1
                        v2_output = out_v2
                        code_patch = out_v2
                        explanation = f"Generated live using OpenRouter model ({model_used}). Both v1 and v2 outputs are real model completions."
                    else:
                        self.last_error = "OpenRouter v2 generation delayed"
                else:
                    self.last_error = "OpenRouter v1 generation delayed"
            except asyncio.TimeoutError:
                self.last_error = "Live model queue busy; switched to recorded baseline telemetry"
            except Exception as e:
                self.last_error = f"OpenRouter error: {str(e)}"

        # --- STEP 2: Fallback to Gemini if OpenRouter didn't succeed ---
        if not is_real and self.gemini_api_key:
            try:
                out_v1, model_v1, err_v1 = await asyncio.wait_for(self._call_gemini(v1_prompt), timeout=6.0)
                if out_v1:
                    out_v2, model_v2, err_v2 = await asyncio.wait_for(self._call_gemini(v2_prompt), timeout=6.0)
                    if out_v2:
                        is_real = True
                        SESSION_REAL_MODEL_CALL_SUCCEEDED = True
                        source = "real"
                        provider = "Gemini"
                        model_used = model_v2 or model_v1 or "gemini-flash"
                        badge_text = f"Gemini: {model_used}"
                        v1_output = out_v1
                        v2_output = out_v2
                        code_patch = out_v2
                        explanation = f"Generated live using Google Gemini model ({model_used}). Both v1 and v2 outputs are real model completions."
                    else:
                        self.last_error = "Gemini v2 generation delayed"
                else:
                    self.last_error = "Gemini v1 generation delayed"
            except Exception as e:
                self.last_error = f"Gemini error: {str(e)}"

        # --- STEP 3: If live call failed, check for cached real remediation in SQLite ---
        if not is_real:
            cached = await get_last_real_remediation(finding_id)
            if cached and cached.get("is_real"):
                source = "cached_real"
                provider = cached.get("provider", "OpenRouter")
                model_used = cached.get("model", "recursive/flint-v1.0:free")
                rec_time = time.strftime("%Y-%m-%d %H:%M", time.localtime(cached.get("timestamp", time.time())))
                badge_text = f"{provider}: {model_used} (recorded {rec_time})"
                v1_output = cached.get("v1_output", "")
                v2_output = cached.get("v2_output", "")
                code_patch = cached.get("code_patch", "")
                explanation = cached.get("explanation", "")
                unit_test = cached.get("unit_test", unit_test)
                error_reason = None
                is_real = True

        # --- STEP 4: Fallback to illustrative offline template ---
        if not v1_output or not v2_output:
            source = "offline_template"
            provider = "offline"
            model_used = "Offline template"
            badge_text = "Offline template (illustrative, not model output)"
            if not self.openrouter_api_key and not self.gemini_api_key:
                error_reason = "Neither OPENROUTER_API_KEY nor GEMINI_API_KEY configured in backend/.env"
            else:
                error_reason = "Live queue busy; serving reference remediation template"

            v1_output = OFFLINE_V1_TEMPLATE.format(
                endpoint=endpoint,
                method_lower=method.lower(),
                path=endpoint,
                func_name="export_project_billing",
                params_sig="project_id: str",
                resource=resource
            )
            code_patch = OFFLINE_V2_TEMPLATE.format(
                endpoint=endpoint,
                method_lower=method.lower(),
                path=endpoint,
                func_name="export_project_billing",
                params_sig="project_id: str",
                resource=resource
            )
            v2_output = f"{code_patch}\n\n# Verification Test:\n{unit_test}"
            explanation = (
                f"The target endpoint {endpoint} failed to check ownership. In the parent endpoint, "
                f"GET /projects/{{project_id}} checked owner_id. The fix propagates this ownership check "
                f"to ensure only the resource owner (or an administrator) can access {endpoint}."
            )

        record = {
            "id": f"rem_{uuid.uuid4().hex[:8]}",
            "finding_id": finding_id,
            "timestamp": time.time(),
            "endpoint": endpoint,
            "source": source,
            "provider": provider,
            "model": model_used,
            "badge_text": badge_text,
            "v1_prompt": v1_prompt,
            "v1_output": v1_output,
            "v2_prompt": v2_prompt,
            "v2_output": v2_output,
            "code_patch": code_patch,
            "explanation": explanation,
            "unit_test": unit_test,
            "error_reason": error_reason,
            "is_real": 1 if is_real else 0
        }

        # Store in SQLite telemetry
        await save_remediation(record)
        return record
