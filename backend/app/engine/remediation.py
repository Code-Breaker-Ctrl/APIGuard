import os
import json
import time
import uuid
import httpx
from typing import Dict, Any, Optional, Tuple
from app.db import save_remediation

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
        headers={{"Authorization": "Bearer " + bob_token}}
    )
    assert response.status_code == 403
    assert "forbidden" in response.json().get("detail", "").lower()
"""

class RemediationEngine:
    """
    Handles BOLA remediation generation.
    When GEMINI_API_KEY is available:
      - Validates and discovers available Gemini model via ListModels with header x-goog-api-key
      - Executes model calls for BOTH v1 and v2 prompts
      - Persists real prompts, model name, real outputs, and timestamp in SQLite
    When offline or if Gemini is unreachable:
      - Returns deterministic templates clearly labeled as illustrative templates (not model outputs)
      - Records the exact failure status / error reason
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.configured_model = os.environ.get("GEMINI_MODEL")
        self.last_error: Optional[str] = None
        self.last_tested_model: Optional[str] = None

    async def get_status(self) -> Dict[str, Any]:
        """
        Returns status of Gemini integration (key present/absent, discovered model, last error).
        """
        if not self.api_key:
            return {
                "key_present": False,
                "model": None,
                "last_error": "GEMINI_API_KEY environment variable is not configured",
                "status": "offline_template_only"
            }

        # Validate by discovering available models
        model_name, err = await self._discover_model()
        if err:
            return {
                "key_present": True,
                "model": None,
                "last_error": err,
                "status": "error"
            }

        return {
            "key_present": True,
            "model": model_name,
            "last_error": None,
            "status": "active"
        }

    async def _discover_model(self) -> Tuple[Optional[str], Optional[str]]:
        if not self.api_key:
            return None, "GEMINI_API_KEY not configured"

        if self.configured_model:
            model_id = self.configured_model.replace("models/", "")
            return f"models/{model_id}", None

        # Dynamically query ListModels endpoint to avoid assuming model existence
        try:
            url = "https://generativelanguage.googleapis.com/v1beta/models"
            headers = {"x-goog-api-key": self.api_key}
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code != 200:
                    err_msg = f"Gemini unavailable: HTTP {res.status_code} ({res.text[:120]})"
                    self.last_error = err_msg
                    return None, err_msg

                data = res.json()
                models = data.get("models", [])
                
                # Prioritize available flash models
                flash_models = [
                    m["name"] for m in models 
                    if "generateContent" in m.get("supportedGenerationMethods", []) and "flash" in m.get("name", "").lower()
                ]
                if flash_models:
                    chosen = flash_models[0]
                    self.last_tested_model = chosen
                    return chosen, None

                # Otherwise any model supporting generateContent
                gen_models = [
                    m["name"] for m in models 
                    if "generateContent" in m.get("supportedGenerationMethods", [])
                ]
                if gen_models:
                    chosen = gen_models[0]
                    self.last_tested_model = chosen
                    return chosen, None

                return None, "No models with generateContent capability found"
        except Exception as e:
            err_msg = f"Gemini unavailable: {str(e)}"
            self.last_error = err_msg
            return None, err_msg

    async def _call_gemini_prompt(self, model_name: str, prompt_text: str) -> Tuple[Optional[str], Optional[str]]:
        try:
            model_clean = model_name.replace("models/", "")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_clean}:generateContent"
            headers = {
                "x-goog-api-key": self.api_key,
                "Content-Type": "application/json"
            }
            payload = {
                "contents": [{
                    "parts": [{"text": prompt_text}]
                }]
            }
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code != 200:
                    return None, f"HTTP {res.status_code}: {res.text[:120]}"
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"], None
                return None, "Empty response from Gemini model"
        except Exception as e:
            return None, str(e)

    async def generate_remediation(self, finding_data: Dict[str, Any]) -> Dict[str, Any]:
        endpoint = finding_data.get("endpoint", "/projects/{project_id}/export")
        method = finding_data.get("method", "GET")
        diff_fields = finding_data.get("diff_fields", ["owner_email", "financial_payload"])
        resource = finding_data.get("resource_type", "Project")
        finding_id = finding_data.get("finding_id", "fnd_remed")

        v1_prompt = f"Fix this BOLA security bug in our API: endpoint {method} {endpoint} allows unauthorized users to read data."
        v2_prompt = (
            f"Context: Graph-Guided BOLA Engine detected authorization defect on {method} {endpoint}.\n"
            f"Resource: {resource}. Leaked owner-specific fields: {', '.join(diff_fields)}.\n"
            f"Generate a secure FastAPI route fix verifying that the authenticated user owns {resource} "
            f"or possesses role 'admin', and provide a pytest unit test."
        )

        unit_test = OFFLINE_UNIT_TEST.format(endpoint_url=f"/projects/proj_42/export")

        mode = "offline_template"
        model_used = "None (offline template)"
        error_reason: Optional[str] = None
        v1_output = ""
        v2_output = ""
        code_patch = ""
        explanation = ""

        # Attempt real Gemini call if key is provided
        if self.api_key:
            model_name, disc_err = await self._discover_model()
            if disc_err:
                error_reason = f"Gemini unavailable: {disc_err}, using offline template"
                self.last_error = error_reason
            else:
                model_used = model_name
                # Call BOTH v1 and v2 prompts for genuine comparison
                out_v1, err_v1 = await self._call_gemini_prompt(model_name, v1_prompt)
                out_v2, err_v2 = await self._call_gemini_prompt(model_name, v2_prompt)

                if out_v1 and out_v2:
                    mode = "gemini"
                    v1_output = out_v1
                    v2_output = out_v2
                    code_patch = out_v2
                    explanation = f"Generated live using Google Gemini model ({model_name}). Both v1 and v2 outputs are real model completions."
                else:
                    failed_call = "v1" if not out_v1 else "v2"
                    err_detail = err_v1 if not out_v1 else err_v2
                    error_reason = f"Gemini unavailable: {err_detail} during {failed_call} prompt, using offline template"
                    self.last_error = error_reason

        # Fallback to illustrative templates if offline or call failed
        if not v1_output or not v2_output:
            mode = "offline_template"
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
            "mode": mode,
            "model": model_used,
            "v1_prompt": v1_prompt,
            "v1_output": v1_output,
            "v2_prompt": v2_prompt,
            "v2_output": v2_output,
            "code_patch": code_patch,
            "explanation": explanation,
            "unit_test": unit_test,
            "error_reason": error_reason
        }

        # Store prompt, model, outputs, timestamp in SQLite
        await save_remediation(record)

        return record
