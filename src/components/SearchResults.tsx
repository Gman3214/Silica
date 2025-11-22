import React from 'react';
import './SearchResults.css';

interface SearchResult {
  name: string;
  path: string;
  isFolder: boolean;
  matchType: 'title' | 'content' | 'ai-semantic';
  snippet?: string;
  relevanceScore?: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  selectedNote: string | null;
  onResultClick: (result: SearchResult) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  selectedNote,
  onResultClick,
}) => {
  if (results.length === 0) {
    return (
      <div className="search-results-dropdown">
        <div className="search-result-item empty">
          No notes found
        </div>
      </div>
    );
  }

  // Find the index where AI results end and regular results begin
  const aiResultsCount = results.filter(r => r.matchType === 'ai-semantic').length;
  const hasAIResults = aiResultsCount > 0;
  const hasRegularResults = results.length > aiResultsCount;

  return (
    <div className="search-results-dropdown">
      {hasAIResults && (
        <div className="search-section-header">
          <span className="section-icon">✨</span>
          AI Semantic Results ({aiResultsCount})
        </div>
      )}
      {results.map((result, index) => (
        <React.Fragment key={result.path}>
          {/* Show separator between AI and regular results */}
          {index === aiResultsCount && hasRegularResults && (
            <div className="search-section-header">
              <span className="section-icon">🔍</span>
              Keyword Matches ({results.length - aiResultsCount})
            </div>
          )}
          <div 
            className={`search-result-item ${selectedNote === result.path ? 'active' : ''} ${result.matchType === 'ai-semantic' ? 'ai-result' : ''}`}
            onClick={() => onResultClick(result)}
          >
            <div className="result-main">
              {result.isFolder ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="result-icon">
                  <path d="M2 4H7L8 5H14V13H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="result-icon">
                  <path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M10 2V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              )}
              <div className="result-text">
                <div className="result-name-row">
                  <span className="result-name">{result.name}</span>
                  {result.matchType === 'ai-semantic' && (
                    <span className="ai-badge" title={`AI Relevance: ${result.relevanceScore}%`}>
                      ✨ {result.relevanceScore}%
                    </span>
                  )}
                </div>
                {result.snippet && (
                  <span className="result-snippet">{result.snippet}</span>
                )}
              </div>
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default SearchResults;
