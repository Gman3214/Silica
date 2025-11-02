import React, { useState, useEffect } from 'react';
import MarkdownEditor from '../components/MarkdownEditor';
import NoteNav from '../components/NoteNav';
import './MainPage.css';

interface Note {
  name: string;
  path: string;
  modified: number;
}

const MainPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; note: Note } | null>(null);

  // Load project path and notes on component mount
  useEffect(() => {
    const init = async () => {
      try {
        const path = await window.electronAPI.getSetting('lastProjectPath');
        setProjectPath(path);
        if (path) {
          await loadNotes(path);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };
    init();
  }, []);

  // Close context menu when clicking anywhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Save note content when it changes (with debounce)
  useEffect(() => {
    if (!selectedNote) return;

    const timeoutId = setTimeout(() => {
      saveCurrentNote();
    }, 500); // Auto-save after 500ms of no typing

    return () => clearTimeout(timeoutId);
  }, [noteContent]); // Only watch noteContent, not noteTitle

  const loadNotes = async (folderPath: string) => {
    try {
      setIsLoading(true);
      const notesList = await window.electronAPI.listNotes(folderPath);
      setNotes(notesList);
      
      // If there are notes, select the first one
      if (notesList.length > 0) {
        loadNote(notesList[0].path);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadNote = async (filePath: string) => {
    try {
      const content = await window.electronAPI.readNote(filePath);
      
      // Extract title from filename (not from content)
      const fileName = filePath.split(/[/\\]/).pop()?.replace('.md', '') || 'Untitled';
      // Convert filename back to readable format (replace underscores with spaces, no capitalization)
      const readableTitle = fileName.split('_').join(' ');
      
      console.log('Loading note:', { filePath, fileName, readableTitle });
      
      setSelectedNote(filePath);
      setNoteTitle(readableTitle);
      setNoteContent(content);
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  };

  const saveCurrentNote = async () => {
    if (!selectedNote) return;

    try {
      await window.electronAPI.saveNote(selectedNote, noteContent);
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const createNewNote = async () => {
    if (!projectPath) return;

    try {
      const title = 'Untitled Note';
      const filePath = await window.electronAPI.createNote(projectPath, title);
      
      await loadNotes(projectPath);
      loadNote(filePath);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const renameNote = async (newTitle: string) => {
    if (!selectedNote || !projectPath) return;
    
    // Don't rename if title hasn't changed
    const currentFileName = selectedNote.split(/[/\\]/).pop()?.replace('.md', '') || '';
    const currentReadableTitle = currentFileName.split('_').join(' ');
    
    if (newTitle === currentReadableTitle) {
      console.log('Title unchanged, skipping rename');
      return;
    }

    console.log('Renaming note from:', currentReadableTitle, 'to:', newTitle);

    try {
      const newPath = await window.electronAPI.renameNote(selectedNote, newTitle);
      console.log('Rename successful, new path:', newPath);
      setSelectedNote(newPath);
      await loadNotes(projectPath);
    } catch (error) {
      console.error('Failed to rename note:', error);
      // Revert title on error
      const fileName = selectedNote.split(/[/\\]/).pop()?.replace('.md', '') || 'Untitled';
      const readableTitle = fileName.split('_').join(' ');
      setNoteTitle(readableTitle);
    }
  };

  const deleteNote = async (filePath: string, noteName: string) => {
    if (!confirm(`Delete "${noteName}"?`)) return;

    try {
      await window.electronAPI.deleteNote(filePath);
      
      // If we're deleting the selected note, clear selection
      if (filePath === selectedNote) {
        setSelectedNote(null);
        setNoteTitle('');
        setNoteContent('');
      }
      
      if (projectPath) {
        await loadNotes(projectPath);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, note });
  };

  const handleRenameFromContext = () => {
    if (!contextMenu) return;
    const note = contextMenu.note;
    setContextMenu(null);
    
    // Select the note first
    if (selectedNote !== note.path) {
      loadNote(note.path);
    }
    
    // Focus the title input
    setTimeout(() => {
      const titleInput = document.querySelector('.note-title-input') as HTMLInputElement;
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 100);
  };

  const handleDeleteFromContext = () => {
    if (!contextMenu) return;
    const note = contextMenu.note;
    setContextMenu(null);
    deleteNote(note.path, note.name);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const filteredNotes = notes.filter(note =>
    note.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="main-page">
      <div className="page-header">
        <h1>Notes</h1>
        <button className="new-note-btn" onClick={createNewNote}>+ New Note</button>
      </div>
      <div className="notes-container">
        <div className="notes-sidebar">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search notes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="notes-list">
            {isLoading ? (
              <div className="loading">Loading notes...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="empty-state">
                {searchQuery ? 'No notes found' : 'No notes yet. Create one!'}
              </div>
            ) : (
              filteredNotes.map((note) => (
                <div 
                  key={note.path}
                  className={`note-item ${selectedNote === note.path ? 'active' : ''}`}
                  onClick={() => loadNote(note.path)}
                  onContextMenu={(e) => handleContextMenu(e, note)}
                >
                  <h3>{note.name}</h3>
                  <span className="note-date">{formatDate(note.modified)}</span>
                </div>
              ))
            )}
          </div>
        </div>
        {contextMenu && (
          <NoteNav
            x={contextMenu.x}
            y={contextMenu.y}
            onRename={handleRenameFromContext}
            onDelete={handleDeleteFromContext}
            onClose={() => setContextMenu(null)}
          />
        )}
        <div className="editor-container">
          {selectedNote ? (
            <>
              <div className="editor-header">
                <input 
                  type="text" 
                  className="note-title-input" 
                  placeholder="Untitled Note" 
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  onBlur={() => renameNote(noteTitle)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="editor">
                <MarkdownEditor
                  value={noteContent}
                  onChange={setNoteContent}
                  placeholder="Start writing..."
                  notes={notes}
                  onNoteLink={(notePath: string) => loadNote(notePath)}
                  currentNotePath={selectedNote || undefined}
                />
              </div>
            </>
          ) : (
            <div className="no-note-selected">
              <p>Select a note or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainPage;
