import os
import json
import httpx
from typing import Dict, Any, Optional

OFFLINE_PATCH_TEMPLATE = """# Fix for BOLA Vulnerability at {endpoint}
# Enforce resource-level tenant authorization check

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
    Generates BOLA remediation patches using either the Gemini API (if GEMINI_API_KEY is provided)
    or a deterministic offline fallback template, providing both v1 (naive) and v2 (graph-guided) comparisons.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")

    async def generate_remediation(self, finding_data: Dict[str, Any]) -> Dict[str, Any]:
        endpoint = finding_data.get("endpoint", "/projects/{project_id}/export")
        method = finding_data.get("method", "GET")
        diff_fields = finding_data.get("diff_fields", ["owner_email", "financial_payload"])
        resource = finding_data.get("resource_type", "Project")

        v1_prompt = f"Fix this BOLA security bug in our API: endpoint {method} {endpoint} allows unauthorized users to read data."
        v1_output = (
            f"# Naive v1 Fix (Unscoped Authentication Check)\n"
            f"@app.{method.lower()}('{endpoint}')\n"
            f"def handle_request(user = Depends(get_current_user)):\n"
            f"    # Flaw: Only checks that the user is logged in, not if they own the resource!\n"
            f"    if not user:\n"
            f"        raise HTTPException(401, 'Unauthorized')\n"
            f"    return get_data()"
        )

        v2_prompt = (
            f"Context: Graph-Guided BOLA Engine detected authorization defect on {method} {endpoint}.\n"
            f"Resource: {resource}. Leaked owner-specific fields: {', '.join(diff_fields)}.\n"
            f"Generate a secure FastAPI route fix verifying that the authenticated user owns {resource} "
            f"or possesses role 'admin', and provide a pytest unit test."
        )

        mode = "offline_template"
        code_patch = ""
        explanation = ""
        unit_test = OFFLINE_UNIT_TEST.format(endpoint_url=f"/projects/proj_42/export")

        if self.api_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
                payload = {
                    "contents": [{
                        "parts": [{
                            "text": f"{v2_prompt}\nReturn code and brief explanation."
                        }]
                    }]
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        gemini_res = resp.json()
                        raw_text = gemini_res["candidates"][0]["content"]["parts"][0]["text"]
                        mode = "gemini"
                        code_patch = raw_text
                        explanation = "Generated live via Google Gemini API."
            except Exception:
                mode = "offline_template"

        if not code_patch:
            mode = "offline_template"
            code_patch = OFFLINE_PATCH_TEMPLATE.format(
                endpoint=endpoint,
                method_lower=method.lower(),
                path=endpoint,
                func_name="export_project_billing",
                params_sig="project_id: str"
            )
            explanation = (
                f"The target endpoint {endpoint} failed to check ownership. In the parent endpoint, "
                f"GET /projects/{{project_id}} checked owner_id. The fix propagates this ownership check "
                f"to ensure only the resource owner (or an administrator) can access {endpoint}."
            )

        v2_output = (
            f"{code_patch}\n\n"
            f"# Verification Test:\n"
            f"{unit_test}"
        )

        return {
            "finding_id": finding_data.get("finding_id", "fnd_remed"),
            "endpoint": endpoint,
            "mode": mode,
            "v1_prompt": v1_prompt,
            "v1_output": v1_output,
            "v2_prompt": v2_prompt,
            "v2_output": v2_output,
            "code_patch": code_patch,
            "explanation": explanation,
            "unit_test": unit_test
        }
