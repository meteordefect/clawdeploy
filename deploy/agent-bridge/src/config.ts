import { config as loadEnv } from 'dotenv';
import type { Config } from './types.js';

loadEnv();

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

export const config: Config = {
  controlApiUrl: getEnv('CONTROL_API_URL', 'http://control-api:3001/api'),
  agentName: getEnv('AGENT_NAME', 'OpenClaw Agent'),
  agentDescription: getEnv('AGENT_DESCRIPTION', 'OpenClaw agent instance'),
  openclawGatewayUrl: getEnv('OPENCLAW_GATEWAY_URL', 'ws://host.docker.internal:18789'),
  openclawGatewayToken: getEnv('OPENCLAW_GATEWAY_TOKEN', ''),
  openclawMode: (getEnv('OPENCLAW_MODE', 'gateway') as 'gateway' | 'embedded'),
  openclawSkillsPath: getEnv('OPENCLAW_SKILLS_PATH', '/openclaw/skills'),
  moonshotApiKey: getEnv('MOONSHOT_API_KEY', ''),
  openclawModel: getEnv('OPENCLAW_MODEL', 'moonshot/kimi-k2.5'),
  heartbeatIntervalMs: getEnvNumber('HEARTBEAT_INTERVAL_MS', 30000),
  commandPollIntervalMs: getEnvNumber('COMMAND_POLL_INTERVAL_MS', 5000),
  logLevel: getEnv('LOG_LEVEL', 'info'),
};

export function validateConfig(): void {
  const required = [
    'controlApiUrl',
    'agentName',
  ];

  const missing = required.filter(key => !config[key as keyof Config]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  console.log('Configuration loaded successfully');
  console.log(`Control API: ${config.controlApiUrl}`);
  console.log(`Agent Name: ${config.agentName}`);
  console.log(`OpenClaw Mode: ${config.openclawMode}`);
}
