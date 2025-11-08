import React, { useState, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import type { ModelInfo } from '../lib/ollama/types';
import './SettingsPage.css';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ theme, onThemeChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // AI Configuration state
  const [aiProvider, setAiProvider] = useState('none');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModels, setOllamaModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [modelError, setModelError] = useState('');

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('ollamaSettings');
    if (savedSettings) {
      try {
        const { provider, url, model } = JSON.parse(savedSettings);
        setAiProvider(provider || 'none');
        setOllamaUrl(url || 'http://localhost:11434');
        setSelectedModel(model || '');
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }
  }, []);

  // Fetch Ollama models when provider or URL changes
  useEffect(() => {
    if (aiProvider === 'ollama') {
      fetchOllamaModels();
    }
  }, [aiProvider, ollamaUrl]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (aiProvider === 'ollama') {
      const settings = {
        provider: aiProvider,
        url: ollamaUrl,
        model: selectedModel,
      };
      localStorage.setItem('ollamaSettings', JSON.stringify(settings));
    }
  }, [aiProvider, ollamaUrl, selectedModel]);

  const fetchOllamaModels = async () => {
    setLoadingModels(true);
    setModelError('');
    try {
      // Use the OllamaClient from our library
      const { OllamaClient } = await import('../lib/ollama/client');
      const client = new OllamaClient(ollamaUrl);
      
      const response = await client.listModels();
      const models = response.models || [];
      
      setOllamaModels(models);
      if (models.length === 0) {
        setModelError('No models available. Please pull a model in Ollama first.');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch models';
      setModelError(`Error loading models: ${errorMessage}`);
      console.error('Failed to fetch Ollama models:', error);
      setOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleAiProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setAiProvider(newProvider);
    setSelectedModel('');
    setModelError('');
  };

  const handleOllamaUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOllamaUrl(e.target.value);
  };

  const handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
  };

  return (
    <div className="settings-page">
      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        selectedNote={null}
        onResultClick={() => {}}
      />
      
      <div className="settings-container">
        <div className="settings-content">
          <div className="settings-section">
            <h2>Appearance</h2>
            <div className="setting-item">
              <label>Theme</label>
              <select value={theme} onChange={(e) => onThemeChange(e.target.value as 'light' | 'dark')}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Font Size</label>
              <input type="number" defaultValue="14" min="10" max="24" />
            </div>
          </div>

          <div className="settings-section">
            <h2>AI Configuration</h2>
            <div className="setting-item">
              <label>AI Provider</label>
              <select value={aiProvider} onChange={handleAiProviderChange}>
                <option value="none">None</option>
                <option value="openai">OpenAI API</option>
                <option value="anthropic">Anthropic API</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>

            {aiProvider !== 'none' && aiProvider !== 'ollama' && (
              <div className="setting-item">
                <label>API Key</label>
                <input
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            )}

            {aiProvider === 'ollama' && (
              <>
                <div className="setting-item">
                  <label>Ollama URL</label>
                  <input
                    type="text"
                    placeholder="http://localhost:11434"
                    value={ollamaUrl}
                    onChange={handleOllamaUrlChange}
                  />
                  <p className="setting-hint">Default: http://localhost:11434</p>
                </div>

                <div className="setting-item">
                  <label>Model</label>
                  {loadingModels ? (
                    <div className="loading-indicator">Loading models...</div>
                  ) : (
                    <>
                      <select value={selectedModel} onChange={handleModelSelect}>
                        <option value="">Select a model...</option>
                        {ollamaModels.map((model) => (
                          <option key={model.name} value={model.name}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                      {modelError && (
                        <div className="error-with-retry">
                          <p className="setting-error">{modelError}</p>
                          <button
                            className="retry-btn"
                            onClick={fetchOllamaModels}
                            title="Retry loading models"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {selectedModel && !modelError && (
                        <p className="setting-success">Model selected: {selectedModel}</p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="settings-section">
            <h2>Storage</h2>
            <div className="setting-item">
              <label>Notes Directory</label>
              <input type="text" placeholder="~/Documents/Silica" />
              <button className="browse-btn">Browse</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
