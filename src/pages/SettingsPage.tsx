import React, { useState, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import type { ModelInfo } from '../lib/ollama/types';
import { getPluginSettings, savePluginSettings, PLUGIN_LABELS, PLUGIN_DESCRIPTIONS, PluginSettings } from '../utils/pluginSettings';
import './SettingsPage.css';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

interface AICommand {
  id: string;
  label: string;
  prompt: string;
  pinned: boolean;
}

const DEFAULT_AI_COMMANDS: AICommand[] = [
  { id: '1', label: 'Format properly', prompt: 'Format this text properly', pinned: true },
  { id: '2', label: 'Summarize', prompt: 'Summarize this text', pinned: true },
  { id: '3', label: 'Make shorter', prompt: 'Make this shorter', pinned: true },
  { id: '4', label: 'Expand', prompt: 'Expand on this', pinned: true },
  { id: '5', label: 'Fix grammar', prompt: 'Fix grammar and spelling', pinned: true },
  { id: '6', label: 'Professional tone', prompt: 'Translate to professional tone', pinned: false },
  { id: '7', label: 'Casual tone', prompt: 'Make it more casual', pinned: false },
  { id: '8', label: 'Add details', prompt: 'Add more details', pinned: false },
  { id: '9', label: 'Simplify', prompt: 'Simplify explanation', pinned: false },
  { id: '10', label: 'Bullet points', prompt: 'Create bullet points', pinned: false },
  { id: '11', label: 'Rephrase', prompt: 'Rephrase for clarity', pinned: false },
];

const SettingsPage: React.FC<SettingsPageProps> = ({ theme, onThemeChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pluginSettings, setPluginSettings] = useState<PluginSettings>(getPluginSettings());
  
  // AI Configuration state
  const [aiProvider, setAiProvider] = useState('none');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModels, setOllamaModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [modelError, setModelError] = useState('');

  // AI Commands state
  const [aiCommands, setAiCommands] = useState<AICommand[]>(() => {
    const saved = localStorage.getItem('aiCommands');
    return saved ? JSON.parse(saved) : DEFAULT_AI_COMMANDS;
  });
  const [editingCommand, setEditingCommand] = useState<AICommand | null>(null);
  const [newCommandLabel, setNewCommandLabel] = useState('');
  const [newCommandPrompt, setNewCommandPrompt] = useState('');

  const handlePluginToggle = (key: keyof PluginSettings) => {
    const newSettings = { ...pluginSettings, [key]: !pluginSettings[key] };
    setPluginSettings(newSettings);
    savePluginSettings(newSettings);
  };

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

  // AI Commands handlers
  const saveAICommands = (commands: AICommand[]) => {
    setAiCommands(commands);
    localStorage.setItem('aiCommands', JSON.stringify(commands));
    
    // Update the customAIPrompts for the Floater (for backward compatibility)
    const prompts = commands.filter(cmd => !cmd.pinned).map(cmd => cmd.prompt);
    localStorage.setItem('customAIPrompts', JSON.stringify(prompts));
  };

  const handleAddCommand = () => {
    if (!newCommandLabel.trim() || !newCommandPrompt.trim()) return;

    const newCommand: AICommand = {
      id: Date.now().toString(),
      label: newCommandLabel,
      prompt: newCommandPrompt,
      pinned: false,
    };

    const updated = [...aiCommands, newCommand];
    saveAICommands(updated);
    setNewCommandLabel('');
    setNewCommandPrompt('');
  };

  const handleUpdateCommand = () => {
    if (!editingCommand || !editingCommand.label.trim() || !editingCommand.prompt.trim()) return;

    const updated = aiCommands.map(cmd =>
      cmd.id === editingCommand.id ? editingCommand : cmd
    );
    saveAICommands(updated);
    setEditingCommand(null);
  };

  const handleDeleteCommand = (id: string) => {
    const updated = aiCommands.filter(cmd => cmd.id !== id);
    saveAICommands(updated);
  };

  const handleTogglePin = (id: string) => {
    const command = aiCommands.find(cmd => cmd.id === id);
    if (!command) return;

    const pinnedCount = aiCommands.filter(cmd => cmd.pinned).length;
    
    // If trying to pin and already have 5 pinned
    if (!command.pinned && pinnedCount >= 5) {
      alert('You can only pin up to 5 commands. Unpin one first.');
      return;
    }

    const updated = aiCommands.map(cmd =>
      cmd.id === id ? { ...cmd, pinned: !cmd.pinned } : cmd
    );
    saveAICommands(updated);
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

            {/* AI Commands Management */}
            <div className="subsection">
              <h3>AI Commands</h3>
              <p className="section-description">Customize quick AI commands for the text editor. Pin up to 5 commands to show as quick buttons.</p>
              
              {/* Add New Command */}
              <div className="ai-command-form">
                <input
                  type="text"
                  placeholder="Command label (e.g., 'Summarize')"
                  value={newCommandLabel}
                  onChange={(e) => setNewCommandLabel(e.target.value)}
                  className="ai-command-input"
                />
                <input
                  type="text"
                  placeholder="AI prompt (e.g., 'Summarize this text')"
                  value={newCommandPrompt}
                  onChange={(e) => setNewCommandPrompt(e.target.value)}
                  className="ai-command-input"
                />
                <button 
                  className="ai-command-add-btn"
                  onClick={handleAddCommand}
                  disabled={!newCommandLabel.trim() || !newCommandPrompt.trim()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add Command
                </button>
              </div>

              {/* Commands List */}
              <div className="ai-commands-list">
                {aiCommands.map((command) => (
                  <div key={command.id} className={`ai-command-item ${command.pinned ? 'pinned' : ''}`}>
                    {editingCommand?.id === command.id ? (
                      <>
                        <div className="ai-command-edit">
                          <input
                            type="text"
                            value={editingCommand.label}
                            onChange={(e) => setEditingCommand({ ...editingCommand, label: e.target.value })}
                            className="ai-command-edit-input"
                          />
                          <input
                            type="text"
                            value={editingCommand.prompt}
                            onChange={(e) => setEditingCommand({ ...editingCommand, prompt: e.target.value })}
                            className="ai-command-edit-input"
                          />
                        </div>
                        <div className="ai-command-actions">
                          <button className="ai-command-btn ai-command-save" onClick={handleUpdateCommand}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                          <button className="ai-command-btn ai-command-cancel" onClick={() => setEditingCommand(null)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ai-command-info">
                          <div className="ai-command-header">
                            <span className="ai-command-label">{command.label}</span>
                            {command.pinned && (
                              <span className="ai-command-pin-badge">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                  <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                                </svg>
                                Pinned
                              </span>
                            )}
                          </div>
                          <span className="ai-command-prompt">{command.prompt}</span>
                        </div>
                        <div className="ai-command-actions">
                          <button 
                            className={`ai-command-btn ${command.pinned ? 'ai-command-unpin' : 'ai-command-pin'}`}
                            onClick={() => handleTogglePin(command.id)}
                            title={command.pinned ? 'Unpin' : 'Pin'}
                          >
                            {command.pinned ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                              </svg>
                            )}
                          </button>
                          <button className="ai-command-btn ai-command-edit-btn" onClick={() => setEditingCommand(command)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button className="ai-command-btn ai-command-delete" onClick={() => handleDeleteCommand(command.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h2>Storage</h2>
            <div className="setting-item">
              <label>Notes Directory</label>
              <input type="text" placeholder="~/Documents/Silica" />
              <button className="browse-btn">Browse</button>
            </div>
          </div>

          <div className="settings-section">
            <h2>Developer</h2>
            <p className="section-description">Advanced settings for debugging and development</p>
            
            <div className="subsection">
              <h3>Editor Plugins</h3>
              <p className="section-description">Enable or disable markdown editor features</p>
              {(Object.keys(pluginSettings) as Array<keyof PluginSettings>).map((key) => (
                <div key={key} className="setting-item-toggle">
                  <div className="setting-info">
                    <label>{PLUGIN_LABELS[key]}</label>
                    <span className="setting-description">{PLUGIN_DESCRIPTIONS[key]}</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={pluginSettings[key]}
                      onChange={() => handlePluginToggle(key)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
