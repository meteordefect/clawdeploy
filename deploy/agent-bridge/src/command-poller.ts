import type { ControlApiClient } from './control-api-client.js';
import type { Command, Skill } from './types.js';
import { LLMClient } from './llm-client.js';

export class CommandPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private llmClient: LLMClient | null = null;

  constructor(
    private client: ControlApiClient,
    private intervalMs: number,
    llmConfig?: { model: string; apiKey: string },
    private skills: Skill[] = []
  ) {
    if (llmConfig && llmConfig.apiKey) {
      this.llmClient = new LLMClient(llmConfig);
    }
  }

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

      let result: any;

      if (command.type === 'openclaw.chat') {
        result = await this.processChat(command);
      } else {
        result = {
          message: `Command ${command.type} executed successfully`,
          payload: command.payload,
        };
      }

      await this.client.reportCommandResult(command.id, result, 'completed');
    } catch (error: any) {
      console.error(`Failed to process command ${command.id}:`, error.message);
      
      try {
        await this.client.reportCommandResult(
          command.id,
          { error: error.message },
          'failed'
        );
      } catch (reportError) {
        console.error('Failed to report command failure');
      }
    }
  }

  private buildSystemPrompt(): string {
    let prompt = 'You are a helpful AI assistant.';
    if (this.skills.length > 0) {
      prompt += '\n\nYou have access to these skills. Use them when relevant:\n\n';
      for (const skill of this.skills) {
        prompt += `## ${skill.emoji} ${skill.name}\n${skill.content}\n\n`;
      }
    }
    return prompt;
  }

  private async processChat(command: Command): Promise<any> {
    if (!this.llmClient) {
      throw new Error('LLM client not configured - missing API key');
    }

    const { message, context } = command.payload;
    
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: this.buildSystemPrompt(),
      },
    ];

    if (context) {
      messages.push({
        role: 'user',
        content: context,
      });
    }

    if (message) {
      messages.push({
        role: 'user',
        content: message,
      });
    }

    const response = await this.llmClient.chat(messages);

    return {
      message: 'Chat command executed successfully',
      response,
      query: { message, context },
    };
  }
}
