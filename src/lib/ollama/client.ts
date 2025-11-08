/**
 * Ollama API Client
 * Provides direct fetch-based access to Ollama API endpoints
 */

import type {
  ModelsResponse,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamChunk,
  OllamaError,
} from './types';

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Update the base URL for the Ollama instance
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if Ollama is running and accessible
   */
  async getConnectionStatus(): Promise<{ connected: boolean; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${this.baseUrl}/api/tags`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return {
            connected: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        return { connected: true };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        connected: false,
        error: errorMessage,
      };
    }
  }

  /**
   * List all available models
   */
  async listModels(): Promise<ModelsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ModelsResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      throw error;
    }
  }

  /**
   * Chat completion - Non-streaming
   */
  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData: OllamaError = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ChatCompletionResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to complete chat:', error);
      throw error;
    }
  }

  /**
   * Chat completion - Streaming
   * Returns an async generator that yields chunks as they arrive
   */
  async *chatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionStreamChunk, void, unknown> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData: OllamaError = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk: ChatCompletionStreamChunk = JSON.parse(line);
              yield chunk;
            } catch (e) {
              console.error('Failed to parse stream chunk:', e);
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        try {
          const chunk: ChatCompletionStreamChunk = JSON.parse(buffer);
          yield chunk;
        } catch (e) {
          console.error('Failed to parse final chunk:', e);
        }
      }
    } catch (error) {
      console.error('Failed to stream chat completion:', error);
      throw error;
    }
  }
}

// Export a default instance
export const ollamaClient = new OllamaClient();

