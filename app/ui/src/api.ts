import type { AppSettings, FilesResponse, JobModel, JobResponse, JobsListResponse, ProvidersResponse } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

function normalizeBase(base: string): string {
  if (base.endsWith("/")) {
    return base.slice(0, -1);
  }
  return base;
}

function buildUrl(path: string): string {
  const normalized = normalizeBase(API_BASE);
  if (normalized.startsWith("http")) {
    return `${normalized}${path}`;
  }
  const prefix = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${prefix}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Запрос завершился с кодом ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchProviders(): Promise<ProvidersResponse> {
  return request<ProvidersResponse>("/providers");
}

export async function fetchJobs(): Promise<JobsListResponse> {
  return request<JobsListResponse>("/jobs");
}

export async function fetchFiles(): Promise<FilesResponse> {
  return request<FilesResponse>("/files");
}

export async function fetchSettings(): Promise<AppSettings> {
  return request<AppSettings>("/settings");
}

export async function createJob(body: {
  provider: string;
  store: string;
  url: string;
  quality?: string | null;
  path_template?: string | null;
}): Promise<JobResponse> {
  return request<JobResponse>("/jobs", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function saveTokens(provider: string, data: Record<string, unknown>): Promise<void> {
  await request(`/auth/${provider}`, {
    method: "POST",
    body: JSON.stringify({ data })
  });
}

export async function fetchJobLogs(jobId: string): Promise<string[]> {
  const response = await request<{ logs: string[] }>(`/jobs/${jobId}/logs`);
  return response.logs;
}

export async function updateSettings(body: AppSettings): Promise<AppSettings> {
  return request<AppSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function subscribeProgress(onUpdate: (job: JobModel) => void): () => void {
  const normalized = normalizeBase(API_BASE);
  let wsUrl: string;
  if (normalized.startsWith("http")) {
    const url = new URL(normalized);
    wsUrl = `${url.protocol === "https:" ? "wss" : "ws"}://${url.host}${url.pathname}/ws/progress`;
  } else {
    const basePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
    wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${basePath}/ws/progress`;
  }

  const socket = new WebSocket(wsUrl);
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as JobModel;
      onUpdate(payload);
    } catch (error) {
      console.error("Не удалось разобрать сообщение WebSocket", error);
    }
  };
  return () => socket.close();
}
