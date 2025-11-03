import React, { useState } from 'react';
import './TextFormatToolbar.css';

interface TextFormatToolbarProps {
  x: number;
  y: number;
  onFormat: (format: string) => void;
  onClose: () => void;
}

const TextFormatToolbar: React.FC<TextFormatToolbarProps> = ({ x, y, onFormat, onClose }) => {
  const [showTextOptions, setShowTextOptions] = useState(false);

  const handleFormat = (format: string) => {
    onFormat(format);
    onClose();
  };

  return (
    <div 
      className="text-format-toolbar" 
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top row - basic formatting */}
      <div className="toolbar-row">
        <button 
          className="toolbar-btn" 
          onClick={() => handleFormat('bold')}
          title="Bold"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          </svg>
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => handleFormat('italic')}
          title="Italic"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="4" x2="10" y2="4"></line>
            <line x1="14" y1="20" x2="5" y2="20"></line>
            <line x1="15" y1="4" x2="9" y2="20"></line>
          </svg>
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => handleFormat('underline')}
          title="Underline"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
            <line x1="4" y1="21" x2="20" y2="21"></line>
          </svg>
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => handleFormat('highlight')}
          title="Highlight"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 11-6 6v3h9l3-3"></path>
            <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
          </svg>
        </button>
      </div>

      {/* Second row - links */}
      <div className="toolbar-row">
        <button 
          className="toolbar-btn toolbar-btn-wide" 
          onClick={() => handleFormat('internal-link')}
          title="Internal Link"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          <span>Internal Link</span>
        </button>
        <button 
          className="toolbar-btn toolbar-btn-wide" 
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

      {/* Third row - text options (collapsible) */}
      <div className="toolbar-row">
        <button 
          className="toolbar-btn toolbar-btn-expand" 
          onClick={() => setShowTextOptions(!showTextOptions)}
          title="Text Options"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 7 4 4 20 4 20 7"></polyline>
            <line x1="9" y1="20" x2="15" y2="20"></line>
            <line x1="12" y1="4" x2="12" y2="20"></line>
          </svg>
          <span>Text</span>
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ 
              transform: showTextOptions ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      {/* Expanded text options */}
      {showTextOptions && (
        <div className="toolbar-expanded">
          <button 
            className="toolbar-btn toolbar-btn-wide" 
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
            <span>Bullet List</span>
          </button>
          <button 
            className="toolbar-btn toolbar-btn-wide" 
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
            <span>Numbered List</span>
          </button>
          <button 
            className="toolbar-btn toolbar-btn-wide" 
            onClick={() => handleFormat('task-list')}
            title="Task List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span>Task List</span>
          </button>
          <button 
            className="toolbar-btn toolbar-btn-wide" 
            onClick={() => handleFormat('heading')}
            title="Heading"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 12h12"></path>
              <path d="M6 20V4"></path>
              <path d="M18 20V4"></path>
            </svg>
            <span>Heading</span>
          </button>
          <button 
            className="toolbar-btn toolbar-btn-wide" 
            onClick={() => handleFormat('quote')}
            title="Quote"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
            </svg>
            <span>Quote</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TextFormatToolbar;
