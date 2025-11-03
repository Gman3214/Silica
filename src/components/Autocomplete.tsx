import React, { useEffect, useRef } from 'react';
import './Autocomplete.css';

export interface AutocompleteItem {
  id: string;
  label: string;
  subtitle?: string;
  type?: 'note' | 'create' | 'create-and-move' | 'tag';
}

interface AutocompleteProps {
  items: AutocompleteItem[];
  position: { x: number; y: number };
  selectedIndex: number;
  onSelect: (item: AutocompleteItem) => void;
  onClose: () => void;
}

const Autocomplete: React.FC<AutocompleteProps> = ({ 
  items, 
  position, 
  selectedIndex, 
  onSelect, 
  onClose 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Adjust position if menu goes off screen
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${position.y - rect.height - 5}px`;
      }
      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${position.x - rect.width}px`;
      }
    }
  }, [position]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div 
      ref={menuRef}
      className="autocomplete-menu" 
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => {
        const isCreateOption = item.type === 'create' || item.type === 'create-and-move';
        const isTagOption = item.type === 'tag';
        const className = `autocomplete-item ${index === selectedIndex ? 'selected' : ''} ${isCreateOption ? 'create-option' : ''} ${isTagOption ? 'tag-option' : ''}`;
        
        return (
          <div
            key={item.id}
            className={className}
            onClick={() => onSelect(item)}
            onMouseEnter={() => {}}
          >
            <div className="autocomplete-label">{item.label}</div>
            {item.subtitle && (
              <div className="autocomplete-subtitle">{item.subtitle}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Autocomplete;
