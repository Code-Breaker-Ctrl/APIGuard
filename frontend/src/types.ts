export type NodeType = 'operation' | 'resource_type' | 'identifier' | 'identity' | 'evidence';
export type EdgeType = 'OPERATES_ON' | 'PRODUCES' | 'CONSUMES' | 'REFERENCES' | 'NESTED_UNDER' | 'OBSERVED_ACCESS' | 'DENIED_ACCESS' | 'SUSPECTS_POLICY' | 'SUPPORTED_BY';
export type FindingStatus = 'confirmed' | 'likely' | 'potential' | 'inconclusive' | 'not_reproducible' | 'rejected';

export interface BackendNode {
  id: string;
  label: string;
  type: NodeType;
  metadata: Record<string, any>;
}

export interface BackendEdge {
  from_node: string;
  to_node: string;
  type: EdgeType;
  confidence: number;
  provenance: string;
  observation_ids: string[];
}

export interface GraphResponse {
  nodes: BackendNode[];
  edges: BackendEdge[];
}

export interface ScanEvent {
  event_id: string;
  scan_id: string;
  timestamp: number;
  event_type: 'request_sent' | 'response_received' | 'hypothesis_validated' | 'hypothesis_propagated' | 'finding_confirmed' | 'control_secure' | 'probe_denied' | 'scan_completed' | 'log' | 'error';
  phase?: 'A' | 'B' | 'C';
  message: string;
  data?: Record<string, any>;
}

export interface Finding {
  id: string;
  endpoint: string;
  method: string;
  resource_type: string;
  status: FindingStatus;
  confidence: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  identities: {
    owner: string;
    probe: string;
  };
  hypothesis: {
    id: string;
    rule: {
      rule_type: string;
      resource_type: string;
      owner_field?: string;
    };
    operation_id: string;
    confidence: number;
    provenance: string;
    status: string;
  };
  graph_path: string[];
  control_evidence: {
    status: number;
    body?: any;
  };
  probe_evidence: {
    status: number;
    body?: any;
    error?: string;
  };
  diff_fields: string[];
  repro_curl: string;
  reproduction_steps?: string[];
  minimized_sequence?: string[];
}

export interface BenchmarkData {
  timestamp: string;
  target: string;
  variants_tested: number;
  aggregate_metrics: {
    graph_guided: {
      total_confirmed: number;
      total_ground_truth: number;
      aggregate_recall: number;
      requests_per_finding: number;
    };
    baseline: {
      total_confirmed: number;
      total_ground_truth: number;
      aggregate_recall: number;
      requests_per_finding: number;
    };
  };
  variants: Record<string, {
    description: string;
    ground_truth_count: number;
    graph_guided: {
      confirmed: number;
      recall: number | null;
      precision: number;
      requests: number;
      req_per_finding: number | null;
      time_to_first_ms: number | null;
      duration_ms: number;
    };
    baseline: {
      confirmed: number;
      recall: number | null;
      precision: number;
      requests: number;
      req_per_finding: number | null;
      time_to_first_ms: number | null;
      duration_ms: number;
    };
  }>;
  ablations?: Record<string, any>;
}
