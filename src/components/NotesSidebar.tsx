import React from 'react';
import NoteList from './NoteList';
import './NotesSidebar.css';

interface Note {
  name: string;
  path: string;
  modified: number;
  isFolder?: boolean;
}

interface NotesSidebarProps {
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
  onNewFolder: () => void;
  formatDate: (timestamp: number) => string;
}

const NotesSidebar: React.FC<NotesSidebarProps> = ({
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
  onNewFolder,
  formatDate,
}) => {
  return (
    <div className="notes-sidebar">
      <div className="action-buttons">
        <button className="add-note-btn" onClick={onNewNote} title="New Note">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M10 2V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M8 7V11M6 9H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="add-folder-btn" onClick={onNewFolder} title="New Folder">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4H7L8 5H14V13H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M8 8V11M6.5 9.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <NoteList
        notes={notes}
        tags={tags}
        selectedNote={selectedNote}
        expandedFolders={expandedFolders}
        expandedTags={expandedTags}
        folderContents={folderContents}
        draggedNote={draggedNote}
        creatingFolder={creatingFolder}
        newFolderName={newFolderName}
        isLoading={isLoading}
        onNoteClick={onNoteClick}
        onContextMenu={onContextMenu}
        onToggleFolder={onToggleFolder}
        onToggleTag={onToggleTag}
        onNoteDragStart={onNoteDragStart}
        onNoteDragEnd={onNoteDragEnd}
        onFolderDragOver={onFolderDragOver}
        onFolderDrop={onFolderDrop}
        onRootDragOver={onRootDragOver}
        onRootDrop={onRootDrop}
        onNewFolderNameChange={onNewFolderNameChange}
        onConfirmCreateFolder={onConfirmCreateFolder}
        onCancelCreateFolder={onCancelCreateFolder}
        formatDate={formatDate}
      />
    </div>
  );
};

export default NotesSidebar;
