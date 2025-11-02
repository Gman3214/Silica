import React from 'react';
import './SettingsPage.css';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ theme, onThemeChange }) => {
  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>
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
            <select>
              <option>None</option>
              <option>OpenAI API</option>
              <option>Anthropic API</option>
              <option>Ollama (Local)</option>
            </select>
          </div>
          <div className="setting-item">
            <label>API Key</label>
            <input type="password" placeholder="Enter your API key" />
          </div>
          <div className="setting-item">
            <label>Ollama URL</label>
            <input type="text" placeholder="http://localhost:11434" />
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
      </div>
    </div>
  );
};

export default SettingsPage;
