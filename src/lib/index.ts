/**
 * Main Library Exports
 */

// AI Router - Main interface (includes all types)
export * from './ai-router';

// Ollama Client - Direct access if needed (re-export only the client, not types to avoid duplicates)
export { ollamaClient, OllamaClient } from './ollama/client';

