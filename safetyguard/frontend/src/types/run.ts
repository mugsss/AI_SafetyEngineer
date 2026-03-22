import { SafetyReport } from './report';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Run {
  id: string;
  user_id: string;
  repo_url?: string;
  upload_id?: string;
  branch: string;
  status: RunStatus;
  enabled_agents: Record<string, boolean>;
  custom_agents?: StoredCustomAgentSpec[] | null;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  error_message?: string;
  report?: SafetyReport;
}

export interface RunListResponse {
  runs: Run[];
  total: number;
  page: number;
  limit: number;
}

/** User-generated agent from POST /api/custom-agents/generate; persisted on the run. */
export interface StoredCustomAgentSpec {
  slug: string;
  display_name: string;
  base_dimension: string;
  system_prompt: string;
  agent_python_stub?: string | null;
}

export interface CreateRunInput {
  repo_url?: string;
  upload_id?: string;
  branch: string;
  enabled_agents: Record<string, boolean>;
  custom_agents?: StoredCustomAgentSpec[];
}
