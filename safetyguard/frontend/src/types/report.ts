export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Dimension =
  | 'risk' | 'security' | 'hallucinations' | 'failures'
  | 'cost' | 'privacy' | 'observability' | 'performance'
  | 'resources' | 'redteam';

export interface Finding {
  id: string;
  dimension: Dimension;
  title: string;
  severity: Severity;
  likelihood?: number;
  impact?: number;
  description: string;
  evidence: {
    file: string;
    line?: number;
    snippet: string;
  };
  suggested_fix: string;
  references?: string[];
}

export interface DimensionResult {
  score: number;
  summary: string;
  findings: Finding[];
  worst_severity: Severity;
  finding_count: number;
  /** Risk dimension only */
  risk_safety_score?: number;
  risk_severity?: number;
  severity_label?: string;
}

export interface SafetyReport {
  id: string;
  run_id: string;
  overall_score: number;
  executive_summary: string;
  dimension_scores: Partial<Record<Dimension, number>>;
  findings: Partial<Record<Dimension, DimensionResult>>;
  dependency_graph: DependencyGraph;
  created_at: string;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'llm' | 'api' | 'database' | 'queue' | 'external';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface GraphEdge {
  source: string;
  target: string;
  relation?: string;
}
