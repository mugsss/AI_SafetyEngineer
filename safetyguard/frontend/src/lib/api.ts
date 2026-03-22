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
import type { Run, RunListResponse, CreateRunInput } from '@/types/run';
import type { SafetyReport, DependencyGraph } from '@/types/report';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Use for user-facing error messages (e.g. “cannot reach API”). */
export function getApiBaseUrl(): string {
  return baseURL;
}

/**
 * Turns axios / FastAPI errors into a readable string for the UI.
 */
export function formatApiError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return (
        `Cannot reach the API at ${baseURL}. ` +
        'Start the SafetyGuard backend (see safetyguard/README.md): `cd backend && uvicorn app.main:app --reload`. ' +
        'If the UI uses a different host/port, set NEXT_PUBLIC_API_URL in frontend/.env.local to match.'
      );
    }
    const data = error.response.data as { detail?: unknown } | undefined;
    const detail = data?.detail;
    if (typeof detail === 'string') return detail;
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
    const { data } = await client.get<SafetyReport>(`/api/reports/${runId}`);
    return data;
  },

  async getDependencyGraph(runId: string): Promise<DependencyGraph> {
    const { data } = await client.get<DependencyGraph>(
      `/api/reports/${runId}/dependency-graph`,
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
