import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';
import logo from '../assets/logo.svg';
import feather from 'feather-icons';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const iconsRef = useRef<HTMLDivElement>(null);

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
          <img src={logo} alt="Silica" />
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
