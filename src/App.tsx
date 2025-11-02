import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MainPage from './pages/MainPage';
import SettingsPage from './pages/SettingsPage';
import AddonsPage from './pages/AddonsPage';
import ProjectSelector from './components/ProjectSelector';
import './App.css';

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  useEffect(() => {
    // Load theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Check for last opened project
    const loadLastProject = async () => {
      try {
        const lastPath = await window.electronAPI.getSetting('lastProjectPath');
        setProjectPath(lastPath || null);
      } catch (error) {
        console.error('Failed to load last project:', error);
        setProjectPath(null);
      } finally {
        setIsLoadingProject(false);
      }
    };

    loadLastProject();
  }, []);

  const toggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleProjectSelected = (folderPath: string) => {
    setProjectPath(folderPath);
  };

  // Show loading state while checking for project
  if (isLoadingProject) {
    return null;
  }

  // Show project selector if no project is set
  if (!projectPath) {
    return <ProjectSelector onProjectSelected={handleProjectSelected} />;
  }

  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/settings" element={<SettingsPage theme={theme} onThemeChange={toggleTheme} />} />
            <Route path="/addons" element={<AddonsPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
