export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'coding'
  | 'pr_open'
  | 'ready_to_merge'
  | 'needs_human'
  | 'completed'
  | 'failed'
  | 'rejected';

export interface TaskMeta {
  id: string;
  project: string;
  status: TaskStatus;
  agent_type?: string;
  container_id?: string;
  branch?: string;
  pr?: string;
  created?: string;
  retries?: number;
  question?: string;
  [key: string]: any;
}

export interface Task {
  filename: string;
  meta: TaskMeta;
  body: string;
  path?: string;
}

export interface Conversation {
  id: string;
  project: string | null;
  started: string | null;
  summary: string | null;
  filename: string;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
}

export interface ProjectInfo {
  name: string;
  context_preview: string;
}

export interface PrFileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface PrCheck {
  name: string;
  status: string;
  conclusion: string | null;
}

export interface PrInfo {
  title: string;
  url: string;
  branch: string;
  files: PrFileChange[];
  checks: PrCheck[];
  additions: number;
  deletions: number;
  changed_files: number;
}

export type ActivityType =
  | 'agent_spawned'
  | 'agent_completed'
  | 'phoung_note'
  | 'status_change';

export interface TaskActivity {
  ts: string;
  type: ActivityType;
  run?: number;
  container_id?: string;
  agent_type?: string;
  prompt?: string;
  exit_code?: number;
  log_file?: string;
  message?: string;
  from?: string;
  to?: string;
}
