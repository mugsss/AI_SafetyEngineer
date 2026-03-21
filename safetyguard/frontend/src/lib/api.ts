import axios, { AxiosInstance } from 'axios';
import { getToken, clearToken } from './auth';
import type { AuthResponse, RegisterInput, User } from '@/types/api';
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

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const { data } = await client.post<AuthResponse>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  },

  async register(input: RegisterInput): Promise<AuthResponse> {
    const { data } = await client.post<AuthResponse>('/auth/register', input);
    return data;
  },

  async me(): Promise<User> {
    const { data } = await client.get<User>('/auth/me');
    return data;
  },
};

export const runsApi = {
  async create(input: CreateRunInput): Promise<Run> {
    const { data } = await client.post<Run>('/runs', input);
    return data;
  },

  async list(page = 1, limit = 20): Promise<RunListResponse> {
    const { data } = await client.get<RunListResponse>('/runs', {
      params: { page, limit },
    });
    return data;
  },

  async get(runId: string): Promise<Run> {
    const { data } = await client.get<Run>(`/runs/${runId}`);
    return data;
  },

  async delete(runId: string): Promise<void> {
    await client.delete(`/runs/${runId}`);
  },
};

export const reportsApi = {
  async get(runId: string): Promise<SafetyReport> {
    const { data } = await client.get<SafetyReport>(`/reports/${runId}`);
    return data;
  },

  async getDependencyGraph(runId: string): Promise<DependencyGraph> {
    const { data } = await client.get<DependencyGraph>(
      `/reports/${runId}/dependency-graph`,
    );
    return data;
  },
};

export const simulatorApi = {
  async simulate(input: SimulateInput): Promise<SimulationResult> {
    const { data } = await client.post<SimulationResult>('/simulator', input);
    return data;
  },
};

export const playgroundApi = {
  async query(input: PlaygroundInput): Promise<PlaygroundResult> {
    const { data } = await client.post<PlaygroundResult>(
      '/playground',
      input,
    );
    return data;
  },
};

export const settingsApi = {
  async get(): Promise<AppSettings> {
    const { data } = await client.get<AppSettings>('/settings');
    return data;
  },

  async update(settings: Partial<AppSettings>): Promise<AppSettings> {
    const { data } = await client.put<AppSettings>('/settings', settings);
    return data;
  },

  async testApiKey(
    provider: string,
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const { data } = await client.post<{ valid: boolean; error?: string }>(
      '/settings/test-key',
      { provider, api_key: apiKey },
    );
    return data;
  },
};

export const uploadsApi = {
  async uploadZip(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await client.post<UploadResponse>('/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};

export default client;
