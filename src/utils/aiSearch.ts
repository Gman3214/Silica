import { aiRouter } from '../lib/ai-router';
import { embeddingService } from './embeddingService';

interface Note {
  name: string;
  path: string;
  content?: string;
  isFolder?: boolean;
}

interface SearchResult {
  name: string;
  path: string;
  isFolder: boolean;
  matchType: 'title' | 'content' | 'semantic';
  snippet?: string;
  relevanceScore?: number;
}

/**
 * Performs AI-powered semantic search through notes
 * Uses AI Router to understand natural language queries and find relevant notes
 */
export class AISearch {
  /**
   * Check if AI search is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const status = await aiRouter.getConnectionStatus();
      return status.connected;
    } catch {
      return false;
    }
  }

  /**
   * Perform semantic search using AI
   */
  public async search(query: string, notes: Note[]): Promise<SearchResult[]> {
    const available = await this.isAvailable();
    if (!available || !query.trim()) {
      return [];
    }

    try {
      // Filter out folders and notes without content
      const searchableNotes = notes.filter(note => !note.isFolder && note.content);

      if (searchableNotes.length === 0) {
        return [];
      }

      // RAG Step 1: Use embeddings to retrieve top 5 candidates (fast, semantic retrieval)
      console.log(`RAG: Retrieving top 5 from ${searchableNotes.length} notes with embeddings...`);
      
      const notesForEmbedding = searchableNotes.map(note => ({
        path: note.path,
        name: note.name,
        content: note.content || '',
      }));

      const embeddingResults = await embeddingService.searchNotes(query, notesForEmbedding, 5);
      
      if (embeddingResults.length === 0) {
        return [];
      }

      console.log(`RAG: Retrieved ${embeddingResults.length} candidates, sending to AI for re-ranking...`);
      
      // Get the full note objects for the top 5 candidates
      const candidateNotes = embeddingResults.map(r => 
        searchableNotes.find(n => n.path === r.path)!
      );

      // RAG Step 2: Use AI to augment and re-rank based on full content
      // Create detailed context with FULL content of top 5 candidates
      const notesContext = candidateNotes.map((note, index) => {
        const title = note.name.replace('.md', '');
        const fullContent = note.content || '';
        return `[${index}] Title: "${title}"\n\nFull Content:\n${fullContent}\n\n---`;
      }).join('\n\n');

      // Create the AI prompt for re-ranking
      const prompt = `You are a semantic search assistant using RAG (Retrieval-Augmented Generation). You've been given the top 5 most similar notes based on embedding similarity. Now re-rank them based on their FULL content and relevance to the user's query.

User query: "${query}"

Top 5 Retrieved Notes:
${notesContext}

Carefully analyze the FULL CONTENT of each note and return a JSON array with re-ranked results. Format:
[{"index": 0, "score": 95, "reason": "brief explanation of why this is most relevant"}, ...]

Rules:
- Only include notes with score >= 50
- Consider semantic meaning, context, and how well the content answers the query
- The order should reflect true relevance to the query, not just keyword matching
- Provide scores 0-100 where 100 is perfectly relevant

Return ONLY the JSON array, no other text.`;

      // Get AI response using aiRouter
      const response = await aiRouter.chatCompletion({
        messages: [
          {
            role: 'user',
            content: prompt,
          }
        ],
        options: {
          temperature: 0.2, // Low temperature for consistent re-ranking
        }
      });

      // Parse AI response
      const aiResults = this.parseAIResponse(response.content);
      
      console.log(`RAG: AI re-ranked to ${aiResults.length} final results`);
      
      // Convert AI results to search results
      const searchResults: SearchResult[] = aiResults
        .filter(r => r.index < candidateNotes.length)
        .map(r => {
          const note = candidateNotes[r.index];
          return {
            name: note.name,
            path: note.path,
            isFolder: false,
            matchType: 'semantic' as const,
            snippet: r.reason || note.content?.slice(0, 200),
            relevanceScore: r.score,
          };
        })
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, 3); // Return only top 3 results to user

      return searchResults;
    } catch (error) {
      console.error('AI search failed:', error);
      return [];
    }
  }

  /**
   * Parse AI response to extract note indices and scores
   */
  private parseAIResponse(response: string): Array<{ index: number; score: number; reason?: string }> {
    try {
      // Try to extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(item => typeof item.index === 'number' && typeof item.score === 'number')
        .filter(item => item.score >= 50);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return [];
    }
  }

  /**
   * Generate a natural language summary of search results
   */
  public async summarizeResults(query: string, results: SearchResult[]): Promise<string> {
    const available = await this.isAvailable();
    if (!available || results.length === 0) {
      return '';
    }

    try {
      const resultsList = results.slice(0, 5).map(r => 
        `- ${r.name.replace('.md', '')}: ${r.snippet || ''}`
      ).join('\n');

      const prompt = `User searched for: "${query}"

Found ${results.length} relevant notes:
${resultsList}

Provide a brief, helpful summary (1-2 sentences) of what was found.`;

      const response = await aiRouter.chatCompletion({
        messages: [
          {
            role: 'user',
            content: prompt,
          }
        ],
        options: {
          temperature: 0.7,
        }
      });

      return response.content.trim();
    } catch (error) {
      console.error('Failed to generate summary:', error);
      return '';
    }
  }
}

// Singleton instance
let aiSearchInstance: AISearch | null = null;

export function getAISearch(): AISearch {
  if (!aiSearchInstance) {
    aiSearchInstance = new AISearch();
  }
  return aiSearchInstance;
}
