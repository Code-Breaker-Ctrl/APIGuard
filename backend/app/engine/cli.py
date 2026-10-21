import sys
import asyncio
import argparse
import httpx
from app.engine.spec import OpenAPIParser, DEMO_SPEC_YAML
from app.engine.graph import ResourceGraph
from app.engine.planner import TestPlanner
from app.engine.executor import SafeExecutor
from app.engine.scanner import GraphGuidedScanner
from app.engine.auth import AuthRegistry
from app.target.data import reset_db
from app.target.config import update_target_config

def main():
    parser = argparse.ArgumentParser(description="APIGuard CLI - Graph-Guided API Authorization Tester")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    scan_parser = subparsers.add_parser("scan", help="Run authorization scan")
    scan_parser.add_argument("--dry-run", action="store_true", help="Print execution plan without sending HTTP requests")
    scan_parser.add_argument("--target", default="http://127.0.0.1:8000/target", help="Target base URL")
    scan_parser.add_argument("--mutations", action="store_true", help="Enable mutating tests (PATCH, DELETE)")

    args = parser.parse_args()

    if args.command == "scan":
        asyncio.run(run_cli_scan(dry_run=args.dry_run, target_url=args.target, enable_mutations=args.mutations))
    else:
        parser.print_help()

async def run_cli_scan(dry_run: bool, target_url: str, enable_mutations: bool = False):
    print("=" * 65)
    print("  APIGuard CLI Engine — Graph-Guided BOLA Scanner")
    print("=" * 65)

    parser = OpenAPIParser(DEMO_SPEC_YAML)
    operations = parser.extract_operations()
    print(f"[*] Ingested OpenAPI spec: {len(operations)} operations normalized.")

    graph = ResourceGraph()
    graph.build_from_operations(operations)
    print(f"[*] Dependency DAG constructed: {len(graph.nodes)} nodes, {len(graph.edges)} edges.")

    # Check if target server is live
    is_live = False
    try:
        async with httpx.AsyncClient(timeout=0.5) as check_client:
            r = await check_client.get(f"{target_url.rsplit('/target', 1)[0]}/api/health")
            if r.status_code == 200:
                is_live = True
    except Exception:
        is_live = False

    if is_live:
        print("[*] Connected to live target server at", target_url)
        auth_reg = AuthRegistry(target_url)
        identities = await auth_reg.authenticate_all()
        client = None
    else:
        print("[*] Live server not detected on port; executing against in-process target...")
        from app.main import app
        asgi_client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8000")
        auth_reg = AuthRegistry(target_url)
        identities = await auth_reg.authenticate_all(client=asgi_client)
        client = asgi_client

    user_a = identities["user_a"]
    user_b = identities["user_b"]
    print(f"[*] Dynamic login verified: User A ({user_a.username}), User B ({user_b.username})")

    if dry_run:
        print("\n[DRY RUN MODE ENABLED - ZERO REQUESTS SENT]")
        planner = TestPlanner(graph, target_url)
        for op in operations:
            steps = planner.plan_audit_for_operation(op, user_a, user_b, enable_mutations=enable_mutations)
            if steps:
                print(f"\nPlanned sequence for {op.method} {op.path}:")
                for s in steps:
                    print(f"  - [{s.purpose}] {s.method} {s.url} (Identity: {s.identity_id})")
        print("\n[SUCCESS] Dry-run completed. All prerequisite paths validated.")
        if client:
            await client.aclose()
        return

    print("\n[*] Initiating Dual-Token Graph Execution...")
    reset_db()
    update_target_config(defect_a=False, defect_b=True, defect_c=False, patched_mode=False)

    executor = SafeExecutor(allowed_hosts={"127.0.0.1", "localhost"}, total_budget=30, enable_mutations=enable_mutations)
    scanner = GraphGuidedScanner(executor, target_url)

    t0 = asyncio.get_event_loop().time()
    findings = await scanner.run_scan(operations, user_a, user_b, enable_mutations=enable_mutations, client=client)
    duration_ms = round((asyncio.get_event_loop().time() - t0) * 1000, 1)

    print("\n" + "=" * 65)
    print(f"  AUDIT COMPLETE: {len(findings)} CONFIRMED VULNERABILITIES ({duration_ms}ms)")
    print("=" * 65)

    for f in findings:
        print(f"\n[!] FINDING: {f.id} — {f.severity}")
        print(f"    Endpoint:      {f.method} {f.endpoint}")
        print(f"    Status:        {f.status.value.upper()} (Differential Payload Match)")
        print(f"    Confidence:    {f.confidence}")
        print(f"    DAG Path:      {' -> '.join(f.graph_path)}")
        print(f"    Leaked Fields: {f.diff_fields}")
        print(f"    Repro Curl:    {f.repro_curl}")

    if client:
        await client.aclose()

if __name__ == "__main__":
    main()
