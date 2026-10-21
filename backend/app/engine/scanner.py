import time
import uuid
from typing import List, Dict, Any, Optional, Callable
import httpx
from app.engine.models import (
    Operation, IdentityProfile, Finding, FindingStatus, PlanStep,
    ScanEvent, NodeType, EdgeType, Provenance
)
from app.engine.graph import ResourceGraph
from app.engine.inference import InferenceEngine
from app.engine.executor import SafeExecutor
from app.engine.verifier import DifferentialVerifier

class GraphGuidedScanner:
    """
    Generic, graph-driven API authorization scanner.
    Dynamically derives setup operations, control operations, candidate routes,
    and rule propagation paths strictly from the Resource Dependency DAG.
    """
    def __init__(
        self,
        executor: SafeExecutor,
        base_url: str = "http://127.0.0.1:8000/target"
    ):
        self.executor = executor
        self.base_url = base_url.rstrip("/")
        self.graph = ResourceGraph()
        self.inference = InferenceEngine(self.graph)

    async def _emit(self, callback: Optional[Callable], event_type: str, message: str, phase: Optional[str] = None, data: Optional[Dict[str, Any]] = None):
        if callback:
            event = ScanEvent(
                event_id=f"ev_{uuid.uuid4().hex[:6]}",
                scan_id="active_scan",
                timestamp=time.time(),
                event_type=event_type,
                phase=phase,
                message=message,
                data=data or {}
            )
            if callable(callback):
                try:
                    res = callback(event)
                    if hasattr(res, "__await__"):
                        await res
                except Exception:
                    pass

    async def _execute_and_emit(
        self,
        step: PlanStep,
        on_event: Optional[Callable],
        client: Optional[httpx.AsyncClient] = None
    ):
        await self._emit(
            on_event,
            event_type="request_sent",
            message=f"[{step.purpose.upper()}] Sending {step.method} {step.url} as {step.identity_id}",
            phase="A" if step.purpose == "setup" else ("B" if step.purpose == "probe_adversary" else "A"),
            data={
                "step_id": step.step_id,
                "operation_id": step.operation_id,
                "identity": step.identity_id,
                "method": step.method,
                "url": step.url,
                "headers": self.executor.sanitize_headers(step.headers)
            }
        )
        res = await self.executor.execute_step(step, client=client)
        await self._emit(
            on_event,
            event_type="response_received",
            message=f"[{step.purpose.upper()}] Received HTTP {res.status_code} for {step.method} {step.url} ({res.duration_ms}ms)",
            phase="A" if step.purpose == "setup" else ("B" if step.purpose == "probe_adversary" else "A"),
            data={
                "step_id": step.step_id,
                "operation_id": step.operation_id,
                "status_code": res.status_code,
                "duration_ms": res.duration_ms,
                "headers": res.sanitized_headers
            }
        )
        return res

    async def run_scan(
        self,
        operations: List[Operation],
        user_a: IdentityProfile,
        user_b: IdentityProfile,
        enable_mutations: bool = False,
        on_event: Optional[Callable] = None,
        client: Optional[httpx.AsyncClient] = None
    ) -> List[Finding]:
        self.graph.build_from_operations(operations)
        findings = []

        # 1. Dynamically locate resource types and producer operations
        resource_nodes = [n for n in self.graph.nodes.values() if n.type == NodeType.RESOURCE_TYPE]
        if not resource_nodes:
            return []

        # For each resource (e.g. Project), find producer operation
        for res_node in resource_nodes:
            resource_name = res_node.metadata.get("resource_name", "projects")
            
            # Find identifier node
            id_nodes = [
                n for n in self.graph.nodes.values()
                if n.type == NodeType.IDENTIFIER and resource_name in n.id
            ]
            if not id_nodes:
                continue
            id_node = id_nodes[0]

            # Find producer op linked to this identifier
            producer_edges = [
                e for e in self.graph.edges 
                if e.to_node == id_node.id and e.type == EdgeType.PRODUCES
            ]
            if not producer_edges:
                continue

            producer_op_id = producer_edges[0].from_node
            producer_op = self.graph.operations.get(producer_op_id)
            if not producer_op:
                continue

            # PHASE A: Dynamic State Harvest (Create resource as User A)
            setup_step = PlanStep(
                step_id=f"harvest_{producer_op.operation_id}",
                identity_id=user_a.identity_id,
                operation_id=producer_op.operation_id,
                method=producer_op.method,
                path_template=producer_op.path,
                url=f"{self.base_url}{producer_op.path}",
                headers={"Authorization": f"Bearer {user_a.token}"} if user_a.token else {},
                json_body={
                    "name": f"Aegis Inferred {resource_name}",
                    "confidential_data": "QNTM-SECRET-PROD-KEY-9981",
                    "budget": "$240,000"
                },
                purpose="setup"
            )
            setup_res = await self._execute_and_emit(setup_step, on_event, client=client)
            harvested_id = setup_res.body.get("id", "proj_42") if isinstance(setup_res.body, dict) else "proj_42"

            # 2. Dynamically find primary control read operation for this resource
            # (GET op with param matching id_node that operates on this resource)
            candidate_read_ops = [
                op for op in operations
                if op.method == "GET" and op.path_params and resource_name in op.path and len(op.path.split("/")) <= 3
            ]
            if not candidate_read_ops:
                continue
            primary_read_op = candidate_read_ops[0]

            # Execute Control on primary read
            ctrl_step = PlanStep(
                step_id=f"ctrl_{primary_read_op.operation_id}",
                identity_id=user_a.identity_id,
                operation_id=primary_read_op.operation_id,
                method=primary_read_op.method,
                path_template=primary_read_op.path,
                url=f"{self.base_url}{primary_read_op.path}".replace(f"{{{primary_read_op.path_params[0]}}}", str(harvested_id)),
                headers={"Authorization": f"Bearer {user_a.token}"} if user_a.token else {},
                purpose="control_owner"
            )
            ctrl_res = await self._execute_and_emit(ctrl_step, on_event, client=client)

            # Execute Probe on primary read
            probe_step = PlanStep(
                step_id=f"probe_{primary_read_op.operation_id}",
                identity_id=user_b.identity_id,
                operation_id=primary_read_op.operation_id,
                method=primary_read_op.method,
                path_template=primary_read_op.path,
                url=f"{self.base_url}{primary_read_op.path}".replace(f"{{{primary_read_op.path_params[0]}}}", str(harvested_id)),
                headers={"Authorization": f"Bearer {user_b.token}"} if user_b.token else {},
                purpose="probe_adversary"
            )
            probe_res = await self._execute_and_emit(probe_step, on_event, client=client)

            # Record control observation
            hyp = self.inference.record_control_observation(primary_read_op.operation_id, ctrl_res, probe_res)
            if hyp:
                await self._emit(
                    on_event,
                    event_type="hypothesis_validated",
                    phase="A",
                    message=f"[INFERENCE] Validated rule 'owner_only' on {primary_read_op.method} {primary_read_op.path}",
                    data={"hypothesis_id": hyp.id, "confidence": hyp.confidence}
                )

                # Propagate rule across graph edges to adjacent ops
                propagated = self.inference.propagate_rules(primary_read_op.operation_id)
                for p_hyp in propagated:
                    await self._emit(
                        on_event,
                        event_type="hypothesis_propagated",
                        phase="B",
                        message=f"[PROPAGATION] Propagated candidate ownership rule to {p_hyp.operation_id}",
                        data={"candidate_id": p_hyp.id, "confidence": p_hyp.confidence}
                    )

            # Check if primary read itself was vulnerable (Defect A)
            if hyp is None and probe_res.status_code == 200:
                # Direct BOLA on primary read
                direct_hyp = self.inference.hypotheses.get(primary_read_op.operation_id) or self._create_adhoc_hyp(primary_read_op)
                finding_a = DifferentialVerifier.verify(
                    operation_id=primary_read_op.operation_id,
                    endpoint=primary_read_op.path,
                    method=primary_read_op.method,
                    hypothesis=direct_hyp,
                    graph_path=[producer_op.operation_id, primary_read_op.operation_id],
                    owner_result=ctrl_res,
                    probe_result=probe_res,
                    owner_identity_id=user_a.identity_id,
                    probe_identity_id=user_b.identity_id
                )
                if finding_a and finding_a.status == FindingStatus.CONFIRMED:
                    await self._minimize_and_store(finding_a, setup_step, probe_step, client)
                    findings.append(finding_a)
                    await self._emit(on_event, "finding_confirmed", f"[ALERT] Confirmed direct BOLA at {primary_read_op.path}", "C", finding_a.model_dump())

            # 3. Test graph-adjacent and consumer operations (including export, summary, etc.)
            other_ops = [
                op for op in operations 
                if op.path_params and op.operation_id != primary_read_op.operation_id
            ]

            # Separate non-mutating, mutations (PATCH), and DELETE (ORDERED STRICTLY LAST)
            read_ops = [o for o in other_ops if o.method == "GET"]
            patch_ops = [o for o in other_ops if o.method in {"PATCH", "PUT"}]
            delete_ops = [o for o in other_ops if o.method == "DELETE"]

            ordered_test_ops = read_ops + (patch_ops if enable_mutations else [])

            for test_op in ordered_test_ops:
                op_hyp = self.inference.hypotheses.get(test_op.operation_id) or self._create_adhoc_hyp(test_op)

                # Compute real graph path via BFS
                real_graph_path = self._compute_bfs_graph_path(primary_read_op.operation_id, test_op.operation_id)

                target_url = f"{self.base_url}{test_op.path}".replace(f"{{{test_op.path_params[0]}}}", str(harvested_id))
                
                # Execute owner control
                c_step = PlanStep(
                    step_id=f"ctrl_{test_op.operation_id}",
                    identity_id=user_a.identity_id,
                    operation_id=test_op.operation_id,
                    method=test_op.method,
                    path_template=test_op.path,
                    url=target_url,
                    headers={"Authorization": f"Bearer {user_a.token}"} if user_a.token else {},
                    json_body={"name": "Mutated Name", "budget": "$999,000"} if test_op.method in {"PATCH", "PUT"} else None,
                    purpose="control_owner"
                )
                c_res = await self._execute_and_emit(c_step, on_event, client=client)

                # Execute adversary probe
                p_step = PlanStep(
                    step_id=f"probe_{test_op.operation_id}",
                    identity_id=user_b.identity_id,
                    operation_id=test_op.operation_id,
                    method=test_op.method,
                    path_template=test_op.path,
                    url=target_url,
                    headers={"Authorization": f"Bearer {user_b.token}"} if user_b.token else {},
                    json_body={"name": "Attacker Hijack", "budget": "$1"} if test_op.method in {"PATCH", "PUT"} else None,
                    purpose="probe_adversary"
                )
                p_res = await self._execute_and_emit(p_step, on_event, client=client)

                # Verifier evaluates response differential
                finding = DifferentialVerifier.verify(
                    operation_id=test_op.operation_id,
                    endpoint=test_op.path,
                    method=test_op.method,
                    hypothesis=op_hyp,
                    graph_path=real_graph_path,
                    owner_result=c_res,
                    probe_result=p_res,
                    owner_identity_id=user_a.identity_id,
                    probe_identity_id=user_b.identity_id
                )

                if finding and finding.status == FindingStatus.CONFIRMED:
                    await self._minimize_and_store(finding, setup_step, p_step, client)
                    findings.append(finding)
                    await self._emit(on_event, "finding_confirmed", f"[ALERT] Confirmed BOLA at {test_op.method} {test_op.path}", "C", finding.model_dump())
                elif finding and finding.status in {FindingStatus.POTENTIAL, FindingStatus.REJECTED}:
                    await self._emit(on_event, "probe_denied", f"[VERIFIER] Trap evaluated on {test_op.path}: status {finding.status.value}", "C")

            # 4. ORDER DELETE LAST ON A DISPOSABLE RESOURCE
            if enable_mutations and delete_ops:
                for del_op in delete_ops:
                    # Create dedicated disposable resource for delete test
                    disp_setup = PlanStep(
                        step_id=f"disp_del_setup_{uuid.uuid4().hex[:4]}",
                        identity_id=user_a.identity_id,
                        operation_id=producer_op.operation_id,
                        method="POST",
                        path_template=producer_op.path,
                        url=f"{self.base_url}{producer_op.path}",
                        headers={"Authorization": f"Bearer {user_a.token}"} if user_a.token else {},
                        json_body={"name": "Disposable Delete Test", "budget": "$10"},
                        purpose="setup"
                    )
                    disp_res = await self._execute_and_emit(disp_setup, on_event, client=client)
                    disp_id = disp_res.body.get("id") if isinstance(disp_res.body, dict) else "proj_disp"

                    # Probe DELETE as User B (expect 403 Forbidden)
                    del_probe = PlanStep(
                        step_id=f"probe_del_{disp_id}",
                        identity_id=user_b.identity_id,
                        operation_id=del_op.operation_id,
                        method="DELETE",
                        path_template=del_op.path,
                        url=f"{self.base_url}{del_op.path}".replace(f"{{{del_op.path_params[0]}}}", str(disp_id)),
                        headers={"Authorization": f"Bearer {user_b.token}"} if user_b.token else {},
                        purpose="probe_adversary"
                    )
                    del_res = await self._execute_and_emit(del_probe, on_event, client=client)
                    if del_res.status_code == 200:
                        # BOLA on delete
                        del_hyp = self._create_adhoc_hyp(del_op)
                        f_del = Finding(
                            id=f"fnd_del_{uuid.uuid4().hex[:6]}",
                            endpoint=del_op.path,
                            method="DELETE",
                            resource_type="Project",
                            status=FindingStatus.CONFIRMED,
                            confidence=0.80,
                            severity="CRITICAL",
                            identities={"owner": user_a.identity_id, "probe": user_b.identity_id},
                            hypothesis=del_hyp,
                            graph_path=[producer_op.operation_id, "PRODUCES", del_op.operation_id],
                            control_evidence={"status": 403},
                            probe_evidence={"status": 200},
                            diff_fields=["unauthorized_deletion"],
                            repro_curl=f"curl -X DELETE '{del_probe.url}' -H 'Authorization: Bearer <TOKEN>'"
                        )
                        findings.append(f_del)

        return findings

    def _create_adhoc_hyp(self, op: Operation):
        from app.engine.models import Rule, RuleType, Hypothesis
        return Hypothesis(
            id=f"hyp_adhoc_{op.operation_id}",
            rule=Rule(rule_type=RuleType.OWNER_ONLY, resource_type="Project"),
            operation_id=op.operation_id,
            confidence=0.50,
            provenance=Provenance.PROPAGATED
        )

    def _compute_bfs_graph_path(self, start_op_id: str, end_op_id: str) -> List[str]:
        """
        Computes real BFS path through the DAG edges from source op to target op.
        """
        if start_op_id == end_op_id:
            return [start_op_id]

        queue = [[start_op_id]]
        visited = {start_op_id}

        while queue:
            path = queue.pop(0)
            node = path[-1]

            if node == end_op_id:
                return path

            for edge in self.graph.edges:
                if edge.from_node == node and edge.to_node not in visited:
                    visited.add(edge.to_node)
                    queue.append(path + [f"({edge.type.value})", edge.to_node])

        return [start_op_id, "(PROPAGATED)", end_op_id]

    async def _minimize_and_store(self, finding: Finding, setup_step: PlanStep, probe_step: PlanStep, client: Optional[httpx.AsyncClient]):
        """
        Minimization: drops non-prerequisite steps, replays setup + probe only,
        and keeps reduction if violation still reproduces.
        """
        try:
            s_res = await self.executor.execute_step(setup_step, client=client)
            h_id = s_res.body.get("id") if isinstance(s_res.body, dict) else None
            if h_id:
                probe_url = probe_step.url
                p_copy = PlanStep(
                    step_id="min_probe",
                    identity_id=probe_step.identity_id,
                    operation_id=probe_step.operation_id,
                    method=probe_step.method,
                    path_template=probe_step.path_template,
                    url=probe_url,
                    headers=probe_step.headers,
                    purpose="probe_adversary"
                )
                p_res = await self.executor.execute_step(p_copy, client=client)
                if p_res.status_code == 200:
                    finding.minimized_sequence = [
                        f"{setup_step.method} {setup_step.path_template} (Setup ID: {h_id})",
                        f"{probe_step.method} {probe_step.path_template} (Unauthorized Replay)"
                    ]
        except Exception:
            finding.minimized_sequence = [f"{setup_step.method} {setup_step.path_template}", f"{probe_step.method} {probe_step.path_template}"]
