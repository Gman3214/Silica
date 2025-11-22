import { aiRouter } from '../lib/ai-router';

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

      // Create a context of all notes for the AI
      const notesContext = searchableNotes.map((note, index) => {
        const title = note.name.replace('.md', '');
        const preview = note.content?.slice(0, 500) || '';
        return `[${index}] Title: "${title}"\nContent preview: ${preview}`;
      }).join('\n\n---\n\n');

      // Create the AI prompt
      const prompt = `You are a semantic search assistant. Given a user's search query and a list of notes, identify which notes are most relevant.

User query: "${query}"

Available notes:
${notesContext}

Analyze the query and return ONLY a JSON array of relevant note indices with relevance scores (0-100). Format:
[{"index": 0, "score": 95, "reason": "brief explanation"}, ...]

Return only notes with score >= 50. If no notes are relevant, return an empty array [].`;

      // Get AI response using aiRouter
      const response = await aiRouter.chatCompletion({
        messages: [
          {
            role: 'user',
            content: prompt,
          }
        ],
        options: {
          temperature: 0.3, // Lower temperature for more focused results
        }
      });

      // Parse AI response
      const aiResults = this.parseAIResponse(response.content);
      
      // Convert AI results to search results
      const searchResults: SearchResult[] = aiResults
        .filter(r => r.index < searchableNotes.length)
        .map(r => {
          const note = searchableNotes[r.index];
          return {
            name: note.name,
            path: note.path,
            isFolder: false,
            matchType: 'semantic' as const,
            snippet: r.reason || note.content?.slice(0, 200),
            relevanceScore: r.score,
          };
        })
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

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
