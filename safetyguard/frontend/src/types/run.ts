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

export interface CreateRunInput {
  repo_url?: string;
  upload_id?: string;
  branch: string;
  enabled_agents: Record<string, boolean>;
}
