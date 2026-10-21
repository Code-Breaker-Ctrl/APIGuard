import uuid
from typing import List, Dict, Any, Optional
from app.engine.models import Operation, PlanStep, IdentityProfile
from app.engine.graph import ResourceGraph

class TestPlanner:
    __test__ = False
    """
    Builds minimal, dependency-aware owner-versus-non-owner test sequences.
    Ensures prerequisites are created as Identity A, harvested, and probed as Identity B.
    """
    def __init__(self, graph: ResourceGraph, base_url: str = "http://localhost:8000"):
        self.graph = graph
        self.base_url = base_url.rstrip("/")

    def plan_audit_for_operation(
        self,
        target_op: Operation,
        user_a: IdentityProfile,
        user_b: IdentityProfile,
        enable_mutations: bool = False
    ) -> List[PlanStep]:
        steps = []
        is_mutation = target_op.method in {"POST", "PUT", "PATCH", "DELETE"}

        # Refuse mutating tests unless explicitly enabled and cleanup declared
        if is_mutation and not enable_mutations and target_op.method != "GET":
            return []

        # Check if operation consumes a dynamic identifier (e.g. {project_id})
        if target_op.path_params:
            producers = self.graph.get_producers_for_consumer(target_op.operation_id)
            if not producers:
                # Inconclusive if no producer exists to create the prerequisite entity
                return []

            producer_op, path_nodes = producers[0]

            # Step 1: Prerequisite creation as User A
            setup_id = f"step_setup_{uuid.uuid4().hex[:6]}"
            steps.append(PlanStep(
                step_id=setup_id,
                identity_id=user_a.identity_id,
                operation_id=producer_op.operation_id,
                method=producer_op.method,
                path_template=producer_op.path,
                url=f"{self.base_url}{producer_op.path}",
                headers={"Authorization": f"Bearer {user_a.token}"} if user_a.token else {},
                json_body={
                    "name": "Audit Benchmark Project",
                    "confidential_data": "CONFIDENTIAL-AEGIS-SECRET-994",
                    "budget": "$150,000"
                },
                expected_status=201,
                purpose="setup",
                cleanup=True
            ))

        # Step 2: Control step as User A (Owner)
        ctrl_id = f"step_ctrl_{uuid.uuid4().hex[:6]}"
        steps.append(PlanStep(
            step_id=ctrl_id,
            identity_id=user_a.identity_id,
            operation_id=target_op.operation_id,
            method=target_op.method,
            path_template=target_op.path,
            url=f"{self.base_url}{target_op.path}",
            headers={"Authorization": f"Bearer {user_a.token}"} if user_a.token else {},
            expected_status=200,
            purpose="control_owner",
            cleanup=False
        ))

        # Step 3: Probe step as User B (Attacker / Adversary)
        probe_id = f"step_probe_{uuid.uuid4().hex[:6]}"
        steps.append(PlanStep(
            step_id=probe_id,
            identity_id=user_b.identity_id,
            operation_id=target_op.operation_id,
            method=target_op.method,
            path_template=target_op.path,
            url=f"{self.base_url}{target_op.path}",
            headers={"Authorization": f"Bearer {user_b.token}"} if user_b.token else {},
            expected_status=403,
            purpose="probe_adversary",
            cleanup=False
        ))

        return steps
