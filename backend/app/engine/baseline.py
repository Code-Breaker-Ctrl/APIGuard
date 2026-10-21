from typing import List, Dict, Optional
from app.engine.models import (
    Operation, IdentityProfile, Finding, Rule, RuleType, FindingStatus, ExecutionResult
)
from app.engine.executor import SafeExecutor
from app.engine.policy import PolicyEvaluator, PolicyResult
from app.engine.verifier import DifferentialVerifier

class BaselineScanner:
    """
    Endpoint-by-endpoint baseline scanner.
    Uses the exact same executor and request budget, but tests operations in isolation
    without a resource graph, without rule propagation, and without sibling knowledge.
    """
    def __init__(
        self,
        executor: SafeExecutor,
        base_url: str = "http://localhost:8000/target",
        oracle_mode: bool = False
    ):
        self.executor = executor
        self.base_url = base_url.rstrip("/")
        self.oracle_mode = oracle_mode

        # Documented/configured rules known to the baseline scanner
        self.known_rules: Dict[str, Rule] = {
            "getProjectById": Rule(rule_type=RuleType.OWNER_ONLY, resource_type="Project"),
            "deleteProject": Rule(rule_type=RuleType.OWNER_ONLY, resource_type="Project"),
            "updateProject": Rule(rule_type=RuleType.OWNER_ONLY, resource_type="Project")
        }
        if self.oracle_mode:
            # Oracle baseline has documented rules for everything including export
            self.known_rules["exportProjectBilling"] = Rule(rule_type=RuleType.OWNER_ONLY, resource_type="Project")

    async def scan_operations(
        self,
        operations: List[Operation],
        user_a: IdentityProfile,
        user_b: IdentityProfile,
        harvested_entity_id: str = "proj_42"
    ) -> List[Finding]:
        findings = []

        for op in operations:
            if op.method != "GET":
                continue

            rule = self.known_rules.get(op.operation_id)
            eval_result = PolicyEvaluator.evaluate(rule, user_b.identity_id, user_a.identity_id)

            # If no rule exists for this operation, evaluate returns UNKNOWN -> Counted as no finding!
            if eval_result == PolicyResult.UNKNOWN:
                continue

            url = f"{self.base_url}{op.path}".replace("{project_id}", harvested_entity_id)

            # 1. Control step as User A
            from app.engine.models import PlanStep
            ctrl_step = PlanStep(
                step_id=f"base_ctrl_{op.operation_id}",
                identity_id=user_a.identity_id,
                operation_id=op.operation_id,
                method=op.method,
                path_template=op.path,
                url=url,
                headers={"Authorization": f"Bearer {user_a.token}"}
            )
            ctrl_res = await self.executor.execute_step(ctrl_step)

            # 2. Probe step as User B
            probe_step = PlanStep(
                step_id=f"base_probe_{op.operation_id}",
                identity_id=user_b.identity_id,
                operation_id=op.operation_id,
                method=op.method,
                path_template=op.path,
                url=url,
                headers={"Authorization": f"Bearer {user_b.token}"}
            )
            probe_res = await self.executor.execute_step(probe_step)

            # Verify response
            from app.engine.models import Hypothesis, Provenance
            hyp = Hypothesis(
                id=f"hyp_base_{op.operation_id}",
                rule=rule,
                operation_id=op.operation_id,
                confidence=0.85,
                provenance=Provenance.DOCUMENTED
            )
            finding = DifferentialVerifier.verify(
                operation_id=op.operation_id,
                endpoint=op.path,
                method=op.method,
                hypothesis=hyp,
                graph_path=[op.operation_id],
                owner_result=ctrl_res,
                probe_result=probe_res
            )
            if finding and finding.status == FindingStatus.CONFIRMED:
                findings.append(finding)

        return findings
