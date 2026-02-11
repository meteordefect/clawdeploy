import type { ControlApiClient } from './control-api-client.js';
import type { Command } from './types.js';

export class CommandPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(
    private client: ControlApiClient,
    private intervalMs: number
  ) {}

  start(): void {
    console.log(`Starting command poller (interval: ${this.intervalMs}ms)`);

    this.intervalId = setInterval(() => {
      this.poll();
    }, this.intervalMs);

    // Poll immediately on start
    this.poll();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Command poller stopped');
    }
  }

  private async poll(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const commands = await this.client.pollCommands();

      for (const command of commands) {
        await this.processCommand(command);
      }
    } catch (error: any) {
      console.error('Command polling error:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processCommand(command: Command): Promise<void> {
    console.log(`Processing command ${command.id}: ${command.type}`);

    try {
      await this.client.acceptCommand(command.id);

      // TODO: Execute command via OpenClaw
      // For now, just report success
      const result = {
        message: `Command ${command.type} executed successfully`,
        payload: command.payload,
      };

      await this.client.reportCommandResult(command.id, result, 0);
    } catch (error: any) {
      console.error(`Failed to process command ${command.id}:`, error.message);
      
      try {
        await this.client.reportCommandResult(
          command.id,
          { error: error.message },
          1
        );
      } catch (reportError) {
        console.error('Failed to report command failure');
      }
    }
  }
}
