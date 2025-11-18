import React, { useState, useRef, useEffect } from 'react';
import { aiRouter } from '../lib/ai-router';
import './Floater.css';

interface FloaterProps {
  x: number;
  y: number;
  selectedText: string;
  onFormat: (format: string) => void;
  onAIAction: (prompt: string, selectedText: string) => void;
  onAIReplace?: (transformedText: string) => void;
  onAIAddAfter?: (transformedText: string) => void;
  onClose: () => void;
}

const Floater: React.FC<FloaterProps> = ({ x, y, selectedText, onFormat, onAIAction, onAIReplace, onAIAddAfter, onClose }) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [showMoreAIOptions, setShowMoreAIOptions] = useState(false);
  const [isAIConfigured, setIsAIConfigured] = useState(false);
  const [isCheckingAI, setIsCheckingAI] = useState(true);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Load last active tab from localStorage
  const [activeTab, setActiveTab] = useState<'ai' | 'format'>(() => {
    const saved = localStorage.getItem('floaterActiveTab');
    return (saved as 'ai' | 'format') || 'ai';
  });
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Load AI commands from localStorage
  interface AICommand {
    id: string;
    label: string;
    prompt: string;
    pinned: boolean;
  }

  const [aiCommands, setAiCommands] = useState<AICommand[]>(() => {
    const saved = localStorage.getItem('aiCommands');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default commands if none exist
    return [
      { id: '1', label: 'Format', prompt: 'Format this text properly', pinned: true },
      { id: '2', label: 'Summarize', prompt: 'Summarize this text', pinned: true },
      { id: '3', label: 'Shorten', prompt: 'Make this shorter', pinned: true },
      { id: '4', label: 'Expand', prompt: 'Expand on this', pinned: true },
      { id: '5', label: 'Fix grammar', prompt: 'Fix grammar and spelling', pinned: true },
    ];
  });

  // Get pinned and unpinned commands
  const pinnedCommands = aiCommands.filter(cmd => cmd.pinned);
  const unpinnedCommands = aiCommands.filter(cmd => !cmd.pinned);

  // Check AI configuration on mount
  useEffect(() => {
    const checkAI = async () => {
      try {
        const status = await aiRouter.getConnectionStatus();
        setIsAIConfigured(status.connected && status.provider !== 'none');
      } catch (error) {
        setIsAIConfigured(false);
      } finally {
        setIsCheckingAI(false);
      }
    };
    checkAI();
  }, []);

  // Save active tab to localStorage whenever it changes
  const handleTabChange = (tab: 'ai' | 'format') => {
    setActiveTab(tab);
    localStorage.setItem('floaterActiveTab', tab);
  };

  const handleFormat = (format: string) => {
    onFormat(format);
    onClose();
  };

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim() || !selectedText) return;

    setIsAIProcessing(true);
    setAiError(null);

    try {
      // Build the AI request
      const systemPrompt = `You are a helpful writing assistant. The user has selected some text and wants you to transform it based on their request. Only return the transformed text without any explanations, quotes, or additional commentary.`;
      
      const userPrompt = `${aiPrompt}\n\nText to transform:\n${selectedText}`;

      // Call AI router
      const response = await aiRouter.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        options: {
          temperature: 0.7,
          maxTokens: 500,
          topP: 0.9,
        }
      });

      // Get the transformed text
      let transformedText = response.content.trim();

      // Clean up common AI response artifacts
      transformedText = transformedText.replace(/^["']|["']$/g, ''); // Remove quotes
      transformedText = transformedText.replace(/^```[\w]*\n?|```$/g, ''); // Remove code blocks

      // Show preview
      setAiPreview(transformedText);
      
    } catch (error) {
      console.error('AI processing failed:', error);
      setAiError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleReplacePreview = () => {
    if (aiPreview && onAIReplace) {
      onAIReplace(aiPreview);
      onClose();
    }
  };

  const handleAddAfterPreview = () => {
    if (aiPreview && onAIAddAfter) {
      onAIAddAfter(aiPreview);
      onClose();
    }
  };

  const handleDiscardPreview = () => {
    setAiPreview(null);
    setAiError(null);
    setAiPrompt('');
  };

  return (
    <div 
      className="floater" 
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Tab Switcher */}
      <div className="floater-tabs">
        <button 
          className={`floater-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => handleTabChange('ai')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h-1.5c-.7 0-1.3.3-1.7.7-.4.4-.7 1-.8 1.6A2 2 0 0 0 16 18a2 2 0 0 0-1.5.7 2 2 0 0 0-.4 1.6 2 2 0 0 0 1.4 1.4 2 2 0 0 0 1.6-.4A2 2 0 0 0 18 20a2 2 0 0 0 1.7-1 2 2 0 0 0 1.6.5 2 2 0 0 0 1.4-1.4 2 2 0 0 0-.5-1.6A2 2 0 0 0 21 16h-1a5 5 0 0 0-5-5h-1V9.73c.6-.34 1-.99 1-1.73a2 2 0 0 0-2-2 2 2 0 0 0-2 2c0 .74.4 1.39 1 1.73V11h-1a5 5 0 0 0-5 5H5a2 2 0 0 0-1.7 1 2 2 0 0 0-.5 1.6 2 2 0 0 0 1.4 1.4 2 2 0 0 0 1.6-.5A2 2 0 0 0 8 20a2 2 0 0 0 .7-1.5 2 2 0 0 0-.5-1.6A2 2 0 0 0 6.5 16H5a7 7 0 0 1 7-7h1V7.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path>
          </svg>
          AI
        </button>
        <button 
          className={`floater-tab ${activeTab === 'format' ? 'active' : ''}`}
          onClick={() => handleTabChange('format')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 7 4 4 20 4 20 7"></polyline>
            <line x1="9" y1="20" x2="15" y2="20"></line>
            <line x1="12" y1="4" x2="12" y2="20"></line>
          </svg>
          Format
        </button>
      </div>

      {/* AI Section */}
      {activeTab === 'ai' && (
        <div className="floater-section floater-ai">
        {isCheckingAI ? (
          <div className="floater-ai-status">
            <div className="floater-loading">Checking AI connection...</div>
          </div>
        ) : !isAIConfigured ? (
          <div className="floater-ai-status">
            <div className="floater-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>AI not configured</span>
            </div>
            <p className="floater-hint">Configure an AI provider in Settings to use AI features.</p>
          </div>
        ) : aiPreview || isAIProcessing || aiError ? (
          <div className="floater-ai-preview-container">
            {isAIProcessing ? (
              <div className="floater-ai-status">
                <div className="floater-loading">
                  <svg className="floater-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Processing...
                </div>
              </div>
            ) : aiError ? (
              <div className="floater-ai-status">
                <div className="floater-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>Error: {aiError}</span>
                </div>
                <div className="floater-preview-actions">
                  <button className="floater-preview-btn floater-preview-discard" onClick={handleDiscardPreview}>
                    Try Again
                  </button>
                </div>
              </div>
            ) : aiPreview ? (
              <>
                <div className="floater-preview-header">
                  <span>AI Result:</span>
                </div>
                <div className="floater-preview-text">
                  {aiPreview}
                </div>
                <div className="floater-preview-actions">
                  <button className="floater-preview-btn floater-preview-discard" onClick={handleDiscardPreview}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Discard
                  </button>
                  <button className="floater-preview-btn floater-preview-replace" onClick={handleReplacePreview}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Replace
                  </button>
                  <button className="floater-preview-btn floater-preview-add" onClick={handleAddAfterPreview}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add After
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <>
        <form onSubmit={handleAISubmit} className="floater-ai-form">
          <input
            ref={inputRef}
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ask AI to transform text..."
            className="floater-ai-input"
          />
          <button type="submit" className="floater-ai-submit" disabled={!aiPrompt.trim()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
        <div className="floater-ai-suggestions">
          {pinnedCommands.map((command) => (
            <button 
              key={command.id}
              className="floater-suggestion-btn"
              onClick={() => {
                setAiPrompt(command.prompt);
                inputRef.current?.focus();
              }}
            >
              {command.label}
            </button>
          ))}
        </div>

        {/* More AI Options Dropdown */}
        {unpinnedCommands.length > 0 && (
        <div className="floater-more-options">
          <button 
            className="floater-toggle"
            onClick={() => setShowMoreAIOptions(!showMoreAIOptions)}
          >
            <span>{showMoreAIOptions ? 'Less' : 'More'} Options</span>
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ transform: showMoreAIOptions ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {showMoreAIOptions && (
            <div className="floater-expanded floater-ai-more">
              {unpinnedCommands.map((command) => (
                <button
                  key={command.id}
                  className="floater-suggestion-btn"
                  onClick={() => {
                    setAiPrompt(command.prompt);
                    inputRef.current?.focus();
                  }}
                >
                  {command.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}
        </>
        )}
      </div>
      )}

      {/* Formatting Section */}
      {activeTab === 'format' && (
      <div className="floater-section floater-formatting">
        {/* All formatting options in rows */}
        <div className="floater-btn-group">
          <button 
            className="floater-btn" 
            onClick={() => handleFormat('bold')}
            title="Bold (Ctrl+B)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
              <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            </svg>
          </button>
          <button 
            className="floater-btn" 
            onClick={() => handleFormat('italic')}
            title="Italic (Ctrl+I)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="4" x2="10" y2="4"></line>
              <line x1="14" y1="20" x2="5" y2="20"></line>
              <line x1="15" y1="4" x2="9" y2="20"></line>
            </svg>
          </button>
          <button 
            className="floater-btn" 
            onClick={() => handleFormat('underline')}
            title="Underline"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
              <line x1="4" y1="21" x2="20" y2="21"></line>
            </svg>
          </button>
          <button 
            className="floater-btn" 
            onClick={() => handleFormat('highlight')}
            title="Highlight"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 11-6 6v3h9l3-3"></path>
              <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
            </svg>
          </button>
          <button 
            className="floater-btn" 
            onClick={() => handleFormat('heading')}
            title="Heading"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 12h12"></path>
              <path d="M6 20V4"></path>
              <path d="M18 20V4"></path>
            </svg>
          </button>
          <button 
            className="floater-btn" 
            onClick={() => handleFormat('quote')}
            title="Quote"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
            </svg>
          </button>
          <button 
            className="floater-btn" 
            onClick={() => handleFormat('bullet-list')}
            title="Bullet List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </button>
          <button 
            className="floater-btn" 
            onClick={() => handleFormat('numbered-list')}
            title="Numbered List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="10" y1="6" x2="21" y2="6"></line>
              <line x1="10" y1="12" x2="21" y2="12"></line>
              <line x1="10" y1="18" x2="21" y2="18"></line>
              <path d="M4 6h1v4"></path>
              <path d="M4 10h2"></path>
              <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
            </svg>
          </button>
          <button 
            className="floater-btn" 
            onClick={() => handleFormat('task-list')}
            title="Task List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </button>
        </div>

        {/* Links */}
        <div className="floater-btn-group">
          <button 
            className="floater-btn floater-btn-wide" 
            onClick={() => handleFormat('internal-link')}
            title="Internal Link"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <span>Link to Note</span>
          </button>
          <button 
            className="floater-btn floater-btn-wide" 
            onClick={() => handleFormat('external-link')}
            title="External Link"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            <span>External Link</span>
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

export default Floater;
