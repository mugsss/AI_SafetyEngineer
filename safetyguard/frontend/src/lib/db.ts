import { neon } from '@neondatabase/serverless';

// Create reusable SQL client
export const sql = neon(process.env.DATABASE_URL!);

// Types matching the database schema
export interface User {
  id: string;
  email: string;
  name: string;
  hashed_password: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRun {
  id: string;
  status: string;
  repo_url: string | null;
  upload_id: string | null;
  branch: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  n8n_execution_id: string | null;
  config: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  code_graph: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SafetyReport {
  id: string;
  run_id: string;
  category: string;
  severity: string;
  title: string;
  description: string | null;
  file_path: string | null;
  line_number: number | null;
  code_snippet: string | null;
  recommendation: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface UserAppSettings {
  id: string;
  user_id: string;
  llm_provider: string;
  llm_model: string;
  custom_api_key_encrypted: string | null;
  auto_run_analysis: boolean;
  email_notifications: boolean;
  theme: string;
  extra_settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowWebhook {
  id: string;
  user_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}
