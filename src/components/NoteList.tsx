import React from 'react';
import './NoteList.css';

interface Note {
  name: string;
  path: string;
  modified: number;
  isFolder?: boolean;
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
              
              {/* Render folders and notes */}
              {notes.map((note) => (
                <div key={note.path}>
                  {note.isFolder ? (
                    <div 
                      className={`folder-item ${draggedNote && !draggedNote.isFolder ? 'drop-target' : ''}`}
                      onDragOver={onFolderDragOver}
                      onDrop={(e) => onFolderDrop(e, note)}
                    >
                      <div 
                        className="folder-header"
                        onClick={() => onToggleFolder(note.path)}
                        onContextMenu={(e) => onContextMenu(e, note)}
                      >
                        <svg 
                          width="12" 
                          height="12" 
                          viewBox="0 0 12 12" 
                          fill="none"
                          className={`folder-chevron ${expandedFolders.has(note.path) ? 'expanded' : ''}`}
                        >
                          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="folder-icon">
                          <path d="M2 4H7L8 5H14V13H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                        <h3>{note.name}</h3>
                      </div>
                      {expandedFolders.has(note.path) && (
                        <div className="folder-contents">
                          {folderContents.get(note.path)?.length === 0 ? (
                            <div className="empty-folder">Empty folder</div>
                          ) : (
                            folderContents.get(note.path)?.map((subNote) => (
                              <div 
                                key={subNote.path}
                                className={`note-item ${selectedNote === subNote.path ? 'active' : ''} ${draggedNote?.path === subNote.path ? 'dragging' : ''}`}
                                onClick={() => onNoteClick(subNote.path)}
                                onContextMenu={(e) => onContextMenu(e, subNote)}
                                draggable={!subNote.isFolder}
                                onDragStart={(e) => onNoteDragStart(e, subNote)}
                                onDragEnd={onNoteDragEnd}
                              >
                                <h3>{subNote.name}</h3>
                                <span className="note-date">{formatDate(subNote.modified)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
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
                  )}
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
