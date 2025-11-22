import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';
import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';
import feather from 'feather-icons';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const iconsRef = useRef<HTMLDivElement>(null);
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

  const menuItems = [
    {
      path: '/',
      iconName: 'file-text',
      label: 'Notes',
      title: 'Notes'
    },
    {
      path: '/settings',
      iconName: 'settings',
      label: 'Settings',
      title: 'Settings'
    },
    {
      path: '/addons',
      iconName: 'package',
      label: 'Addons',
      title: 'Addons'
    }
  ];

  useEffect(() => {
    // Replace all feather icons after component mounts
    feather.replace();
  }, [location.pathname]); // Re-run when location changes to ensure icons are rendered

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="app-logo">
          <img src={theme === 'dark' ? logoDark : logoLight} alt="Silica" />
        </div>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.path}
            className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            data-tooltip={item.label}
          >
            <i data-feather={item.iconName} className="sidebar-icon"></i>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
