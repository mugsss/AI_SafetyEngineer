import axios, { AxiosInstance, isAxiosError } from 'axios';
import type { SimulateInput, SimulationResult } from '@/types/api';
import type { PlaygroundInput, PlaygroundResult } from '@/types/api';
import type {
  AppSettings,
  UploadResponse,
  WorkflowWebhook,
  WorkflowWebhookCreateInput,
  WorkflowWebhookUpdateInput,
} from '@/types/api';
import type {
  Run,
  RunListResponse,
  CreateRunInput,
  StoredCustomAgentSpec,
} from '@/types/run';
import type { SafetyReport, DependencyGraph } from '@/types/report';

/**
 * Axios base URL:
 * - If `NEXT_PUBLIC_API_URL` is set → call FastAPI directly (must match uvicorn host/port).
 * - If unset in the browser → `''` so requests go to the Next origin and `next.config.mjs`
 *   rewrites `/api/*` to FastAPI (avoids wrong-host 404s).
 * - On the server (SSR) → default `http://127.0.0.1:8000` when env is unset.
 */
function computeAxiosBaseURL(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return '';
  return 'http://127.0.0.1:8000';
}

const baseURL = computeAxiosBaseURL();

/** Origin for EventSource / WebSocket — must hit FastAPI directly (rewrites do not apply). */
export function getBackendOriginForStreams(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/+$/, '');
  return 'http://127.0.0.1:8000';
}

/** Use for user-facing error messages (e.g. “cannot reach API”). */
export function getApiBaseUrl(): string {
  return baseURL || '(same origin → proxied to backend)';
}

/**
 * Turns axios / FastAPI errors into a readable string for the UI.
 */
export function formatApiError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      const hint =
        baseURL === ''
          ? 'Ensure FastAPI is running on http://127.0.0.1:8000 (Next proxies /api/* there). '
          : `Cannot reach ${baseURL}. `;
      return (
        hint +
        'Start the backend: `cd safetyguard/backend && py -3.11 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`. ' +
        'Set NEXT_PUBLIC_API_URL in frontend/.env.local if the API is not on 127.0.0.1:8000.'
      );
    }
    const data = error.response.data as { detail?: unknown } | undefined;
    const detail = data?.detail;
    if (typeof detail === 'string') {
      if (error.response.status === 404 && detail === 'Not Found') {
        const u = error.config?.url ?? '';
        const target = baseURL || `same-origin → ${getBackendOriginForStreams()}`;
        return (
          `API returned 404 Not Found for ${u}. ` +
          `Target: ${target}. ` +
          `Restart uvicorn from safetyguard/backend: py -3.11 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000. ` +
          `Confirm ${getBackendOriginForStreams()}/docs lists POST /api/custom-agents/generate. ` +
          `Restart npm run dev after changing NEXT_PUBLIC_API_URL.`
        );
      }
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          typeof item === 'object' && item && 'msg' in item
            ? String((item as { msg: string }).msg)
            : JSON.stringify(item),
        )
        .join(' ');
    }
    if (detail != null && typeof detail === 'object') {
      return JSON.stringify(detail);
    }
    return error.response.statusText || error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

const client: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  /** Default; long-running analysis uses overrides where needed. */
  timeout: 120_000,
});

export const runsApi = {
  async create(input: CreateRunInput): Promise<Run> {
    const { data } = await client.post<Run>('/api/runs', input);
    return data;
  },

  async list(page = 1, limit = 20): Promise<RunListResponse> {
    const { data } = await client.get<RunListResponse>('/api/runs', {
      params: { page, limit },
      timeout: 30_000,
    });
    return data;
  },

  async get(runId: string): Promise<Run> {
    const { data } = await client.get<Run>(`/api/runs/${runId}`);
    return data;
  },

  async delete(runId: string): Promise<void> {
    await client.delete(`/api/runs/${runId}`);
  },
};

export const reportsApi = {
  async get(runId: string): Promise<SafetyReport> {
    const { data } = await client.get<SafetyReport>(`/api/reports/${runId}`, {
      timeout: 45_000,
    });
    return data;
  },

  async getDependencyGraph(runId: string): Promise<DependencyGraph> {
    const { data } = await client.get<DependencyGraph>(
      `/api/reports/${runId}/dependency-graph`,
      { timeout: 45_000 },
    );
    return data;
  },
};

export interface GenerateCustomAgentInput {
  name: string;
  mission: string;
  base_dimension: string;
  constraints?: string | null;
  output_emphasis?: string | null;
  /** Write `app/agents/generated/{slug}/agent.py` + `system_prompt.txt` on the API server. */
  export_generated_module?: boolean;
}

export interface GenerateCustomAgentResponse {
  spec: StoredCustomAgentSpec;
  exported_paths?: string[] | null;
}

export interface ExportAgentPackageInput {
  slug: string;
  display_name: string;
  base_dimension: string;
  system_prompt: string;
}

export interface ExportAgentPackageResponse {
  exported_paths: string[];
}

export const customAgentsApi = {
  async generate(input: GenerateCustomAgentInput): Promise<GenerateCustomAgentResponse> {
    const { data } = await client.post<GenerateCustomAgentResponse>(
      '/api/custom-agents/generate',
      input,
      { timeout: 120_000 },
    );
    return data;
  },

  async exportModule(input: ExportAgentPackageInput): Promise<ExportAgentPackageResponse> {
    const { data } = await client.post<ExportAgentPackageResponse>(
      '/api/custom-agents/export-module',
      input,
      { timeout: 60_000 },
    );
    return data;
  },
};

export const simulatorApi = {
  async simulate(input: SimulateInput): Promise<SimulationResult> {
    const { data } = await client.post<SimulationResult>('/api/simulator', input);
    return data;
  },
};

export const playgroundApi = {
  async query(input: PlaygroundInput): Promise<PlaygroundResult> {
    const { data } = await client.post<PlaygroundResult>(
      '/api/playground',
      input,
    );
    return data;
  },
};

export const settingsApi = {
  async get(): Promise<AppSettings> {
    const { data } = await client.get<AppSettings>('/api/settings');
    return data;
  },

  async update(settings: Partial<AppSettings>): Promise<AppSettings> {
    const { data } = await client.put<AppSettings>('/api/settings', settings);
    return data;
  },

  async testN8nApi(overrides?: {
    n8n_base_url?: string;
    n8n_api_key?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { data } = await client.post<{ success: boolean; message: string }>(
      '/api/settings/n8n-api-test',
      overrides ?? {},
    );
    return data;
  },

  async testApiKey(
    provider: string,
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const { data } = await client.post<{ success: boolean; message: string }>(
      '/api/settings/test-key',
      { provider, key: apiKey },
    );
    return { valid: data.success, error: data.success ? undefined : data.message };
  },

  workflowWebhooks: {
    async list(): Promise<WorkflowWebhook[]> {
      const { data } = await client.get<WorkflowWebhook[]>(
        '/api/settings/workflow-webhooks',
      );
      return data;
    },
    async create(body: WorkflowWebhookCreateInput): Promise<WorkflowWebhook> {
      const { data } = await client.post<WorkflowWebhook>(
        '/api/settings/workflow-webhooks',
        body,
      );
      return data;
    },
    async update(
      id: string,
      body: WorkflowWebhookUpdateInput,
    ): Promise<WorkflowWebhook> {
      const { data } = await client.put<WorkflowWebhook>(
        `/api/settings/workflow-webhooks/${id}`,
        body,
      );
      return data;
    },
    async remove(id: string): Promise<void> {
      await client.delete(`/api/settings/workflow-webhooks/${id}`);
    },
    async test(url: string, secret?: string): Promise<{ success: boolean; message: string }> {
      const { data } = await client.post<{ success: boolean; message: string }>(
        '/api/settings/workflow-webhooks/test',
        { url, secret: secret || undefined },
      );
      return data;
    },
    async trigger(runId?: string): Promise<{ success: boolean; message: string }> {
      const { data } = await client.post<{ success: boolean; message: string }>(
        '/api/settings/workflow-webhooks/trigger',
        runId ? { run_id: runId } : {},
      );
      return data;
    },
  },
};

export const miroApi = {
  async createBoard(runId: string): Promise<{ board_id: string; board_url: string }> {
    const { data } = await client.post<{ board_id: string; board_url: string }>(
      `/api/reports/${runId}/miro-board`,
    );
    return data;
  },
};

export const uploadsApi = {
  async uploadZip(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await client.post<UploadResponse>('/api/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};

export default client;
