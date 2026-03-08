import type { Task, TaskActivity, Conversation, ChatResponse, ProjectInfo, PrInfo } from './types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  health: () => request<{ status: string; version: string }>('/health'),

  tasks: {
    list: () => request<Task[]>('/tasks'),
    get: (taskId: string) => request<Task>(`/tasks/${taskId}`),
    merge: (taskId: string) => request<{ status: string }>(`/tasks/${taskId}/merge`, { method: 'POST' }),
    reject: (taskId: string) => request<{ status: string }>(`/tasks/${taskId}/reject`, { method: 'POST' }),
    activity: (taskId: string) => request<TaskActivity[]>(`/tasks/${taskId}/activity`),
    agentLog: (taskId: string, run: number) =>
      request<{ task_id: string; run: number; log: string }>(`/tasks/${taskId}/runs/${run}/log`),
    prInfo: (taskId: string) => request<PrInfo>(`/tasks/${taskId}/pr-info`),
  },

  chat: {
    send: (message: string, conversationId?: string, model?: string) =>
      request<ChatResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify({ message, conversation_id: conversationId, model }),
      }),
    newConversation: () => request<{ conversation_id: string }>('/conversations/new', { method: 'POST' }),
    models: () => request<{ id: string; label: string; default: boolean }[]>('/models'),
  },

  conversations: {
    list: () => request<Conversation[]>('/conversations'),
    get: (convId: string) => request<{ id: string; content: string }>(`/conversations/${convId}`),
  },

  projects: {
    list: () => request<ProjectInfo[]>('/projects'),
  },

  logs: {
    get: (service: string, lines = 200) =>
      request<{ service: string; container: string; logs: string }>(`/logs/${service}?lines=${lines}`),
  },
};
