export interface Config {
  controlApiUrl: string;
  agentName: string;
  agentDescription: string;
  openclawGatewayUrl: string;
  openclawGatewayToken: string;
  openclawMode: 'gateway' | 'embedded';
  openclawSkillsPath: string;
  moonshotApiKey: string;
  openclawModel: string;
  heartbeatIntervalMs: number;
  commandPollIntervalMs: number;
  logLevel: string;
}

export interface AgentRegistration {
  agent_id: string;
  token: string;
  name: string;
  status: string;
  created_at: string;
}

export interface Command {
  id: string;
  mission_id: string | null;
  agent_id: string;
  type: string;
  payload: any;
  status: 'pending' | 'claimed' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
}

export interface Skill {
  name: string;
  emoji: string;
  description: string;
  path: string;
  requires?: string[];
}

export interface HeartbeatPayload {
  health: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    skills_count: number;
  };
  openclaw_version: string;
}
