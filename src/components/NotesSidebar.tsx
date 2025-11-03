import React from 'react';
import WorkspaceTabs from './WorkspaceTabs';
import WorkspaceHeader from './WorkspaceHeader';
import NoteList from './NoteList';
import './NotesSidebar.css';

interface Note {
  name: string;
  path: string;
  modified: number;
  isFolder?: boolean;
  isWorkspace?: boolean;
  workspaceColor?: string;
}

interface NotesSidebarProps {
  notes: Note[];
  allNotes: Note[];
  workspaces: Array<{ name: string; path: string; color: string }>;
  activeWorkspace: string | null;
  tags: { [tag: string]: Array<{ name: string; path: string }> };
  selectedNote: string | null;
  expandedFolders: Set<string>;
  expandedTags: Set<string>;
  folderContents: Map<string, Note[]>;
  draggedNote: Note | null;
  creatingFolder: boolean;
  newFolderName: string;
  creatingWorkspace: boolean;
  newWorkspaceName: string;
  newWorkspaceColor: string;
  isLoading: boolean;
  onNoteClick: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, note: Note) => void;
  onToggleFolder: (path: string) => void;
  onToggleTag: (tag: string) => void;
  onWorkspaceSelect: (path: string | null) => void;
  onWorkspaceNameChange: (path: string | null, newName: string) => void;
  onWorkspaceColorChange: (path: string | null, newColor: string) => void;
  onWorkspaceDelete: (path: string | null) => void;
  onWorkspaceSettings: (path: string | null) => void;
  onWorkspaceDrop?: (workspacePath: string | null, e: React.DragEvent) => void;
  onNoteDragStart: (e: React.DragEvent, note: Note) => void;
  onNoteDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent) => void;
  onFolderDrop: (e: React.DragEvent, note: Note) => void;
  onRootDragOver: (e: React.DragEvent) => void;
  onRootDrop: (e: React.DragEvent) => void;
  onNewFolderNameChange: (name: string) => void;
  onConfirmCreateFolder: () => void;
  onCancelCreateFolder: () => void;
  onConfirmCreateWorkspace: (name?: string) => void;
  onCancelCreateWorkspace: () => void;
  onNewNote: () => void;
  onNewFolder: () => void;
  onNewWorkspace: () => void;
  formatDate: (timestamp: number) => string;
}

const NotesSidebar: React.FC<NotesSidebarProps> = ({
  notes,
  allNotes,
  workspaces,
  activeWorkspace,
  tags,
  selectedNote,
  expandedFolders,
  expandedTags,
  folderContents,
  draggedNote,
  creatingFolder,
  newFolderName,
  creatingWorkspace,
  newWorkspaceName,
  newWorkspaceColor,
  isLoading,
  onNoteClick,
  onContextMenu,
  onToggleFolder,
  onToggleTag,
  onWorkspaceSelect,
  onWorkspaceNameChange,
  onWorkspaceColorChange,
  onWorkspaceDelete,
  onWorkspaceSettings,
  onWorkspaceDrop,
  onNoteDragStart,
  onNoteDragEnd,
  onFolderDragOver,
  onFolderDrop,
  onRootDragOver,
  onRootDrop,
  onNewFolderNameChange,
  onConfirmCreateFolder,
  onCancelCreateFolder,
  onConfirmCreateWorkspace,
  onCancelCreateWorkspace,
  onNewNote,
  onNewFolder,
  onNewWorkspace,
  formatDate,
}) => {
  const activeWorkspaceData = workspaces.find(w => w.path === activeWorkspace);
  const workspaceName = activeWorkspace === null ? 'Default' : (activeWorkspaceData?.name || 'Unknown');
  const workspaceColor = activeWorkspaceData?.color;

  return (
    <div className="notes-sidebar">
      <WorkspaceTabs
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onWorkspaceSelect={onWorkspaceSelect}
        onNewWorkspace={onNewWorkspace}
        onWorkspaceDrop={onWorkspaceDrop}
      />
      <WorkspaceHeader
        workspaceName={creatingWorkspace ? newWorkspaceName : workspaceName}
        workspaceColor={workspaceColor}
        isShared={activeWorkspace === null && !creatingWorkspace}
        isCreating={creatingWorkspace}
        onNameChange={(newName) => {
          if (creatingWorkspace) {
            // Pass the final name directly to create the workspace
            onConfirmCreateWorkspace(newName);
          } else {
            // When editing existing workspace
            onWorkspaceNameChange(activeWorkspace, newName);
          }
        }}
        onColorChange={activeWorkspace ? (newColor) => onWorkspaceColorChange(activeWorkspace, newColor) : undefined}
        onDelete={activeWorkspace ? () => onWorkspaceDelete(activeWorkspace) : undefined}
        onCancelCreate={onCancelCreateWorkspace}
        onSettingsClick={() => onWorkspaceSettings(activeWorkspace)}
      />
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
        onNewNote={onNewNote}
        formatDate={formatDate}
      />
    </div>
  );
};

export default NotesSidebar;
