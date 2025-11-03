import React from 'react';
import './SearchResults.css';

interface SearchResult {
  name: string;
  path: string;
  isFolder: boolean;
  matchType: 'title' | 'content';
  snippet?: string;
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

  return (
    <div className="search-results-dropdown">
      {results.map((result) => (
        <div 
          key={result.path}
          className={`search-result-item ${selectedNote === result.path ? 'active' : ''}`}
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
              <span className="result-name">{result.name}</span>
              {result.snippet && (
                <span className="result-snippet">{result.snippet}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SearchResults;
