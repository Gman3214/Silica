import React from 'react';
import './NoteList.css';

interface Note {
  name: string;
  path: string;
  modified: number;
  isFolder?: boolean;
  isWorkspace?: boolean;
  workspaceColor?: string;
}

interface NoteListProps {
  notes: Note[];
  tags: { [tag: string]: Array<{ name: string; path: string }> };
  selectedNote: string | null;
  expandedFolders: Set<string>;
  expandedTags: Set<string>;
  folderContents: Map<string, Note[]>;
  draggedNote: Note | null;
  creatingFolder: boolean;
  newFolderName: string;
  isLoading: boolean;
  onNoteClick: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, note: Note) => void;
  onToggleFolder: (path: string) => void;
  onToggleTag: (tag: string) => void;
  onNoteDragStart: (e: React.DragEvent, note: Note) => void;
  onNoteDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent) => void;
  onFolderDrop: (e: React.DragEvent, note: Note) => void;
  onRootDragOver: (e: React.DragEvent) => void;
  onRootDrop: (e: React.DragEvent) => void;
  onNewFolderNameChange: (name: string) => void;
  onConfirmCreateFolder: () => void;
  onCancelCreateFolder: () => void;
  onNewNote: () => void;
  formatDate: (timestamp: number) => string;
}

const NoteList: React.FC<NoteListProps> = ({
  notes,
  tags,
  selectedNote,
  expandedFolders,
  expandedTags,
  folderContents,
  draggedNote,
  creatingFolder,
  newFolderName,
  isLoading,
  onNoteClick,
  onContextMenu,
  onToggleFolder,
  onToggleTag,
  onNoteDragStart,
  onNoteDragEnd,
  onFolderDragOver,
  onFolderDrop,
  onRootDragOver,
  onRootDrop,
  onNewFolderNameChange,
  onConfirmCreateFolder,
  onCancelCreateFolder,
  onNewNote,
  formatDate,
}) => {
  return (
    <div 
      className="notes-list"
      onDragOver={onRootDragOver}
      onDrop={onRootDrop}
    >
      {isLoading ? (
        <div className="loading">Loading notes...</div>
      ) : (
        <>
          {/* Add Note Button */}
          <button className="add-note-list-btn" onClick={onNewNote} title="New Note">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M10 2V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8 7V11M6 9H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>New Note</span>
          </button>
          
          {creatingFolder && (
            <div className="folder-item creating">
              <div className="folder-header">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="folder-icon">
                  <path d="M2 4H7L8 5H14V13H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                <input
                  type="text"
                  className="folder-name-input"
                  value={newFolderName}
                  onChange={(e) => onNewFolderNameChange(e.target.value)}
                  onBlur={onConfirmCreateFolder}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onConfirmCreateFolder();
                    } else if (e.key === 'Escape') {
                      onCancelCreateFolder();
                    }
                  }}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
          )}
          {notes.length === 0 && Object.keys(tags).length === 0 && !creatingFolder ? (
            <div className="empty-state">
              No notes yet. Create one!
            </div>
          ) : (
            <>
              {/* Render tags */}
              {Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)).map(([tag, tagNotes]) => (
                <div key={`tag-${tag}`} className="folder-item tag-item">
                  <div 
                    className="folder-header"
                    onClick={() => onToggleTag(tag)}
                  >
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 12 12" 
                      fill="none"
                      className={`folder-chevron ${expandedTags.has(tag) ? 'expanded' : ''}`}
                    >
                      <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="tag-icon">
                      <path d="M3 3L9 3L13 7L8 12L4 8L3 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <circle cx="7.5" cy="6.5" r="1" fill="currentColor"/>
                    </svg>
                    <h3>{tag}</h3>
                    <span className="tag-count">{tagNotes.length}</span>
                  </div>
                  {expandedTags.has(tag) && (
                    <div className="folder-contents">
                      {tagNotes.map((note) => (
                        <div 
                          key={note.path}
                          className={`note-item ${selectedNote === note.path ? 'active' : ''}`}
                          onClick={() => onNoteClick(note.path)}
                          onContextMenu={(e) => onContextMenu(e, note as Note)}
                        >
                          <h3>{note.name}</h3>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Render notes */}
              {notes.filter(note => !note.isFolder && !note.isWorkspace).map((note) => (
                <div 
                  key={note.path}
                  className={`note-item ${selectedNote === note.path ? 'active' : ''} ${draggedNote?.path === note.path ? 'dragging' : ''}`}
                  onClick={() => onNoteClick(note.path)}
                  onContextMenu={(e) => onContextMenu(e, note)}
                  draggable
                  onDragStart={(e) => onNoteDragStart(e, note)}
                  onDragEnd={onNoteDragEnd}
                >
                  <h3>{note.name}</h3>
                  <span className="note-date">{formatDate(note.modified)}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default NoteList;

