import React, { useState } from 'react';
import './ProjectSelector.css';

interface ProjectSelectorProps {
  onProjectSelected: (folderPath: string) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onProjectSelected }) => {
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        await window.electronAPI.setSetting('lastProjectPath', folderPath);
        onProjectSelected(folderPath);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="project-selector-overlay">
      <div className="project-selector-modal">
        <div className="project-selector-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h1>Welcome to Silica</h1>
        <p>Select a folder to store your notes</p>
        <button 
          className="select-folder-btn" 
          onClick={handleSelectFolder}
          disabled={isSelecting}
        >
          {isSelecting ? 'Selecting...' : 'Select Folder'}
        </button>
        <span className="hint-text">You can change this later in Settings</span>
      </div>
    </div>
  );
};

export default ProjectSelector;
