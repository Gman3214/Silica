import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MainPage from './pages/MainPage';
import SettingsPage from './pages/SettingsPage';
import AddonsPage from './pages/AddonsPage';
import ProjectSelector from './components/ProjectSelector';
import { applyAccentColor } from './utils/colorUtils';
import './App.css';

// Import Google Fonts
import '@fontsource/inter';
import '@fontsource/roboto';
import '@fontsource/open-sans';
import '@fontsource/poppins';
import '@fontsource/lato';
import '@fontsource/nunito';
import '@fontsource/fira-code';
import '@fontsource/jetbrains-mono';
import '@fontsource/source-code-pro';
import '@fontsource/ubuntu-mono';
import '@fontsource/inconsolata';
import '@fontsource/cascadia-code';
import '@fontsource/roboto-mono';

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  useEffect(() => {
    // Load theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Load and apply font
    const savedFont = localStorage.getItem('appFont') || 'system';
    const fontFamilies: { [key: string]: string } = {
      'system': '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif',
      'inter': '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      'roboto': '"Roboto", -apple-system, BlinkMacSystemFont, sans-serif',
      'open-sans': '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
      'poppins': '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
      'lato': '"Lato", -apple-system, BlinkMacSystemFont, sans-serif',
      'nunito': '"Nunito", -apple-system, BlinkMacSystemFont, sans-serif',
      'fira-code': '"Fira Code", "Monaco", "Consolas", monospace',
      'jetbrains': '"JetBrains Mono", "Monaco", "Consolas", monospace',
      'source-code-pro': '"Source Code Pro", "Monaco", "Consolas", monospace',
      'ubuntu-mono': '"Ubuntu Mono", "Monaco", "Consolas", monospace',
      'inconsolata': '"Inconsolata", "Monaco", "Consolas", monospace',
      'cascadia-code': '"Cascadia Code", "Monaco", "Consolas", monospace',
      'roboto-mono': '"Roboto Mono", "Monaco", "Consolas", monospace',
    };
    document.documentElement.style.setProperty('--app-font', fontFamilies[savedFont] || fontFamilies.system);

    // Load and apply accent color
    const savedAccentColor = localStorage.getItem('accentColor');
    if (savedAccentColor) {
      applyAccentColor(savedAccentColor);
    }

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
    
    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('themeChange', { detail: newTheme }));
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
        <AppContent theme={theme} onThemeChange={toggleTheme} />
      </div>
    </Router>
  );
};

// Separate component to use useLocation hook
const AppContent: React.FC<{ theme: 'light' | 'dark'; onThemeChange: (theme: 'light' | 'dark') => void }> = ({ theme, onThemeChange }) => {
  const location = useLocation();
  
  return (
    <div className="main-content">
      <div style={{ display: location.pathname === '/' ? 'flex' : 'none', width: '100%', height: '100%', flex: 1 }}>
        <MainPage />
      </div>
      <div style={{ display: location.pathname === '/settings' ? 'flex' : 'none', width: '100%', height: '100%', flex: 1 }}>
        <SettingsPage theme={theme} onThemeChange={onThemeChange} />
      </div>
      <div style={{ display: location.pathname === '/addons' ? 'flex' : 'none', width: '100%', height: '100%', flex: 1 }}>
        <AddonsPage />
      </div>
    </div>
  );
};

export default App;
