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
  /** n8n instance root URL, e.g. https://yourname.app.n8n.cloud */
  n8n_base_url?: string;
  /** Write-only; always empty in GET responses */
  n8n_api_key?: string;
  n8n_api_key_set?: boolean;
  fail_ci_on_critical: boolean;
  notification_email?: string;
  slack_webhook_url?: string;
  notify_on_completion: boolean;
  notify_on_score_drop: boolean;
  notify_on_critical: boolean;
  score_threshold: number;
}

export interface WorkflowWebhook {
  id: string;
  name: string;
  url: string;
  has_secret: boolean;
  enabled: boolean;
  created_at: string;
}

export interface WorkflowWebhookCreateInput {
  name?: string;
  url: string;
  secret?: string;
  enabled?: boolean;
}

export interface WorkflowWebhookUpdateInput {
  name?: string;
  url?: string;
  secret?: string;
  enabled?: boolean;
}

export interface UploadResponse {
  upload_id: string;
  filename: string;
  size: number;
}
