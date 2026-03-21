export interface SimulateInput {
  run_id: string;
  node_id: string;
  failure_type: 'full_outage' | 'high_latency' | 'partial_degradation';
}

export interface SimulationResult {
  impacted_nodes: string[];
  narrative: string;
  dimension_impacts: Record<string, number>;
}

export interface PlaygroundInput {
  prompt: string;
  app_base_url?: string;
  model_profile?: string;
}

export interface PlaygroundResult {
  response_text: string;
  hallucination_score: number;
  safety_flags: string[];
  explanation: string;
}

export interface AppSettings {
  featherless_api_key?: string;
  webhook_url?: string;
  webhook_secret?: string;
  fail_ci_on_critical: boolean;
  notification_email?: string;
  slack_webhook_url?: string;
  notify_on_completion: boolean;
  notify_on_score_drop: boolean;
  notify_on_critical: boolean;
  score_threshold: number;
}

export interface UploadResponse {
  upload_id: string;
  filename: string;
  size: number;
}
