import React, { useState, useEffect, useRef } from 'react';
import feather from 'feather-icons';
import './WorkspaceHeader.css';

interface WorkspaceHeaderProps {
  workspaceName: string;
  workspaceColor?: string;
  workspaceIcon?: string;
  isShared: boolean;
  isCreating?: boolean;
  onNameChange: (newName: string) => void;
  onColorChange?: (newColor: string) => void;
  onIconChange?: (newIcon: string) => void;
  onDelete?: () => void;
  onSettingsClick: () => void;
  onCancelCreate?: () => void;
}

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  workspaceName,
  workspaceColor,
  workspaceIcon,
  isShared,
  isCreating = false,
  onNameChange,
  onColorChange,
  onIconChange,
  onDelete,
  onSettingsClick,
  onCancelCreate,
}) => {
  const [isEditing, setIsEditing] = useState(isCreating);
  const [editName, setEditName] = useState(workspaceName);
  const [clickCount, setClickCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setEditName(workspaceName);
    setIsEditing(isCreating);
  }, [workspaceName, isCreating]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
        setShowColorPicker(false);
        setShowIconPicker(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleClick = () => {
    if (isShared) return; // Don't allow editing Shared workspace name
    
    setClickCount(prev => prev + 1);

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    if (clickCount === 1) {
      // Double click detected
      setIsEditing(true);
      setClickCount(0);
    } else {
      // Wait for potential second click
      clickTimeoutRef.current = setTimeout(() => {
        setClickCount(0);
      }, 300);
    }
  };

  const handleBlur = () => {
    if (isCreating) {
      // When creating, always commit the name (or cancel if empty)
      if (editName.trim()) {
        onNameChange(editName.trim());
      } else if (onCancelCreate) {
        onCancelCreate();
      }
      setIsEditing(false);
    } else {
      // When editing existing, revert if unchanged or empty
      if (editName.trim() && editName !== workspaceName) {
        onNameChange(editName.trim());
      } else {
        setEditName(workspaceName);
      }
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      if (isCreating && onCancelCreate) {
        onCancelCreate();
      } else {
        setEditName(workspaceName);
      }
      setIsEditing(false);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isShared) {
      setShowMenu(!showMenu);
    } else {
      onSettingsClick();
    }
  };

  const handleColorChange = (color: string) => {
    if (onColorChange) {
      onColorChange(color);
    }
    setShowColorPicker(false);
    setShowMenu(false);
  };

  const handleIconChange = (icon: string) => {
    if (onIconChange) {
      onIconChange(icon);
    }
    setShowIconPicker(false);
    setShowMenu(false);
  };

  const handleDeleteClick = () => {
    setShowMenu(false);
    setShowDeleteDialog(true);
    setDeleteConfirmName('');
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmName === workspaceName && onDelete) {
      onDelete();
      setShowDeleteDialog(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setDeleteConfirmName('');
  };

  const colors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
    '#06b6d4', // cyan
  ];

  const AVAILABLE_ICONS = [
    'briefcase', 'code', 'coffee', 'cpu', 'database', 'file-text', 'folder', 
    'globe', 'heart', 'home', 'image', 'layers', 'layout', 'music', 'package', 
    'pen-tool', 'settings', 'smile', 'star', 'terminal', 'tool', 'user', 'zap'
  ];

  const icons = [
    'folder', 'briefcase', 'book', 'star', 'heart', 'flag', 'tag', 'bookmark',
    'monitor', 'smartphone', 'cpu', 'database', 'hard-drive', 'server',
    'activity', 'airplay', 'anchor', 'aperture', 'archive', 'award',
    'bar-chart', 'battery', 'bell', 'bluetooth', 'box', 'camera',
    'cast', 'check-circle', 'clipboard', 'clock', 'cloud', 'code',
    'coffee', 'command', 'compass', 'copy', 'credit-card', 'crop',
    'crosshair', 'disc', 'dollar-sign', 'download', 'droplet', 'edit',
    'eye', 'feather', 'file', 'film', 'filter', 'gift', 'globe',
    'grid', 'hash', 'headphones', 'home', 'image', 'inbox', 'key',
    'layers', 'layout', 'life-buoy', 'link', 'list', 'lock', 'mail',
    'map', 'menu', 'message-circle', 'message-square', 'mic', 'moon',
    'mouse-pointer', 'music', 'navigation', 'package', 'paperclip',
    'pause', 'pen-tool', 'percent', 'phone', 'pie-chart', 'play',
    'plus', 'pocket', 'power', 'printer', 'radio', 'refresh-cw',
    'repeat', 'save', 'scissors', 'search', 'send', 'settings',
    'share', 'shield', 'shopping-bag', 'shopping-cart', 'shuffle',
    'sidebar', 'sliders', 'smile', 'speaker', 'square', 'sun',
    'tablet', 'target', 'terminal', 'thermometer', 'thumbs-up',
    'toggle-left', 'toggle-right', 'tool', 'trash', 'trello',
    'trending-up', 'triangle', 'truck', 'tv', 'twitch', 'twitter',
    'type', 'umbrella', 'underline', 'unlock', 'upload', 'user',
    'users', 'video', 'voicemail', 'volume-2', 'watch', 'wifi',
    'wind', 'x', 'zap', 'zoom-in', 'zoom-out'
  ];

  return (
    <div className="workspace-header-container" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="workspace-header-content">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="workspace-header-name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div className="workspace-header-name" onClick={handleClick}>
            <h2>{workspaceName}</h2>
          </div>
        )}
        {!isShared && (
          <div style={{ position: 'relative' }}>
            <button
              ref={buttonRef}
              className="workspace-header-settings"
              onClick={handleMenuClick}
              title="Workspace Settings"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="3" r="1.5" fill="currentColor"/>
                <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="8" cy="13" r="1.5" fill="currentColor"/>
              </svg>
            </button>

            {showMenu && !isShared && (
            <div ref={menuRef} className="workspace-menu">
              <button
                className="workspace-menu-item"
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowIconPicker(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <circle cx="8" cy="8" r="3" fill="currentColor"/>
                </svg>
                Change Color
              </button>
              
              {showColorPicker && (
                <div className="color-picker-dropdown">
                  {colors.map(color => (
                    <button
                      key={color}
                      className="color-option"
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorChange(color)}
                      title={color}
                    />
                  ))}
                </div>
              )}

              <button
                className="workspace-menu-item"
                onClick={() => {
                  setShowIconPicker(!showIconPicker);
                  setShowColorPicker(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                Change Icon
              </button>

              {showIconPicker && (
                <div className="icon-picker-dropdown">
                  {icons.map(icon => (
                    <button
                      key={icon}
                      className={`icon-option ${workspaceIcon === icon ? 'selected' : ''}`}
                      onClick={() => handleIconChange(icon)}
                      title={icon}
                    >
                      <span 
                        className="icon-svg-wrapper"
                        dangerouslySetInnerHTML={{ 
                          __html: feather.icons[icon] ? feather.icons[icon].toSvg({ 
                            width: 16, 
                            height: 16, 
                            'stroke-width': 2,
                            class: 'feather-icon'
                          }) : '' 
                        }} 
                      />
                    </button>
                  ))}
                </div>
              )}

              <button
                className="workspace-menu-item danger"
                onClick={handleDeleteClick}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4H13M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M6.5 7.5V11.5M9.5 7.5V11.5M4 4H12V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Delete Workspace
              </button>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="dialog-overlay" onClick={handleCancelDelete}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Workspace</h3>
            <p className="dialog-warning">
              All notes in this workspace will be permanently deleted and cannot be restored.
            </p>
            <p className="dialog-instruction">
              Type the workspace name <strong>"{workspaceName}"</strong> to confirm:
            </p>
            <input
              type="text"
              className="dialog-input"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Workspace name"
              autoFocus
            />
            <div className="dialog-actions">
              <button className="dialog-button cancel" onClick={handleCancelDelete}>
                Cancel
              </button>
              <button
                className="dialog-button delete"
                onClick={handleConfirmDelete}
                disabled={deleteConfirmName !== workspaceName}
              >
                Delete Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceHeader;
