import React from 'react';
import './NoteNav.css';

interface NoteNavProps {
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const NoteNav: React.FC<NoteNavProps> = ({ x, y, onRename, onDelete, onClose }) => {
  return (
    <div 
      className="note-nav" 
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="note-nav-item" onClick={onRename}>
        Rename
      </div>
      <div className="note-nav-item danger" onClick={onDelete}>
        Delete
      </div>
    </div>
  );
};

export default NoteNav;
