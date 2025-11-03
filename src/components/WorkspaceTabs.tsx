import React, { useState } from 'react';
import './WorkspaceTabs.css';

interface Workspace {
  name: string;
  path: string;
  color: string;
}

interface WorkspaceTabsProps {
  workspaces: Workspace[];
  activeWorkspace: string | null;
  onWorkspaceSelect: (path: string | null) => void;
  onNewWorkspace: () => void;
  onWorkspaceDrop?: (workspacePath: string | null, e: React.DragEvent) => void;
}

const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  workspaces,
  activeWorkspace,
  onWorkspaceSelect,
  onNewWorkspace,
  onWorkspaceDrop,
}) => {
  const [dragOverWorkspace, setDragOverWorkspace] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, workspacePath: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverWorkspace(workspacePath === null ? 'shared' : workspacePath);
  };

  const handleDragLeave = () => {
    setDragOverWorkspace(null);
  };

  const handleDrop = (workspacePath: string | null, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverWorkspace(null);
    if (onWorkspaceDrop) {
      onWorkspaceDrop(workspacePath, e);
    }
  };

  return (
    <div className="workspace-tabs-container">
      <div className="workspace-tabs">
        {/* Default workspace tab (always first) */}
        <div
          className={`workspace-tab ${activeWorkspace === null ? 'active' : ''} ${dragOverWorkspace === 'shared' ? 'drag-over' : ''}`}
          onClick={() => onWorkspaceSelect(null)}
          onDragOver={(e) => handleDragOver(e, null)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(null, e)}
          title="Default"
        >
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" className="workspace-tab-icon">
            <circle cx="5.5" cy="9" r="2.5" stroke="#6b7280" strokeWidth="1.5"/>
            <circle cx="12.5" cy="9" r="2.5" stroke="#6b7280" strokeWidth="1.5"/>
            <path d="M8 9H10" stroke="#6b7280" strokeWidth="1.5"/>
          </svg>
        </div>

        {/* Workspace tabs */}
        {workspaces.map((workspace) => (
          <div
            key={workspace.path}
            className={`workspace-tab ${activeWorkspace === workspace.path ? 'active' : ''} ${dragOverWorkspace === workspace.path ? 'drag-over' : ''}`}
            onClick={() => onWorkspaceSelect(workspace.path)}
            onDragOver={(e) => handleDragOver(e, workspace.path)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(workspace.path, e)}
            style={{ '--workspace-color': workspace.color } as React.CSSProperties}
            title={workspace.name}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" className="workspace-tab-icon">
              <rect x="3" y="3" width="12" height="12" rx="2" stroke={workspace.color} strokeWidth="1.5"/>
              <circle cx="9" cy="9" r="2" fill={workspace.color}/>
            </svg>
          </div>
        ))}

        {/* Add workspace button */}
        <button className="workspace-tab-add" onClick={onNewWorkspace} title="New Workspace">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default WorkspaceTabs;
