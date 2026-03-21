import axios, { AxiosInstance } from 'axios';
import type { SimulateInput, SimulationResult } from '@/types/api';
import type { PlaygroundInput, PlaygroundResult } from '@/types/api';
import type { AppSettings, UploadResponse } from '@/types/api';
import type { Run, RunListResponse, CreateRunInput } from '@/types/run';
import type { SafetyReport, DependencyGraph } from '@/types/report';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const client: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
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
