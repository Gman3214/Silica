import React, { useState } from 'react';
import './ProjectSelector.css';
import logo from '../assets/logo.svg';

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
          <img src={logo} alt="Silica" style={{ width: '64px', height: '64px' }} />
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
