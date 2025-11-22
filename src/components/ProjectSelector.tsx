import React, { useState, useEffect } from 'react';
import './ProjectSelector.css';
import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';

interface ProjectSelectorProps {
  onProjectSelected: (folderPath: string) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onProjectSelected }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);

    // Listen for theme changes via custom event
    const handleThemeChange = (e: CustomEvent) => {
      setTheme(e.detail);
    };

    window.addEventListener('themeChange', handleThemeChange as EventListener);
    return () => window.removeEventListener('themeChange', handleThemeChange as EventListener);
  }, []);

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
          <img src={theme === 'dark' ? logoDark : logoLight} alt="Silica" style={{ width: '64px', height: '64px' }} />
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
