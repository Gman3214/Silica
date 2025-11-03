import React from 'react';
import SearchInput from './SearchInput';
import SearchResults from './SearchResults';
import './SearchBar.css';

interface SearchResult {
  name: string;
  path: string;
  isFolder: boolean;
  matchType: 'title' | 'content';
  snippet?: string;
}

interface SearchBarProps {
  searchQuery: string;
  searchResults: SearchResult[];
  selectedNote: string | null;
  onSearchChange: (query: string) => void;
  onResultClick: (result: SearchResult) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  searchResults,
  selectedNote,
  onSearchChange,
  onResultClick,
}) => {
  return (
    <div className="global-search-header">
      <div className="search-box-global">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search notes..."
        />
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
