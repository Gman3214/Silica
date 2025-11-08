import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

export interface ContextMenuItem {
  label?: string;
  action?: () => void;
  type?: 'item' | 'divider';
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.action) {
      item.action();
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => {
        if (item.type === 'divider') {
          return <div key={index} className="context-menu-divider" />;
        }
        return (
          <button
            key={index}
            className="context-menu-item"
            onClick={() => handleItemClick(item)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;
