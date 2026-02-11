import type { ControlApiClient } from './control-api-client.js';
import type { HeartbeatPayload } from './types.js';

export class HeartbeatManager {
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();
  private skillsCount: number = 0;

  constructor(
    private client: ControlApiClient,
    private intervalMs: number
  ) {}

  start(skillsCount: number): void {
    this.skillsCount = skillsCount;
    this.startTime = Date.now();

    console.log(`Starting heartbeat (interval: ${this.intervalMs}ms)`);

    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalMs);

    // Send first heartbeat immediately
    this.sendHeartbeat();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Heartbeat stopped');
    }
  }

  private async sendHeartbeat(): Promise<void> {
    const payload: HeartbeatPayload = {
      health: {
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        memory: process.memoryUsage(),
        skills_count: this.skillsCount,
      },
      openclaw_version: '1.0.0', // TODO: Get actual version
    };

    try {
      await this.client.sendHeartbeat(payload);
    } catch (error) {
      console.error('Heartbeat failed, will retry on next interval');
    }
  }
}
