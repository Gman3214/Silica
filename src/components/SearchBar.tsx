import React from 'react';
import SearchInput from './SearchInput';
import SearchResults from './SearchResults';
import './SearchBar.css';

interface SearchResult {
  name: string;
  path: string;
  isFolder: boolean;
  matchType: 'title' | 'content' | 'ai-semantic';
  snippet?: string;
  relevanceScore?: number;
}

interface SearchBarProps {
  searchQuery: string;
  searchResults: SearchResult[];
  selectedNote: string | null;
  onSearchChange: (query: string) => void;
  onResultClick: (result: SearchResult) => void;
  isAISearching?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  searchResults,
  selectedNote,
  onSearchChange,
  onResultClick,
  isAISearching = false,
}) => {
  return (
    <div className="global-search-header">
      <div className="search-box-global">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="AI semantic search..."
        />
        {isAISearching && (
          <div className="ai-searching-indicator">
            <span className="ai-loading"></span>
            <span className="ai-text">AI analyzing...</span>
          </div>
        )}
        {searchQuery && (
          <SearchResults
            results={searchResults}
            selectedNote={selectedNote}
            onResultClick={onResultClick}
          />
        )}
      </div>
    </div>
  );
};

export default SearchBar;
