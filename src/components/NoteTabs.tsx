import React, { useState, useRef, useEffect } from 'react';
import './NoteTabs.css';

interface Tab {
  path: string;
  name: string;
}

interface NoteTabsProps {
  tabs: Tab[];
  activeTab: string | null;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
  onTabsReorder: (tabs: Tab[]) => void;
}

const NoteTabs: React.FC<NoteTabsProps> = ({ 
  tabs, 
  activeTab, 
  onTabSelect, 
  onTabClose,
  onTabsReorder 
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Calculate dynamic tab width based on number of tabs
  const getTabWidth = () => {
    const tabCount = tabs.length;
    if (tabCount <= 3) return '240px';
    if (tabCount <= 5) return '200px';
    if (tabCount <= 8) return '160px';
    return '140px';
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    
    // Add a slight transparency to the dragged element
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex === null || draggedIndex === index) return;
    
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newTabs = [...tabs];
    const draggedTab = newTabs[draggedIndex];
    
    // Remove from old position
    newTabs.splice(draggedIndex, 1);
    
    // Insert at new position
    newTabs.splice(dropIndex, 0, draggedTab);
    
    onTabsReorder(newTabs);
    setDragOverIndex(null);
  };

  const handleCloseTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    onTabClose(path);
  };

  return (
    <div className="note-tabs" ref={tabsRef}>
      <div className="tabs-container">
        {tabs.map((tab, index) => (
          <React.Fragment key={tab.path}>
            <div
              className={`tab ${activeTab === tab.path ? 'active' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
              onClick={() => onTabSelect(tab.path)}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              style={{ width: getTabWidth() }}
            >
              <span className="tab-name" title={tab.name}>
                {tab.name}
              </span>
              <button 
                className="tab-close"
                onClick={(e) => handleCloseTab(e, tab.path)}
                aria-label="Close tab"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path 
                    d="M9 3L3 9M3 3L9 9" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            {index < tabs.length - 1 && (
              <svg className="tab-separator" width="2" height="12" viewBox="0 0 2 12" fill="none">
                <line 
                  x1="1" 
                  y1="0" 
                  x2="1" 
                  y2="12" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round"
                />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default NoteTabs;
