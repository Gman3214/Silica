/**
 * AI Router
 * Provides a standardized interface for AI operations across different providers
 * Routes requests to the appropriate provider based on localStorage settings
 */

import { OllamaClient } from './ollama/client';
import type { ChatMessage } from './ollama/types';

// Standardized AI Settings
export interface AISettings {
  provider: 'none' | 'openai' | 'anthropic' | 'ollama';
  url?: string; // For Ollama
  model?: string;
  apiKey?: string; // For OpenAI/Anthropic
}

// Standardized Model Info
export interface StandardModelInfo {
  id: string;
  name: string;
  provider: string;
  size?: number;
  modified?: string;
}

// Standardized Chat Completion Options
export interface ChatCompletionOptions {
  temperature?: number; // 0-2, default 1
  maxTokens?: number; // Maximum tokens to generate
  topP?: number; // 0-1, nucleus sampling
  stream?: boolean; // Enable streaming
  stop?: string[]; // Stop sequences
  seed?: number; // For reproducibility
}

// Standardized Chat Completion Request
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  options?: ChatCompletionOptions;
  model?: string; // Optional override of configured model
}

// Standardized Chat Completion Response
export interface ChatCompletionResponse {
  content: string;
  role: 'assistant';
  model: string;
  finishReason?: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// Standardized Stream Chunk
export interface ChatCompletionStreamChunk {
  content: string;
  done: boolean;
  model?: string;
}

// Connection Status
export interface ConnectionStatus {
  connected: boolean;
  provider: string;
  error?: string;
}

/**
 * AIRouter Class
 * Main router that handles AI provider selection and standardization
 */
export class AIRouter {
  private ollamaClient: OllamaClient;
  private settings: AISettings;

  constructor() {
    this.ollamaClient = new OllamaClient();
    this.settings = this.loadSettings();
    this.initializeProviders();
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): AISettings {
    try {
      const savedSettings = localStorage.getItem('ollamaSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        return {
          provider: parsed.provider || 'none',
          url: parsed.url,
          model: parsed.model,
          apiKey: parsed.apiKey,
        };
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    }

    return { provider: 'none' };
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem('ollamaSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save AI settings:', error);
    }
  }

  /**
   * Initialize provider clients with current settings
   */
  private initializeProviders(): void {
    if (this.settings.provider === 'ollama' && this.settings.url) {
      this.ollamaClient.setBaseUrl(this.settings.url);
    }
  }

  /**
   * Refresh settings from localStorage
   */
  refreshSettings(): void {
    this.settings = this.loadSettings();
    this.initializeProviders();
  }

  /**
   * Get current settings
   */
  getSettings(): AISettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<AISettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.initializeProviders();
  }

  /**
   * Check connection status for current provider
   */
  async getConnectionStatus(): Promise<ConnectionStatus> {
    const provider = this.settings.provider;

    if (provider === 'none') {
      return {
        connected: false,
        provider: 'none',
        error: 'No AI provider configured',
      };
    }

    if (provider === 'ollama') {
      const status = await this.ollamaClient.getConnectionStatus();
      return {
        connected: status.connected,
        provider: 'ollama',
        error: status.error,
      };
    }

    // OpenAI and Anthropic not implemented yet
    if (provider === 'openai' || provider === 'anthropic') {
      return {
        connected: false,
        provider,
        error: `${provider} provider not yet implemented`,
      };
    }

    return {
      connected: false,
      provider,
      error: 'Unknown provider',
    };
  }

  /**
   * List available models for current provider
   */
  async listModels(): Promise<StandardModelInfo[]> {
    const provider = this.settings.provider;

    if (provider === 'none') {
      throw new Error('No AI provider configured');
    }

    if (provider === 'ollama') {
      const response = await this.ollamaClient.listModels();
      return response.models.map((model) => ({
        id: model.name,
        name: model.name,
        provider: 'ollama',
        size: model.size,
        modified: model.modified_at,
      }));
    }

    // OpenAI and Anthropic not implemented yet
    if (provider === 'openai' || provider === 'anthropic') {
      throw new Error(`${provider} provider not yet implemented`);
    }

    throw new Error('Unknown provider');
  }

  /**
   * Chat completion - supports both streaming and non-streaming
   */
  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const provider = this.settings.provider;

    if (provider === 'none') {
      throw new Error('No AI provider configured');
    }

    const model = request.model || this.settings.model;
    if (!model) {
      throw new Error('No model specified');
    }

    if (provider === 'ollama') {
      const ollamaRequest = {
        model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.options?.temperature,
          top_p: request.options?.topP,
          num_predict: request.options?.maxTokens,
          stop: request.options?.stop,
          seed: request.options?.seed,
        },
      };

      const response = await this.ollamaClient.chatCompletion(ollamaRequest);

      return {
        content: response.message.content,
        role: 'assistant',
        model: response.model,
        finishReason: response.done ? 'stop' : undefined,
        usage: {
          promptTokens: response.prompt_eval_count,
          completionTokens: response.eval_count,
          totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
        },
      };
    }

    // OpenAI and Anthropic not implemented yet
    if (provider === 'openai' || provider === 'anthropic') {
      throw new Error(`${provider} provider not yet implemented`);
    }

    throw new Error('Unknown provider');
  }

  /**
   * Chat completion with streaming
   * Returns an async generator that yields chunks
   */
  async *chatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionStreamChunk, void, unknown> {
    const provider = this.settings.provider;

    if (provider === 'none') {
      throw new Error('No AI provider configured');
    }

    const model = request.model || this.settings.model;
    if (!model) {
      throw new Error('No model specified');
    }

    if (provider === 'ollama') {
      const ollamaRequest = {
        model,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.options?.temperature,
          top_p: request.options?.topP,
          num_predict: request.options?.maxTokens,
          stop: request.options?.stop,
          seed: request.options?.seed,
        },
      };

      for await (const chunk of this.ollamaClient.chatCompletionStream(ollamaRequest)) {
        yield {
          content: chunk.message.content,
          done: chunk.done,
          model: chunk.model,
        };
      }
      return;
    }

    // OpenAI and Anthropic not implemented yet
    if (provider === 'openai' || provider === 'anthropic') {
      throw new Error(`${provider} provider not yet implemented`);
    }

    throw new Error('Unknown provider');
  }
}

// Export a singleton instance
export const aiRouter = new AIRouter();

