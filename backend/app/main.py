import asyncio
import json
import time
import uuid
import os
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables at startup from backend/.env or root .env
_env_backend = Path(__file__).resolve().parent.parent / ".env"
_env_root = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_backend.exists():
    load_dotenv(_env_backend)
if _env_root.exists():
    load_dotenv(_env_root)
load_dotenv()
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

from app.engine.spec import OpenAPIParser, DEMO_SPEC_YAML
from app.engine.graph import ResourceGraph
from app.engine.executor import SafeExecutor
from app.engine.scanner import GraphGuidedScanner
from app.engine.planner import TestPlanner
from app.engine.remediation import RemediationEngine
from app.engine.benchmark import run_benchmark
from app.engine.auth import AuthRegistry, DEFAULT_CREDENTIALS
from app.engine.models import IdentityProfile, ScanEvent
from app.target.app import target_app
from app.target.data import reset_db
from app.target.config import update_target_config, get_target_config
from app.db import init_db, save_scan, save_scan_event, save_finding, get_findings, clear_db

current_spec_yaml = DEMO_SPEC_YAML
current_graph = ResourceGraph()

def refresh_current_graph():
    global current_graph
    parser = OpenAPIParser(current_spec_yaml)
    operations = parser.extract_operations()
    current_graph = ResourceGraph()
    current_graph.build_from_operations(operations)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    refresh_current_graph()
    yield

app = FastAPI(title="APIGuard Platform API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount vulnerable sample target API at /target
app.mount("/target", target_app)

# Active scan event streams
ACTIVE_EVENT_QUEUES: Dict[str, asyncio.Queue] = {}

@app.get("/api/health")
def health():
    cfg = get_target_config()
    return {
        "status": "healthy",
        "service": "APIGuard Engine",
        "target_mounted": True,
        "target_patched": cfg.patched_mode
    }

@app.post("/api/spec/import")
async def import_spec(file: Optional[UploadFile] = File(None), raw_spec: Optional[str] = Form(None)):
    global current_spec_yaml
    try:
        content = ""
        if file:
            content = (await file.read()).decode("utf-8")
        elif raw_spec:
            content = raw_spec
        else:
            content = DEMO_SPEC_YAML

        parser = OpenAPIParser(content)
        operations = parser.extract_operations()
        current_spec_yaml = content
        refresh_current_graph()
        return {
            "status": "success",
            "operations_count": len(operations),
            "nodes_count": len(current_graph.nodes),
            "edges_count": len(current_graph.edges)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid OpenAPI 3.x specification: {str(e)}")

@app.get("/api/graph")
def get_graph():
    return current_graph.to_dict()

class ScanTriggerInput(BaseModel):
    dry_run: bool = False
    budget: int = 30
    enable_mutations: bool = False

@app.post("/api/scan")
async def trigger_scan(opts: ScanTriggerInput):
    if opts.dry_run:
        # A live scan always sends traffic. Previewing the plan is a separate, traffic-free endpoint.
        raise HTTPException(
            status_code=400,
            detail="dry_run is not supported on /api/scan; use POST /api/scan/dry-run to preview the plan without sending traffic",
        )
    scan_id = f"scan_{uuid.uuid4().hex[:8]}"
    await save_scan(scan_id, "http://127.0.0.1:8000/target")
    queue = asyncio.Queue()
    ACTIVE_EVENT_QUEUES[scan_id] = queue

    # Run scan in background task
    asyncio.create_task(_execute_scan_task(scan_id, opts, queue))

    return {"scan_id": scan_id, "status": "initiated"}

@app.post("/api/scan/dry-run")
async def preview_dry_run(opts: ScanTriggerInput):
    parser = OpenAPIParser(current_spec_yaml)
    operations = parser.extract_operations()
    planner = TestPlanner(current_graph, base_url="http://127.0.0.1:8000/target")

    user_a = IdentityProfile(identity_id="usr_aman_101", username="aman@acme.corp", password="mock_aman_password", role="customer", token="[DRY_RUN_AMAN_TOKEN]")
    user_b = IdentityProfile(identity_id="usr_taaran_202", username="taaran@adversary.io", password="mock_taaran_password", role="customer", token="[DRY_RUN_TAARAN_TOKEN]")

    all_steps = []
    budget_allocated = opts.budget
    for op in operations:
        steps = planner.plan_audit_for_operation(op, user_a, user_b, enable_mutations=opts.enable_mutations)
        for s in steps:
            all_steps.append({
                "step_id": s.step_id,
                "operation_id": s.operation_id,
                "method": s.method,
                "url": s.url,
                "identity": s.identity_id,
                "purpose": s.purpose,
                "phase": "A" if s.purpose in ["setup", "control_owner"] else "B",
                "cleanup": s.cleanup,
                "headers": {"Authorization": "[REDACTED]"},
                "body_preview": s.json_body or {}
            })

    planned_steps = all_steps[:budget_allocated]
    return {
        "planned_steps": planned_steps,
        "total_planned": len(planned_steps),
        "total_budget": budget_allocated,
        "mutations_enabled": opts.enable_mutations,
        "budget_remaining": max(0, budget_allocated - len(planned_steps))
    }

async def _execute_scan_task(scan_id: str, opts: ScanTriggerInput, queue: asyncio.Queue):
    try:
        parser = OpenAPIParser(current_spec_yaml)
        operations = parser.extract_operations()
        
        # Real in-process ASGI client to communicate with /target
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8000") as asgi_client:
            # Dynamically authenticate via /target/auth/login
            auth_reg = AuthRegistry("http://127.0.0.1:8000/target")
            identities = await auth_reg.authenticate_all(client=asgi_client)
            user_a = identities["user_a"]
            user_b = identities["user_b"]

            ev1 = ScanEvent(
                event_id=f"ev_{uuid.uuid4().hex[:6]}",
                scan_id=scan_id,
                timestamp=time.time(),
                event_type="log",
                phase="A",
                message=f"[AUTH] Successfully acquired dynamic tokens for User A ({user_a.username}) and User B ({user_b.username})"
            )
            await queue.put(ev1)
            await save_scan_event(ev1)

            async def on_scan_event(ev: ScanEvent):
                ev.scan_id = scan_id
                await queue.put(ev)
                await save_scan_event(ev)

            executor = SafeExecutor(
                allowed_hosts={"127.0.0.1", "localhost"},
                total_budget=opts.budget,
                enable_mutations=opts.enable_mutations
            )
            scanner = GraphGuidedScanner(executor, "http://127.0.0.1:8000/target")

            findings = await scanner.run_scan(
                operations=operations,
                user_a=user_a,
                user_b=user_b,
                enable_mutations=opts.enable_mutations,
                on_event=on_scan_event,
                client=asgi_client
            )

            for f in findings:
                await save_finding(scan_id, f)

            ev_end = ScanEvent(
                event_id=f"ev_{uuid.uuid4().hex[:6]}",
                scan_id=scan_id,
                timestamp=time.time(),
                event_type="scan_completed",
                phase="C",
                message=f"[DONE] Audit finished. {len(findings)} confirmed vulnerabilities recorded.",
                data={"findings_count": len(findings)}
            )
            await queue.put(ev_end)
            await save_scan_event(ev_end)

    except Exception as e:
        ev_err = ScanEvent(
            event_id=f"ev_{uuid.uuid4().hex[:6]}",
            scan_id=scan_id,
            timestamp=time.time(),
            event_type="error",
            message=f"[ERROR] Scan execution error: {str(e)}"
        )
        await queue.put(ev_err)
        await save_scan_event(ev_err)
        await queue.put(ScanEvent(
            event_id=f"ev_{uuid.uuid4().hex[:6]}",
            scan_id=scan_id,
            timestamp=time.time(),
            event_type="scan_completed",
            phase="C",
            message="[DONE] Audit aborted due to an error.",
            data={"findings_count": 0, "aborted": True}
        ))
    finally:
        await queue.put(None)  # Sentinel to close SSE stream

@app.get("/api/scan/{scan_id}/events")
async def stream_scan_events(scan_id: str):
    queue = ACTIVE_EVENT_QUEUES.get(scan_id)
    if not queue:
        raise HTTPException(status_code=404, detail="Scan not found or expired")

    async def event_generator():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event.model_dump())}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/findings")
async def list_findings(scan_id: Optional[str] = None):
    return await get_findings(scan_id=scan_id)

@app.get("/api/identities")
async def get_identities():
    return [
        {
            "key": key,
            "identity_id": creds["identity_id"],
            "username": creds["username"],
            "role": creds["role"],
            "token": "[REDACTED]"
        }
        for key, creds in DEFAULT_CREDENTIALS.items()
    ]

@app.post("/api/target/reset")
async def reset_target():
    reset_db()
    await clear_db()
    ACTIVE_EVENT_QUEUES.clear()
    cfg = get_target_config()
    update_target_config(
        defect_a=cfg.defect_a,
        defect_b=cfg.defect_b,
        defect_c=cfg.defect_c,
        patched_mode=False
    )
    return {"status": "target_reset_success", "patched_mode": False}

@app.get("/api/target/status")
def get_target_status():
    cfg = get_target_config()
    return {
        "patched_mode": cfg.patched_mode,
        "defect_a": cfg.defect_a,
        "defect_b": cfg.defect_b,
        "defect_c": cfg.defect_c
    }

@app.get("/api/benchmark/latest")
async def get_latest_benchmark():
    """
    Reads the stored benchmark results file without re-running or resetting live target state.
    """
    benchmarks_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "benchmarks", "results.json"))
    if os.path.exists(benchmarks_path):
        with open(benchmarks_path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="No benchmark results found. Run POST /api/benchmark/run first.")

@app.post("/api/benchmark/run")
async def execute_benchmark_run():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8000") as asgi_client:
        return await run_benchmark("http://127.0.0.1:8000/target", client=asgi_client)

@app.post("/api/remediate")
async def remediate_vulnerability(payload: Dict[str, Any]):
    engine = RemediationEngine()
    return await engine.generate_remediation(payload)

@app.get("/api/remediate/status")
async def get_remediation_status():
    engine = RemediationEngine()
    return await engine.get_status()

@app.post("/api/remediate/test")
async def test_remediation_model():
    engine = RemediationEngine()
    return await engine.test_connection()

class TargetPatchInput(BaseModel):
    patched: bool = True

@app.post("/api/target/patch")
def apply_target_reference_patch(payload: Optional[TargetPatchInput] = None):
    patched = True if payload is None else payload.patched
    cfg = get_target_config()
    update_target_config(
        defect_a=cfg.defect_a,
        defect_b=cfg.defect_b,
        defect_c=cfg.defect_c,
        patched_mode=patched
    )
    return {
        "status": "target_patch_updated",
        "patched_mode": patched,
        "note": "Reference fix applied to demo target via patched_mode; model-generated patch is not auto-applied"
    }
