import re
import yaml
import json
from typing import Dict, Any, List, Tuple
from openapi_spec_validator import validate
from app.engine.models import Operation

DEMO_SPEC_YAML = """
openapi: 3.0.3
info:
  title: Enterprise Project & Billing Services API
  version: 1.0.0
  description: Multi-tenant project and invoicing management API
paths:
  /auth/login:
    post:
      summary: Authenticate identity and obtain bearer token
      operationId: login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthToken'

  /projects:
    post:
      summary: Create a new project resource
      operationId: createProject
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateProjectInput'
      responses:
        '201':
          description: Project created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'

  /projects/{project_id}:
    get:
      summary: Get project details
      operationId: getProjectById
      security:
        - bearerAuth: []
      parameters:
        - name: project_id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Project retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'
        '403':
          description: Forbidden
        '404':
          description: Project not found

    patch:
      summary: Update project properties
      operationId: updateProject
      security:
        - bearerAuth: []
      parameters:
        - name: project_id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateProjectInput'
      responses:
        '200':
          description: Updated project
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'

    delete:
      summary: Delete project resource
      operationId: deleteProject
      security:
        - bearerAuth: []
      parameters:
        - name: project_id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Deleted successfully

  /projects/{project_id}/export:
    get:
      summary: Export financial and billing data for a project
      operationId: exportProjectBilling
      security:
        - bearerAuth: []
      parameters:
        - name: project_id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Project export payload
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectExport'

  /projects/{project_id}/summary:
    get:
      summary: Get brief public project stats (verifier trap)
      operationId: getProjectSummary
      security:
        - bearerAuth: []
      parameters:
        - name: project_id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Public summary stats

  /projects/{project_id}/members:
    get:
      summary: Get project members (unimplemented route returning 404)
      operationId: getProjectMembers
      security:
        - bearerAuth: []
      parameters:
        - name: project_id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Project member list

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer

  schemas:
    LoginRequest:
      type: object
      required:
        - username
        - password
      properties:
        username:
          type: string
        password:
          type: string

    AuthToken:
      type: object
      required:
        - token
      properties:
        token:
          type: string
        user_id:
          type: string
        role:
          type: string

    CreateProjectInput:
      type: object
      required:
        - name
      properties:
        name:
          type: string
        confidential_data:
          type: string
        budget:
          type: string

    UpdateProjectInput:
      type: object
      properties:
        name:
          type: string
        budget:
          type: string

    Project:
      type: object
      required:
        - id
        - owner_id
        - name
      properties:
        id:
          type: string
        owner_id:
          type: string
        owner_email:
          type: string
        name:
          type: string
        confidential_data:
          type: string
        budget:
          type: string
        billing_card:
          type: string

    ProjectExport:
      type: object
      required:
        - export_id
        - project_id
      properties:
        export_id:
          type: string
        project_id:
          type: string
        owner_email:
          type: string
        financial_payload:
          type: object
"""

class OpenAPIParser:
    """
    Parses and normalizes OpenAPI 3.x specifications (YAML/JSON) with local $ref resolution.
    """
    def __init__(self, raw_spec: str):
        if raw_spec.strip().startswith("{"):
            self.spec_dict = json.loads(raw_spec)
        else:
            self.spec_dict = yaml.safe_load(raw_spec)
            
        # Validate specification structure
        validate(self.spec_dict)
        self.resolved_spec = self._resolve_refs(self.spec_dict, self.spec_dict)

    def _resolve_refs(self, element: Any, root: Dict[str, Any]) -> Any:
        if isinstance(element, dict):
            if "$ref" in element and isinstance(element["$ref"], str) and element["$ref"].startswith("#/"):
                ref_path = element["$ref"][2:].split("/")
                target = root
                for part in ref_path:
                    target = target.get(part, {})
                # Resolve recursively
                return self._resolve_refs(target, root)
            return {k: self._resolve_refs(v, root) for k, v in element.items()}
        elif isinstance(element, list):
            return [self._resolve_refs(item, root) for item in element]
        return element

    def extract_operations(self) -> List[Operation]:
        operations = []
        paths = self.spec_dict.get("paths", {})
        
        for path_str, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue
            for method, op_data in path_item.items():
                if method.lower() not in {"get", "post", "put", "patch", "delete"}:
                    continue
                
                op_id = op_data.get("operationId") or f"{method.lower()}_{re.sub(r'[^a-zA-Z0-9]', '_', path_str)}"
                
                # Extract path parameters
                path_params = re.findall(r"\{([a-zA-Z0-9_]+)\}", path_str)
                
                # Query params from parameters list
                query_params = []
                for param in op_data.get("parameters", []):
                    if isinstance(param, dict) and param.get("in") == "query":
                        query_params.append(param.get("name"))
                
                # Request schema ref
                req_ref = None
                rb = op_data.get("requestBody", {})
                if isinstance(rb, dict):
                    content = rb.get("content", {}).get("application/json", {})
                    req_ref = content.get("schema", {}).get("$ref")
                    
                # Response schema refs
                res_refs = {}
                for status_code, res_obj in op_data.get("responses", {}).items():
                    if isinstance(res_obj, dict):
                        content = res_obj.get("content", {}).get("application/json", {})
                        ref = content.get("schema", {}).get("$ref")
                        if ref:
                            res_refs[str(status_code)] = ref
                            
                # Security schemes
                security = []
                for sec_req in op_data.get("security", []):
                    if isinstance(sec_req, dict):
                        security.extend(sec_req.keys())
                        
                operations.append(Operation(
                    id=op_id,
                    method=method.upper(),
                    path=path_str,
                    operation_id=op_id,
                    path_params=path_params,
                    query_params=query_params,
                    request_schema_ref=req_ref,
                    response_schema_refs=res_refs,
                    security_schemes=security,
                    tags=op_data.get("tags", []),
                    summary=op_data.get("summary")
                ))
                
        return operations
