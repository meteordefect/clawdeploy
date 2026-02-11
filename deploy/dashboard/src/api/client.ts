import type { Agent, Mission, Command, Event, HealthStatus, FileItem, Session } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  health: () => request<HealthStatus>('/health'),
  
  agents: {
    list: () => request<Agent[]>('/agents'),
    get: (id: string) => request<Agent>(`/agents/${id}`),
  },
  
  missions: {
    list: (status?: string) => 
      request<Mission[]>(`/missions${status ? `?status=${status}` : ''}`),
    get: (id: string) => request<Mission & { commands: Command[] }>(`/missions/${id}`),
    create: (data: { name: string; description?: string }) =>
      request<Mission>('/missions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { status?: string; description?: string }) =>
      request<Mission>(`/missions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    queueCommand: (id: string, data: {
      type: string;
      payload?: Record<string, any>;
      agent_id?: string;
      priority?: number;
    }) =>
      request<Command>(`/missions/${id}/commands`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  
  commands: {
    list: (filters?: { status?: string; agent_id?: string; mission_id?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.agent_id) params.set('agent_id', filters.agent_id);
      if (filters?.mission_id) params.set('mission_id', filters.mission_id);
      return request<Command[]>(`/commands?${params}`);
    },
  },
  
  events: {
    list: (filters?: { type?: string; agent_id?: string; mission_id?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.agent_id) params.set('agent_id', filters.agent_id);
      if (filters?.mission_id) params.set('mission_id', filters.mission_id);
      if (filters?.limit) params.set('limit', filters.limit.toString());
      return request<Event[]>(`/events?${params}`);
    },
  },
  
  files: {
    list: () => request<string[]>('/files'),
    get: (path: string) => request<FileItem>(`/files/${path}`),
    update: (path: string, content: string) =>
      request<FileItem>(`/files/${path}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
  },
  
  sessions: {
    list: () => request<Session[]>('/sessions'),
    get: (id: string) => request<Session>(`/sessions/${id}`),
  },
};
