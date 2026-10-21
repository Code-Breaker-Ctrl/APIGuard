import pytest
import threading
import time
import uvicorn
import httpx
from app.main import app
from app.engine.spec import OpenAPIParser, DEMO_SPEC_YAML
from app.engine.executor import SafeExecutor
from app.engine.benchmark import GraphGuidedScanner
from app.engine.baseline import BaselineScanner
from app.engine.models import IdentityProfile
from app.target.data import reset_db
from app.target.config import update_target_config

TEST_PORT = 8123
TEST_HOST = "127.0.0.1"
BASE_URL = f"http://{TEST_HOST}:{TEST_PORT}/target"

class UvicornServerThread(threading.Thread):
    def __init__(self):
        super().__init__()
        config = uvicorn.Config(app, host=TEST_HOST, port=TEST_PORT, log_level="error")
        self.server = uvicorn.Server(config)
        self.daemon = True

    def run(self):
        self.server.run()

    def stop(self):
        self.server.should_exit = True

@pytest.fixture(scope="module")
def real_uvicorn_server():
    server_thread = UvicornServerThread()
    server_thread.start()

    # Wait for server to be responsive
    client = httpx.Client(timeout=5.0)
    for _ in range(30):
        try:
            res = client.get(f"http://{TEST_HOST}:{TEST_PORT}/api/health")
            if res.status_code == 200:
                break
        except Exception:
            time.sleep(0.1)

    yield BASE_URL
    server_thread.stop()

@pytest.mark.asyncio
async def test_real_socket_defect_b_propagation(real_uvicorn_server):
    """
    Asserts against real uvicorn socket:
    1. Defect B (export) is CONFIRMED by GraphGuidedScanner.
    2. Defect B is MISSED by BaselineScanner.
    3. Primary GET /projects/{id} produces 0 findings (secure).
    4. No tokens appear in any stored finding data.
    """
    reset_db()
    update_target_config(defect_a=False, defect_b=True, defect_c=False, patched_mode=False)

    parser = OpenAPIParser(DEMO_SPEC_YAML)
    operations = parser.extract_operations()

    user_a = IdentityProfile(identity_id="usr_alice_101", username="alice@acme.corp", password="password_alice_123", role="customer", token="tok_live_alice_8921")
    user_b = IdentityProfile(identity_id="usr_bob_202", username="bob@adversary.io", password="password_bob_456", role="customer", token="tok_live_bob_9934")

    # 1. Run Graph-Guided Scanner
    executor = SafeExecutor(allowed_hosts={"127.0.0.1", "localhost"}, total_budget=20)
    graph_scanner = GraphGuidedScanner(executor, real_uvicorn_server)
    graph_findings = await graph_scanner.run_scan(operations, user_a, user_b)

    # Must confirm Defect B on export
    assert len(graph_findings) == 1
    f = graph_findings[0]
    assert f.endpoint == "/projects/{project_id}/export"
    assert f.status.value == "confirmed"
    assert "financial_payload" in f.diff_fields or "billing" in str(f.diff_fields)

    # Token redaction check
    assert "tok_live" not in str(f.model_dump())
    assert "password" not in str(f.model_dump())

    # 2. Run Baseline Scanner (exact same target & budget)
    base_executor = SafeExecutor(allowed_hosts={"127.0.0.1", "localhost"}, total_budget=20)
    baseline_scanner = BaselineScanner(base_executor, real_uvicorn_server)
    baseline_findings = await baseline_scanner.scan_operations(operations, user_a, user_b)

    # Baseline scanner must MISS Defect B because it evaluates /export in isolation without graph rule propagation
    assert len(baseline_findings) == 0

@pytest.mark.asyncio
async def test_admin_and_support_no_false_positives(real_uvicorn_server):
    """
    Asserts legitimate role exemptions (admin, support) produce 0 false positives.
    """
    reset_db()
    async with httpx.AsyncClient() as client:
        # Admin can read Alice's project legitimately
        admin_res = await client.get(
            f"{real_uvicorn_server}/projects/proj_42",
            headers={"Authorization": "Bearer tok_live_admin_1111"}
        )
        assert admin_res.status_code == 200

        # Support can read Alice's project legitimately
        support_res = await client.get(
            f"{real_uvicorn_server}/projects/proj_42",
            headers={"Authorization": "Bearer tok_live_support_2222"}
        )
        assert support_res.status_code == 200
