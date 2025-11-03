import React, { useState, useEffect } from 'react';
import MarkdownEditor from '../components/MarkdownEditor';
import NoteNav from '../components/NoteNav';
import NoteTabs from '../components/NoteTabs';
import './MainPage.css';

interface Note {
  name: string;
  path: string;
  modified: number;
  isFolder?: boolean;
}

interface Tab {
  path: string;
  name: string;
}

interface SearchResult {
  name: string;
  path: string;
  isFolder: boolean;
  matchType: 'title' | 'content';
  snippet?: string;
}

const MainPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; note: Note } | null>(null);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('New Folder');
  const [draggedNote, setDraggedNote] = useState<Note | null>(null);
  const [folderContents, setFolderContents] = useState<Map<string, Note[]>>(new Map());
  const [tags, setTags] = useState<{ [tag: string]: Array<{ name: string; path: string }> }>({});
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  // Load project path and notes on component mount
  useEffect(() => {
    const init = async () => {
      try {
        const path = await window.electronAPI.getSetting('lastProjectPath');
        setProjectPath(path);
        if (path) {
          await loadNotes(path);
          await loadTags(path);
          // Load saved tabs from localStorage
          const savedTabs = localStorage.getItem(`tabs_${path}`);
          if (savedTabs) {
            const parsedTabs = JSON.parse(savedTabs);
            // Remove duplicates based on path
            const uniqueTabs = parsedTabs.filter((tab: Tab, index: number, self: Tab[]) => 
              index === self.findIndex((t) => t.path === tab.path)
            );
            setOpenTabs(uniqueTabs);
          }
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };
    init();
  }, []);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    if (projectPath && openTabs.length > 0) {
      localStorage.setItem(`tabs_${projectPath}`, JSON.stringify(openTabs));
    }
  }, [openTabs, projectPath]);

  // Close context menu when clicking anywhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Save note content when it changes (with debounce)
  useEffect(() => {
    if (!selectedNote) return;

    const timeoutId = setTimeout(async () => {
      await saveCurrentNote();
      // Reload tags after saving to detect changes
      if (projectPath) {
        await loadTags(projectPath);
      }
    }, 500); // Auto-save after 500ms of no typing

    return () => clearTimeout(timeoutId);
  }, [noteContent]); // Only watch noteContent, not noteTitle

  const loadNotes = async (folderPath: string, autoSelectFirst: boolean = true) => {
    try {
      setIsLoading(true);
      const notesList = await window.electronAPI.listNotes(folderPath);
      setNotes(notesList);
      
      // If there are notes and autoSelectFirst is true, select the first one
      if (notesList.length > 0 && autoSelectFirst) {
        loadNote(notesList[0].path);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTags = async (folderPath: string) => {
    try {
      const allTags = await window.electronAPI.getAllTags(folderPath);
      setTags(allTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const performSearch = async (query: string) => {
    if (!projectPath || !query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await window.electronAPI.searchNotes(projectPath, query);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search notes:', error);
      setSearchResults([]);
    }
  };

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); // Search after 300ms of no typing

    return () => clearTimeout(timeoutId);
  }, [searchQuery, projectPath]);

  const toggleTag = (tag: string) => {
    setExpandedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
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

      // Add to tabs if not already there
      setOpenTabs(prev => {
        // Check if tab already exists
        if (prev.find(tab => tab.path === filePath)) {
          return prev;
        }
        return [...prev, { path: filePath, name: readableTitle }];
      });
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
      await loadTags(projectPath);
      loadNote(filePath);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const createNewFolder = async () => {
    if (!projectPath) {
      console.error('No project path set');
      return;
    }
    
    setCreatingFolder(true);
    setNewFolderName('New Folder');
  };

  const confirmCreateFolder = async () => {
    if (!projectPath || !newFolderName.trim()) {
      setCreatingFolder(false);
      return;
    }

    try {
      console.log('Creating folder:', newFolderName);
      await window.electronAPI.createFolder(projectPath, newFolderName);
      console.log('Folder created, reloading notes...');
      await loadNotes(projectPath);
      setCreatingFolder(false);
      setNewFolderName('New Folder');
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder: ' + error);
      setCreatingFolder(false);
    }
  };

  const cancelCreateFolder = () => {
    setCreatingFolder(false);
    setNewFolderName('New Folder');
  };

  const toggleFolder = async (folderPath: string) => {
    const isExpanding = !expandedFolders.has(folderPath);
    
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });

    // Load folder contents when expanding
    if (isExpanding) {
      try {
        const contents = await window.electronAPI.listNotes(folderPath);
        setFolderContents(prev => {
          const newMap = new Map(prev);
          newMap.set(folderPath, contents);
          return newMap;
        });
      } catch (error) {
        console.error('Failed to load folder contents:', error);
      }
    }
  };

  const handleNoteDragStart = (e: React.DragEvent, note: Note) => {
    if (note.isFolder) return; // Don't allow dragging folders
    setDraggedNote(note);
    e.dataTransfer.effectAllowed = 'move';
    // Store the source folder path in the dataTransfer
    const sourceFolderPath = note.path.substring(0, note.path.lastIndexOf('/'));
    e.dataTransfer.setData('sourceFolderPath', sourceFolderPath);
  };

  const handleNoteDragEnd = () => {
    setDraggedNote(null);
  };

  const handleFolderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolder: Note) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedNote || !targetFolder.isFolder || !projectPath) return;
    
    const sourceFolderPath = e.dataTransfer.getData('sourceFolderPath');
    
    try {
      await window.electronAPI.moveNote(draggedNote.path, targetFolder.path);
      await loadNotes(projectPath);
      
      // Refresh target folder contents if it's expanded
      if (expandedFolders.has(targetFolder.path)) {
        const contents = await window.electronAPI.listNotes(targetFolder.path);
        setFolderContents(prev => {
          const newMap = new Map(prev);
          newMap.set(targetFolder.path, contents);
          return newMap;
        });
      }
      
      // Refresh source folder contents if it's expanded
      if (sourceFolderPath && sourceFolderPath !== projectPath && expandedFolders.has(sourceFolderPath)) {
        const sourceContents = await window.electronAPI.listNotes(sourceFolderPath);
        setFolderContents(prev => {
          const newMap = new Map(prev);
          newMap.set(sourceFolderPath, sourceContents);
          return newMap;
        });
      }
      
      // If the moved note was selected, clear selection
      if (selectedNote === draggedNote.path) {
        setSelectedNote(null);
        setNoteTitle('');
        setNoteContent('');
      }
      
      // Remove from tabs if open
      setOpenTabs(prev => prev.filter(tab => tab.path !== draggedNote.path));
    } catch (error) {
      console.error('Failed to move note:', error);
      alert('Failed to move note: ' + error);
    } finally {
      setDraggedNote(null);
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    if (!draggedNote || !projectPath) return;
    
    const sourceFolderPath = e.dataTransfer.getData('sourceFolderPath');
    
    try {
      await window.electronAPI.moveNote(draggedNote.path, projectPath);
      await loadNotes(projectPath);
      
      // Refresh source folder contents if it's expanded
      if (sourceFolderPath && sourceFolderPath !== projectPath && expandedFolders.has(sourceFolderPath)) {
        const sourceContents = await window.electronAPI.listNotes(sourceFolderPath);
        setFolderContents(prev => {
          const newMap = new Map(prev);
          newMap.set(sourceFolderPath, sourceContents);
          return newMap;
        });
      }
      
      // If the moved note was selected, keep it selected but update the path
      if (selectedNote === draggedNote.path) {
        const fileName = draggedNote.path.split(/[/\\]/).pop();
        if (fileName) {
          const newPath = projectPath + '/' + fileName;
          loadNote(newPath);
        }
      }
    } catch (error) {
      console.error('Failed to move note to root:', error);
      alert('Failed to move note: ' + error);
    } finally {
      setDraggedNote(null);
    }
  };

  const createNoteFromEditor = async (title: string, openNote: boolean, updatedContent?: string): Promise<string | void> => {
    if (!projectPath) return;

    try {
      // Save the current note first (with the newly inserted link)
      if (selectedNote) {
        // If updatedContent is provided, use it; otherwise use current noteContent
        const contentToSave = updatedContent !== undefined ? updatedContent : noteContent;
        await window.electronAPI.saveNote(selectedNote, contentToSave);
      }
      
      // Create the new note
      const filePath = await window.electronAPI.createNote(projectPath, title);
      
      // Reload the notes list to include the new note, but don't auto-select
      await loadNotes(projectPath, false);
      
      // If openNote is true, navigate to the new note
      if (openNote) {
        loadNote(filePath);
      }
      
      return filePath;
    } catch (error) {
      console.error('Failed to create note:', error);
      throw error;
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
      
      // Update the tab with the new name and path
      setOpenTabs(prev => prev.map(tab => 
        tab.path === selectedNote 
          ? { path: newPath, name: newTitle }
          : tab
      ));
      
      setSelectedNote(newPath);
      await loadNotes(projectPath);
      await loadTags(projectPath);
    } catch (error) {
      console.error('Failed to rename note:', error);
      // Revert title on error
      const fileName = selectedNote.split(/[/\\]/).pop()?.replace('.md', '') || 'Untitled';
      const readableTitle = fileName.split('_').join(' ');
      setNoteTitle(readableTitle);
    }
  };

  const handleTabClose = (path: string) => {
    setOpenTabs(prev => prev.filter(tab => tab.path !== path));
    
    // If closing the active tab, switch to another tab or clear selection
    if (path === selectedNote) {
      const remainingTabs = openTabs.filter(tab => tab.path !== path);
      if (remainingTabs.length > 0) {
        // Switch to the previous tab or the first one
        const currentIndex = openTabs.findIndex(tab => tab.path === path);
        const newIndex = Math.max(0, currentIndex - 1);
        loadNote(remainingTabs[newIndex].path);
      } else {
        setSelectedNote(null);
        setNoteTitle('');
        setNoteContent('');
      }
    }
  };

  const handleTabsReorder = (newTabs: Tab[]) => {
    setOpenTabs(newTabs);
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
        await loadTags(projectPath);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const deleteFolder = async (folderPath: string, folderName: string) => {
    if (!confirm(`Delete folder "${folderName}" and all its contents? This cannot be undone.`)) return;

    try {
      await window.electronAPI.deleteFolder(folderPath);
      
      // Clear expanded state for this folder
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        return newSet;
      });
      
      // Remove from folder contents
      setFolderContents(prev => {
        const newMap = new Map(prev);
        newMap.delete(folderPath);
        return newMap;
      });
      
      if (projectPath) {
        await loadNotes(projectPath);
        await loadTags(projectPath);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
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
    
    if (note.isFolder) {
      deleteFolder(note.path, note.name);
    } else {
      deleteNote(note.path, note.name);
    }
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

  return (
    <div className="main-page">
      <div className="global-search-header">
        <div className="search-box-global">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="search-icon">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 12L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input 
            type="text" 
            placeholder="Search notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <div className="search-results-dropdown">
              {searchResults.length === 0 ? (
                <div className="search-result-item empty">
                  No notes found
                </div>
              ) : (
                searchResults.map((result) => (
                  <div 
                    key={result.path}
                    className={`search-result-item ${selectedNote === result.path ? 'active' : ''}`}
                    onClick={() => {
                      if (!result.isFolder) {
                        loadNote(result.path);
                        setSearchQuery('');
                      }
                    }}
                  >
                    <div className="result-main">
                      {result.isFolder ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="result-icon">
                          <path d="M2 4H7L8 5H14V13H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="result-icon">
                          <path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                          <path d="M10 2V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                      )}
                      <div className="result-text">
                        <span className="result-name">{result.name}</span>
                        {result.snippet && (
                          <span className="result-snippet">{result.snippet}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <div className="notes-container">
        <div className="notes-sidebar">
          <div className="action-buttons">
            <button className="add-note-btn" onClick={createNewNote} title="New Note">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M10 2V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 7V11M6 9H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="add-folder-btn" onClick={createNewFolder} title="New Folder">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4H7L8 5H14V13H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 8V11M6.5 9.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div 
            className="notes-list"
            onDragOver={handleRootDragOver}
            onDrop={handleRootDrop}
          >
            {isLoading ? (
              <div className="loading">Loading notes...</div>
            ) : (
              <>
                {creatingFolder && (
                  <div className="folder-item creating">
                    <div className="folder-header">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="folder-icon">
                        <path d="M2 4H7L8 5H14V13H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      </svg>
                      <input
                        type="text"
                        className="folder-name-input"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onBlur={confirmCreateFolder}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            confirmCreateFolder();
                          } else if (e.key === 'Escape') {
                            cancelCreateFolder();
                          }
                        }}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  </div>
                )}
                {notes.length === 0 && Object.keys(tags).length === 0 && !creatingFolder ? (
                  <div className="empty-state">
                    No notes yet. Create one!
                  </div>
                ) : (
                  <>
                    {/* Render tags */}
                    {Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)).map(([tag, tagNotes]) => (
                      <div key={`tag-${tag}`} className="folder-item tag-item">
                        <div 
                          className="folder-header"
                          onClick={() => toggleTag(tag)}
                        >
                          <svg 
                            width="12" 
                            height="12" 
                            viewBox="0 0 12 12" 
                            fill="none"
                            className={`folder-chevron ${expandedTags.has(tag) ? 'expanded' : ''}`}
                          >
                            <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="tag-icon">
                            <path d="M3 3L9 3L13 7L8 12L4 8L3 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                            <circle cx="7.5" cy="6.5" r="1" fill="currentColor"/>
                          </svg>
                          <h3>{tag}</h3>
                          <span className="tag-count">{tagNotes.length}</span>
                        </div>
                        {expandedTags.has(tag) && (
                          <div className="folder-contents">
                            {tagNotes.map((note) => (
                              <div 
                                key={note.path}
                                className={`note-item ${selectedNote === note.path ? 'active' : ''}`}
                                onClick={() => loadNote(note.path)}
                                onContextMenu={(e) => handleContextMenu(e, note as Note)}
                              >
                                <h3>{note.name}</h3>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Render folders and notes */}
                    {notes.map((note) => (
                      <div key={note.path}>
                        {note.isFolder ? (
                          <div 
                            className={`folder-item ${draggedNote && !draggedNote.isFolder ? 'drop-target' : ''}`}
                            onDragOver={handleFolderDragOver}
                            onDrop={(e) => handleFolderDrop(e, note)}
                          >
                            <div 
                              className="folder-header"
                              onClick={() => toggleFolder(note.path)}
                              onContextMenu={(e) => handleContextMenu(e, note)}
                            >
                              <svg 
                                width="12" 
                                height="12" 
                                viewBox="0 0 12 12" 
                                fill="none"
                                className={`folder-chevron ${expandedFolders.has(note.path) ? 'expanded' : ''}`}
                              >
                                <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="folder-icon">
                                <path d="M2 4H7L8 5H14V13H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                              </svg>
                              <h3>{note.name}</h3>
                            </div>
                            {expandedFolders.has(note.path) && (
                              <div className="folder-contents">
                                {folderContents.get(note.path)?.length === 0 ? (
                                  <div className="empty-folder">Empty folder</div>
                                ) : (
                                  folderContents.get(note.path)?.map((subNote) => (
                                    <div 
                                      key={subNote.path}
                                      className={`note-item ${selectedNote === subNote.path ? 'active' : ''} ${draggedNote?.path === subNote.path ? 'dragging' : ''}`}
                                      onClick={() => loadNote(subNote.path)}
                                      onContextMenu={(e) => handleContextMenu(e, subNote)}
                                      draggable={!subNote.isFolder}
                                      onDragStart={(e) => handleNoteDragStart(e, subNote)}
                                      onDragEnd={handleNoteDragEnd}
                                    >
                                      <h3>{subNote.name}</h3>
                                      <span className="note-date">{formatDate(subNote.modified)}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div 
                            className={`note-item ${selectedNote === note.path ? 'active' : ''} ${draggedNote?.path === note.path ? 'dragging' : ''}`}
                            onClick={() => loadNote(note.path)}
                            onContextMenu={(e) => handleContextMenu(e, note)}
                            draggable
                            onDragStart={(e) => handleNoteDragStart(e, note)}
                            onDragEnd={handleNoteDragEnd}
                          >
                            <h3>{note.name}</h3>
                            <span className="note-date">{formatDate(note.modified)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </>
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
              {openTabs.length > 0 && (
                <NoteTabs
                  tabs={openTabs}
                  activeTab={selectedNote}
                  onTabSelect={loadNote}
                  onTabClose={handleTabClose}
                  onTabsReorder={handleTabsReorder}
                />
              )}
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
                  onCreateNote={createNoteFromEditor}
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
