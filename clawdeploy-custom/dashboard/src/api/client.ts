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

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export const api = {
  health: () => request<HealthStatus>('/health'),
  
  agents: {
    list: () => request<Agent[]>('/agents'),
    get: (id: string) => request<Agent>(`/agents/${id}`),
    update: (id: string, data: { name?: string; description?: string; openclaw_agent_id?: string | null }) =>
      request<Agent>(`/agents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/agents/${id}`, { method: 'DELETE' }),
    mentionables: () =>
      request<{
        agents: Array<{ id: string; name: string; token: string; kind: 'agent' }>;
        subagents: Array<{
          sessionKey: string;
          label: string;
          token: string;
          runId: string;
          parentAgentId: string | null;
          kind: 'subagent';
        }>;
      }>('/agents/mentionables'),
    subagentsRegistry: () =>
      request<{
        subagents: Array<{
          runId: string;
          sessionKey: string;
          parentAgentId: string | null;
          task: string;
          label?: string;
          createdAt?: number;
          startedAt?: number;
          endedAt?: number;
        }>;
      }>('/agents/subagents-registry'),
    openclawList: () =>
      request<{
        agents: Array<{ id: string; name: string; synced: boolean; dbAgentId?: string | null }>;
      }>('/agents/openclaw-list'),
    pullFromOpenClaw: (id: string, name?: string) =>
      request<{ created: boolean; agent: Agent }>('/agents/pull-from-openclaw', {
        method: 'POST',
        body: JSON.stringify({ id, name }),
      }),
    syncFromOpenClaw: () =>
      request<{ synced: number; created: number; updated: number; agents: Agent[] }>(
        '/agents/sync-from-openclaw',
        { method: 'POST' }
      ),
    listSubagents: (agentId: string) =>
      request<{
        registry: Array<{ runId: string; sessionKey: string; task: string; label?: string; createdAt?: number }>;
        tracked: Array<{ runId: string; sessionKey: string; label?: string }>;
      }>(`/agents/${agentId}/subagents`),
    pullSubagent: (agentId: string, runId: string, sessionKey: string, label?: string) =>
      request<{ runId: string; sessionKey: string; label?: string }>(
        `/agents/${agentId}/subagents/pull`,
        {
          method: 'POST',
          body: JSON.stringify({ runId, sessionKey, label }),
        }
      ),
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

  deploy: {
    status: async (): Promise<{
      deploying: boolean;
      stage?: 'building_images' | 'restarting_containers';
      lastResult?: { success: boolean; error?: string };
    }> => {
      try {
        const res = await fetch(`${API_URL}/deploy/status`);
        if (!res.ok) return { deploying: false };
        return res.json();
      } catch {
        return { deploying: false };
      }
    },
    deploy: (soft = false) =>
      fetch(`${API_URL}/deploy${soft ? '/soft' : ''}`, { method: 'POST' }).then((r) => r.json()),
    rollback: () =>
      fetch(`${API_URL}/deploy/rollback`, { method: 'POST' }).then((r) => r.json()),
    logs: async (): Promise<{ logs: string }> => {
      try {
        const res = await fetch(`${API_URL}/deploy/logs`);
        if (!res.ok) return { logs: '' };
        return res.json();
      } catch {
        return { logs: '' };
      }
    },
  },
};
