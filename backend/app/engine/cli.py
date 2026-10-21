import sys
import asyncio
import argparse
from app.engine.spec import OpenAPIParser, DEMO_SPEC_YAML
from app.engine.graph import ResourceGraph
from app.engine.planner import TestPlanner
from app.engine.executor import SafeExecutor
from app.engine.benchmark import GraphGuidedScanner
from app.engine.models import IdentityProfile
from app.target.data import reset_db
from app.target.config import update_target_config

def main():
    parser = argparse.ArgumentParser(description="APIGuard CLI - Graph-Guided API Authorization Tester")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    scan_parser = subparsers.add_parser("scan", help="Run authorization scan")
    scan_parser.add_argument("--dry-run", action="store_true", help="Print execution plan without sending HTTP requests")
    scan_parser.add_argument("--target", default="http://localhost:8000/target", help="Target base URL")

    args = parser.parse_args()

    if args.command == "scan":
        asyncio.run(run_cli_scan(dry_run=args.dry_run, target_url=args.target))
    else:
        parser.print_help()

async def run_cli_scan(dry_run: bool, target_url: str):
    print("=" * 65)
    print("  APIGuard CLI Engine — Graph-Guided BOLA Scanner")
    print("=" * 65)

    parser = OpenAPIParser(DEMO_SPEC_YAML)
    operations = parser.extract_operations()
    print(f"[*] Ingested OpenAPI spec: {len(operations)} operations normalized.")

    graph = ResourceGraph()
    graph.build_from_operations(operations)
    print(f"[*] Dependency DAG constructed: {len(graph.nodes)} nodes, {len(graph.edges)} edges.")

    user_a = IdentityProfile(identity_id="usr_alice_101", username="alice@acme.corp", password="password_alice_123", role="customer", token="tok_live_alice_8921")
    user_b = IdentityProfile(identity_id="usr_bob_202", username="bob@adversary.io", password="password_bob_456", role="customer", token="tok_live_bob_9934")

    if dry_run:
        print("\n[DRY RUN MODE ENABLED - ZERO REQUESTS SENT]")
        planner = TestPlanner(graph, target_url)
        for op in operations:
            steps = planner.plan_audit_for_operation(op, user_a, user_b)
            if steps:
                print(f"\nPlanned sequence for {op.method} {op.path}:")
                for s in steps:
                    print(f"  - [{s.purpose}] {s.method} {s.url} (Identity: {s.identity_id})")
        print("\n[SUCCESS] Dry-run completed. All prerequisite paths validated.")
        return

    print("\n[*] Initiating Dual-Token Graph Execution...")
    reset_db()
    update_target_config(defect_a=False, defect_b=True, defect_c=False, patched_mode=False)

    # Check if target server is live; if not, use in-process ASGI client
    import httpx
    from app.main import app
    is_live = False
    try:
        async with httpx.AsyncClient(timeout=0.5) as check_client:
            r = await check_client.get(f"{target_url.rsplit('/target', 1)[0]}/api/health")
            if r.status_code == 200:
                is_live = True
    except Exception:
        is_live = False

    executor = SafeExecutor(total_budget=30, per_endpoint_budget=6)
    scanner = GraphGuidedScanner(executor, target_url)

    if is_live:
        print("[*] Connected to live target server at", target_url)
        findings = await scanner.run_scan(operations, user_a, user_b)
    else:
        print("[*] Live server not detected on port; executing against in-process target...")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost:8000") as asgi_client:
            # Override execute_step to use asgi_client
            orig_execute = executor.execute_step
            executor.execute_step = lambda step: orig_execute(step, client=asgi_client)
            findings = await scanner.run_scan(operations, user_a, user_b)

    print("\n" + "=" * 65)
    print(f"  AUDIT COMPLETE: {len(findings)} CONFIRMED VULNERABILITIES")
    print("=" * 65)

    for f in findings:
        print(f"\n[!] FINDING: {f.id} — {f.severity}")
        print(f"    Endpoint:      {f.method} {f.endpoint}")
        print(f"    Status:        {f.status.value.upper()} (Differential Payload Match)")
        print(f"    Confidence:    {f.confidence}")
        print(f"    DAG Path:      {' -> '.join(f.graph_path)}")
        print(f"    Leaked Fields: {f.diff_fields}")
        print(f"    Repro Curl:    {f.repro_curl}")

if __name__ == "__main__":
    main()
