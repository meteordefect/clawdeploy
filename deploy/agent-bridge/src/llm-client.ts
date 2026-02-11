export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMClientConfig {
  model: string;
  apiKey: string;
}

export class LLMClient {
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
  }

  async chat(messages: LLMMessage[]): Promise<string> {
    const provider = this.getProvider();

    if (provider === 'zhipuai') {
      return this.callZhipuAI(messages);
    } else if (provider === 'kimi-code') {
      return this.callKimiCode(messages);
    } else if (provider === 'moonshot') {
      return this.callMoonshot(messages);
    } else if (provider === 'openai') {
      return this.callOpenAI(messages);
    }

    throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  private getProvider(): string {
    const model = this.config.model.toLowerCase();
    
    if (model.includes('zhipu') || model.includes('glm')) {
      return 'zhipuai';
    } else if (model.includes('kimi') && model.includes('code')) {
      return 'kimi-code';
    } else if (model.includes('moonshot') || model.includes('kimi')) {
      return 'moonshot';
    } else if (model.includes('openai') || model.includes('gpt')) {
      return 'openai';
    }

    throw new Error(`Cannot determine provider from model: ${this.config.model}`);
  }

  private async callMoonshot(messages: LLMMessage[]): Promise<string> {
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model.replace('moonshot/', ''),
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Moonshot API error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Moonshot API');
    }

    return data.choices[0].message.content;
  }

  private async callZhipuAI(messages: LLMMessage[]): Promise<string> {
    // ZhipuAI API endpoint
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ZhipuAI API error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from ZhipuAI API');
    }

    return data.choices[0].message.content;
  }

  private async callKimiCode(messages: LLMMessage[]): Promise<string> {
    // Kimi Code API uses OpenAI-compatible endpoint
    const response = await fetch('https://api.kimi-code.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model.replace('kimi-code/', '').replace('kimi/', ''),
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi Code API error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Kimi Code API');
    }

    return data.choices[0].message.content;
  }

  private async callOpenAI(messages: LLMMessage[]): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model.replace('openai/', ''),
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenAI API');
    }

    return data.choices[0].message.content;
  }
}
