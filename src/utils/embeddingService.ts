import { pipeline, Pipeline } from '@xenova/transformers';

interface EmbeddingCache {
  [notePath: string]: {
    embedding: number[];
    contentHash: string; // Hash of content to detect changes
    timestamp: number;
  };
}

class EmbeddingService {
  private static instance: EmbeddingService;
  private embedder: Pipeline | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private cache: EmbeddingCache = {};
  private readonly cacheKey = 'note-embeddings-cache';
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2'; // Small, fast model

  private constructor() {
    this.loadCache();
  }

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  private loadCache() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        this.cache = JSON.parse(cached);
      }
    } catch (error) {
      console.error('Failed to load embedding cache:', error);
      this.cache = {};
    }
  }

  private saveCache() {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Failed to save embedding cache:', error);
    }
  }

  private hashString(str: string): string {
    // Simple hash function for content change detection
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  async initialize(): Promise<void> {
    if (this.embedder) return;
    
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        console.log('Initializing embedding model...');
        // @ts-ignore - transformers.js types might not be perfect
        this.embedder = await pipeline('feature-extraction', this.modelName);
        console.log('Embedding model ready!');
      } catch (error) {
        console.error('Failed to initialize embedding model:', error);
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.initialize();
    
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    try {
      // Generate embedding
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      
      // Convert to regular array
      const embedding = Array.from(output.data as Float32Array);
      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  async getOrCreateEmbedding(
    notePath: string, 
    content: string, 
    forceRegenerate = false
  ): Promise<number[]> {
    const contentHash = this.hashString(content);
    
    // Check cache
    if (!forceRegenerate && this.cache[notePath]) {
      const cached = this.cache[notePath];
      if (cached.contentHash === contentHash) {
        return cached.embedding;
      }
    }

    // Generate new embedding
    const embedding = await this.generateEmbedding(content);
    
    // Update cache
    this.cache[notePath] = {
      embedding,
      contentHash,
      timestamp: Date.now(),
    };
    
    this.saveCache();
    return embedding;
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  async searchNotes(
    query: string,
    notes: Array<{ path: string; name: string; content: string }>,
    topK = 50
  ): Promise<Array<{ path: string; name: string; score: number }>> {
    await this.initialize();

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Generate embeddings for all notes (using cache when possible)
    const results = await Promise.all(
      notes.map(async (note) => {
        try {
          const noteEmbedding = await this.getOrCreateEmbedding(note.path, note.content);
          const score = this.cosineSimilarity(queryEmbedding, noteEmbedding);
          
          return {
            path: note.path,
            name: note.name,
            score: score,
          };
        } catch (error) {
          console.error(`Failed to process note ${note.path}:`, error);
          return null;
        }
      })
    );

    // Filter out nulls and sort by score
    const validResults = results
      .filter((r): r is { path: string; name: string; score: number } => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return validResults;
  }

  clearCache() {
    this.cache = {};
    localStorage.removeItem(this.cacheKey);
  }

  getCacheSize(): number {
    return Object.keys(this.cache).length;
  }

  removeCacheEntry(notePath: string) {
    delete this.cache[notePath];
    this.saveCache();
  }
}

export const embeddingService = EmbeddingService.getInstance();
