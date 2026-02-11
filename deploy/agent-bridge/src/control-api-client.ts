import axios, { AxiosInstance } from 'axios';
import type { AgentRegistration, Command, HeartbeatPayload } from './types.js';

export class ControlApiClient {
  private client: AxiosInstance;
  private agentId: string | null = null;
  private agentToken: string | null = null;

  constructor(private baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async registerAgent(name: string, description: string): Promise<AgentRegistration> {
    console.log(`Registering agent: ${name}`);
    
    try {
      const response = await this.client.post<AgentRegistration>('/agents/register', {
        name,
        description,
      });

      this.agentId = response.data.agent_id;
      this.agentToken = response.data.token;

      console.log(`Agent registered successfully! ID: ${this.agentId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to register agent:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
    if (!this.agentToken) {
      throw new Error('Agent not registered. Call registerAgent() first.');
    }

    try {
      await this.client.post(
        '/agents/heartbeat',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.agentToken}`,
          },
        }
      );

      console.log(`Heartbeat sent successfully at ${new Date().toISOString()}`);
    } catch (error: any) {
      console.error('Failed to send heartbeat:', error.response?.data || error.message);
      throw error;
    }
  }

  async pollCommands(): Promise<Command[]> {
    if (!this.agentToken || !this.agentId) {
      throw new Error('Agent not registered. Call registerAgent() first.');
    }

    try {
      const response = await this.client.get<Command[]>(`/commands/pending`, {
        headers: {
          'Authorization': `Bearer ${this.agentToken}`,
        },
        params: {
          agent_id: this.agentId,
        },
      });

      if (response.data.length > 0) {
        console.log(`Found ${response.data.length} pending command(s)`);
      }

      return response.data;
    } catch (error: any) {
      console.error('Failed to poll commands:', error.response?.data || error.message);
      return [];
    }
  }

  async acceptCommand(commandId: string): Promise<void> {
    if (!this.agentToken) {
      throw new Error('Agent not registered.');
    }

    try {
      await this.client.post(
        `/commands/${commandId}/accept`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.agentToken}`,
          },
        }
      );

      console.log(`Accepted command: ${commandId}`);
    } catch (error: any) {
      console.error('Failed to accept command:', error.response?.data || error.message);
      throw error;
    }
  }

  async reportCommandResult(commandId: string, result: any, status: 'completed' | 'failed'): Promise<void> {
    if (!this.agentToken) {
      throw new Error('Agent not registered.');
    }

    try {
      await this.client.post(
        `/commands/${commandId}/result`,
        {
          status,
          result,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.agentToken}`,
          },
        }
      );

      console.log(`Reported result for command: ${commandId} (${status})`);
    } catch (error: any) {
      console.error('Failed to report command result:', error.response?.data || error.message);
      throw error;
    }
  }

  getAgentId(): string | null {
    return this.agentId;
  }

  getAgentToken(): string | null {
    return this.agentToken;
  }
}
