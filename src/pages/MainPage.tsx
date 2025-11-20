import React, { useState, useEffect } from 'react';
import NoteNav from '../components/NoteNav';
import NotesSidebar from '../components/NotesSidebar';
import EditorArea from '../components/EditorArea';
import SearchBar from '../components/SearchBar';
import RightSidebar from '../components/RightSidebar';
import './MainPage.css';

interface Note {
  name: string;
  path: string;
  modified: number;
  isFolder?: boolean;
  isWorkspace?: boolean;
  workspaceColor?: string;
  workspaceIcon?: string;
  content?: string;
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
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Array<{ name: string; path: string; color: string; icon?: string }>>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('New Folder');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('New Workspace');
  const [newWorkspaceColor, setNewWorkspaceColor] = useState('#3b82f6');
  const [newWorkspaceIcon, setNewWorkspaceIcon] = useState('folder');
  const [draggedNote, setDraggedNote] = useState<Note | null>(null);
  const [folderContents, setFolderContents] = useState<Map<string, Note[]>>(new Map());
  const [tags, setTags] = useState<{ [tag: string]: Array<{ name: string; path: string }> }>({});
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(300);
  const [isResizingRight, setIsResizingRight] = useState(false);

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
      
      // Extract workspaces
      const workspaceItems = notesList.filter(note => note.isWorkspace).map(note => ({
        name: note.name,
        path: note.path,
        color: note.workspaceColor || '#3b82f6',
        icon: note.workspaceIcon || 'folder',
      }));
      setWorkspaces(workspaceItems);
      
      // If there are notes and autoSelectFirst is true, select the first one
      // But only select actual notes, not folders or workspaces
      if (autoSelectFirst) {
        const actualNotes = notesList.filter(note => !note.isFolder && !note.isWorkspace);
        if (actualNotes.length > 0) {
          loadNote(actualNotes[0].path);
        }
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

  // Filter tags based on active workspace
  const getFilteredTags = () => {
    const taggedNotes = Object.entries(tags);
    const filteredTags: { [tag: string]: Array<{ name: string; path: string }> } = {};

    for (const [tag, tagNotes] of taggedNotes) {
      const workspaceFilteredNotes = tagNotes.filter(note => {
        if (activeWorkspace === null) {
          // In Shared workspace: only show notes from root directory
          const noteDir = note.path.substring(0, note.path.lastIndexOf('/'));
          return noteDir === projectPath;
        } else {
          // In a specific workspace: only show notes from that workspace
          return note.path.startsWith(activeWorkspace + '/');
        }
      });

      // Only include tags that have notes in the current workspace
      if (workspaceFilteredNotes.length > 0) {
        filteredTags[tag] = workspaceFilteredNotes;
      }
    }

    return filteredTags;
  };

  // Get list of tag names for autocomplete
  const getWorkspaceTagNames = (): string[] => {
    const filteredTags = getFilteredTags();
    return Object.keys(filteredTags);
  };

  // Filter notes based on active workspace
  const getFilteredNotes = () => {
    if (activeWorkspace === null) {
      // Show only root-level notes (shared)
      return notes.filter(note => !note.isFolder && !note.isWorkspace);
    } else {
      // Show notes from the selected workspace
      return folderContents.get(activeWorkspace) || [];
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

  const handleWorkspaceSelect = async (workspacePath: string | null) => {
    setActiveWorkspace(workspacePath);
    
    // If selecting a workspace (not shared), load its contents
    if (workspacePath && !folderContents.has(workspacePath)) {
      try {
        const contents = await window.electronAPI.listNotes(workspacePath);
        setFolderContents(prev => {
          const newMap = new Map(prev);
          newMap.set(workspacePath, contents);
          return newMap;
        });
      } catch (error) {
        console.error('Failed to load workspace contents:', error);
      }
    }
  };

  const handleWorkspaceNameChange = async (workspacePath: string | null, newName: string) => {
    if (!workspacePath || !newName.trim()) return;

    try {
      const config = await window.electronAPI.getWorkspaceConfig(workspacePath);
      await window.electronAPI.updateWorkspaceConfig(workspacePath, newName, config.color, config.icon || 'folder');
      
      // Refresh the notes list to update workspace names
      if (projectPath) {
        await loadNotes(projectPath);
      }
    } catch (error) {
      console.error('Failed to update workspace name:', error);
    }
  };

  const handleWorkspaceColorChange = async (workspacePath: string | null, newColor: string) => {
    if (!workspacePath) return;

    try {
      const config = await window.electronAPI.getWorkspaceConfig(workspacePath);
      await window.electronAPI.updateWorkspaceConfig(workspacePath, config.name, newColor, config.icon || 'folder');
      
      // Refresh the notes list to update workspace colors
      if (projectPath) {
        await loadNotes(projectPath, false);
      }
    } catch (error) {
      console.error('Failed to update workspace color:', error);
    }
  };

  const handleWorkspaceIconChange = async (workspacePath: string | null, newIcon: string) => {
    if (!workspacePath) return;

    try {
      const config = await window.electronAPI.getWorkspaceConfig(workspacePath);
      await window.electronAPI.updateWorkspaceConfig(workspacePath, config.name, config.color, newIcon);
      
      // Refresh the notes list to update workspace icons
      if (projectPath) {
        await loadNotes(projectPath, false);
      }
    } catch (error) {
      console.error('Failed to update workspace icon:', error);
    }
  };

  const handleWorkspaceDelete = async (workspacePath: string | null) => {
    if (!workspacePath || !projectPath) return;

    try {
      await window.electronAPI.deleteFolder(workspacePath);
      
      // Switch to Shared workspace after deletion
      setActiveWorkspace(null);
      
      // Refresh the notes list
      await loadNotes(projectPath, false);
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      alert('Failed to delete workspace: ' + error);
    }
  };

  const handleWorkspaceSettings = (workspacePath: string | null) => {
    // TODO: Implement workspace settings dialog
    console.log('Open settings for workspace:', workspacePath);
  };

  const handleWorkspaceDrop = async (workspacePath: string | null, e: React.DragEvent) => {
    if (!draggedNote || !projectPath) return;

    const targetPath = workspacePath || projectPath;
    
    // Don't do anything if dropping in the same workspace
    const currentWorkspacePath = draggedNote.path.substring(0, draggedNote.path.lastIndexOf('/'));
    if (currentWorkspacePath === targetPath) return;

    try {
      await window.electronAPI.moveNote(draggedNote.path, targetPath);
      
      // Refresh the notes list
      await loadNotes(projectPath);
      
      // Reload tags to reflect the workspace change
      await loadTags(projectPath);
      
      // Refresh the target workspace contents if it's not the root
      if (workspacePath && folderContents.has(workspacePath)) {
        const contents = await window.electronAPI.listNotes(workspacePath);
        setFolderContents(prev => {
          const newMap = new Map(prev);
          newMap.set(workspacePath, contents);
          return newMap;
        });
      }
      
      // Refresh the source workspace contents if it was in a workspace
      if (currentWorkspacePath !== projectPath && folderContents.has(currentWorkspacePath)) {
        const sourceContents = await window.electronAPI.listNotes(currentWorkspacePath);
        setFolderContents(prev => {
          const newMap = new Map(prev);
          newMap.set(currentWorkspacePath, sourceContents);
          return newMap;
        });
      }
      
      setDraggedNote(null);
    } catch (error) {
      console.error('Failed to move note to workspace:', error);
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
    if (!selectedNote || !projectPath) return;

    try {
      await window.electronAPI.saveNote(selectedNote, noteContent);
      // Reload tags after saving to capture any new or changed tags
      await loadTags(projectPath);
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const createNewNote = async () => {
    if (!projectPath) return;

    try {
      const title = 'Untitled Note';
      // Create note in active workspace or root
      const targetPath = activeWorkspace || projectPath;
      const filePath = await window.electronAPI.createNote(targetPath, title);
      
      await loadNotes(projectPath);
      await loadTags(projectPath);
      
      // Refresh workspace contents if in a workspace
      if (activeWorkspace) {
        const contents = await window.electronAPI.listNotes(activeWorkspace);
        setFolderContents(prev => {
          const newMap = new Map(prev);
          newMap.set(activeWorkspace, contents);
          return newMap;
        });
      }
      
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

  // Generate a random color for workspace
  const generateWorkspaceColor = () => {
    const colors = [
      '#3b82f6', // blue
      '#ef4444', // red
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
      '#6366f1', // indigo
      '#06b6d4', // cyan
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const createNewWorkspace = async () => {
    if (!projectPath) {
      console.error('No project path set');
      return;
    }
    
    setCreatingWorkspace(true);
    setNewWorkspaceName('New Workspace');
    setNewWorkspaceColor(generateWorkspaceColor());
    setNewWorkspaceIcon('folder');
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

  const confirmCreateWorkspace = async (finalName?: string) => {
    if (!projectPath) {
      setCreatingWorkspace(false);
      return;
    }

    // Use provided name or fall back to state
    const workspaceName = finalName !== undefined ? finalName : newWorkspaceName.trim();
    
    if (!workspaceName) {
      setCreatingWorkspace(false);
      return;
    }

    try {
      console.log('Creating workspace:', workspaceName, 'with color:', newWorkspaceColor, 'and icon:', newWorkspaceIcon);
      await window.electronAPI.createWorkspace(projectPath, workspaceName, newWorkspaceColor, newWorkspaceIcon);
      console.log('Workspace created, reloading notes...');
      await loadNotes(projectPath);
      setCreatingWorkspace(false);
      setNewWorkspaceName('New Workspace');
      setNewWorkspaceColor('#3b82f6');
      setNewWorkspaceIcon('folder');
    } catch (error) {
      console.error('Failed to create workspace:', error);
      alert('Failed to create workspace: ' + error);
      setCreatingWorkspace(false);
    }
  };

  const cancelCreateWorkspace = () => {
    setCreatingWorkspace(false);
    setNewWorkspaceName('New Workspace');
    setNewWorkspaceColor('#3b82f6');
    setNewWorkspaceIcon('folder');
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
      
      // Reload tags to reflect any workspace changes
      await loadTags(projectPath);
      
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
      
      // Reload tags to reflect any workspace changes
      await loadTags(projectPath);
      
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
        // Reload tags after saving to capture any new or changed tags
        await loadTags(projectPath);
      }
      
      // Create the new note
      const filePath = await window.electronAPI.createNote(projectPath, title);
      
      // Reload the notes list to include the new note, but don't auto-select
      await loadNotes(projectPath, false);
      await loadTags(projectPath);
      
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

  const saveChatAsNote = async (title: string, content: string): Promise<void> => {
    if (!projectPath) return;

    try {
      // Create the new note in active workspace or root
      const targetPath = activeWorkspace || projectPath;
      const filePath = await window.electronAPI.createNote(targetPath, title);
      
      // Save the content to the new note
      await window.electronAPI.saveNote(filePath, content);
      
      // Reload notes and tags
      await loadNotes(projectPath, false);
      await loadTags(projectPath);
      
      // Refresh workspace contents if in a workspace
      if (activeWorkspace) {
        const contents = await window.electronAPI.listNotes(activeWorkspace);
        setFolderContents(prev => {
          const newMap = new Map(prev);
          newMap.set(activeWorkspace, contents);
          return newMap;
        });
      }
      
      // Open the new note
      loadNote(filePath);
    } catch (error) {
      console.error('Failed to save chat as note:', error);
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
      
      // Close the tab if it's open
      const tabIndex = openTabs.findIndex(tab => tab.path === filePath);
      if (tabIndex !== -1) {
        setOpenTabs(prev => prev.filter(tab => tab.path !== filePath));
        
        // If the deleted note was the selected one, switch to another tab or clear
        if (filePath === selectedNote) {
          if (openTabs.length > 1) {
            // Switch to the previous tab or the next one
            const newIndex = tabIndex > 0 ? tabIndex - 1 : 0;
            const remainingTabs = openTabs.filter(tab => tab.path !== filePath);
            if (remainingTabs[newIndex]) {
              loadNote(remainingTabs[newIndex].path);
            }
          } else {
            // No other tabs, clear selection
            setSelectedNote(null);
            setNoteTitle('');
            setNoteContent('');
          }
        }
      } else if (filePath === selectedNote) {
        // If not in tabs but is selected, clear selection
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
      
      // Close any tabs that were inside this folder
      const tabsToClose = openTabs.filter(tab => tab.path.startsWith(folderPath + '/'));
      if (tabsToClose.length > 0) {
        setOpenTabs(prev => prev.filter(tab => !tab.path.startsWith(folderPath + '/')));
        
        // If the selected note was in this folder, clear or switch
        if (selectedNote && selectedNote.startsWith(folderPath + '/')) {
          const remainingTabs = openTabs.filter(tab => !tab.path.startsWith(folderPath + '/'));
          if (remainingTabs.length > 0) {
            loadNote(remainingTabs[0].path);
          } else {
            setSelectedNote(null);
            setNoteTitle('');
            setNoteContent('');
          }
        }
      }
      
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

  // Get all notes with their content for the right sidebar
  const getAllNotesWithContent = async (): Promise<Note[]> => {
    const allNotes: Note[] = [];
    
    const collectNotes = (notesList: Note[]) => {
      for (const note of notesList) {
        if (!note.isFolder && !note.isWorkspace) {
          allNotes.push(note);
        }
      }
    };

    // Collect notes from main list
    collectNotes(notes);

    // Collect notes from folder contents
    folderContents.forEach((contents) => {
      collectNotes(contents);
    });

    // Load content for each note
    const notesWithContent = await Promise.all(
      allNotes.map(async (note) => {
        try {
          const content = await window.electronAPI.readNote(note.path);
          return { ...note, content };
        } catch (error) {
          return note;
        }
      })
    );

    return notesWithContent;
  };

  const [notesWithContent, setNotesWithContent] = useState<Note[]>([]);

  // Update notes with content when notes change
  useEffect(() => {
    const updateNotesWithContent = async () => {
      const allNotes = await getAllNotesWithContent();
      setNotesWithContent(allNotes);
    };
    
    if (projectPath) {
      updateNotesWithContent();
    }
  }, [notes, folderContents, noteContent]); // Re-run when notes or content changes

  // Handle sidebar resize
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseDownRight = (e: React.MouseEvent) => {
    setIsResizingRight(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRight) return;
      
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 250 && newWidth <= 600) {
        setRightSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
    };

    if (isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingRight]);

  return (
    <div className="main-page">
      <SearchBar
        searchQuery={searchQuery}
        searchResults={searchResults}
        selectedNote={selectedNote}
        onSearchChange={setSearchQuery}
        onResultClick={(result) => {
          if (!result.isFolder) {
            loadNote(result.path);
            setSearchQuery('');
          }
        }}
      />
      <div className="notes-container">
        <div className="notes-sidebar-wrapper" style={{ width: `${sidebarWidth}px` }}>
          <NotesSidebar
            notes={getFilteredNotes()}
            allNotes={notes}
            workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          tags={getFilteredTags()}
          selectedNote={selectedNote}
          expandedFolders={expandedFolders}
          expandedTags={expandedTags}
          folderContents={folderContents}
          draggedNote={draggedNote}
          creatingFolder={creatingFolder}
          newFolderName={newFolderName}
          creatingWorkspace={creatingWorkspace}
          newWorkspaceName={newWorkspaceName}
          newWorkspaceColor={newWorkspaceColor}
          newWorkspaceIcon={newWorkspaceIcon}
          isLoading={isLoading}
          onNoteClick={loadNote}
          onContextMenu={handleContextMenu}
          onToggleFolder={toggleFolder}
          onToggleTag={toggleTag}
          onWorkspaceSelect={handleWorkspaceSelect}
          onWorkspaceNameChange={handleWorkspaceNameChange}
          onWorkspaceColorChange={handleWorkspaceColorChange}
          onWorkspaceIconChange={handleWorkspaceIconChange}
          onWorkspaceDelete={handleWorkspaceDelete}
          onWorkspaceSettings={handleWorkspaceSettings}
          onWorkspaceDrop={handleWorkspaceDrop}
          onNoteDragStart={handleNoteDragStart}
          onNoteDragEnd={handleNoteDragEnd}
          onFolderDragOver={handleFolderDragOver}
          onFolderDrop={handleFolderDrop}
          onRootDragOver={handleRootDragOver}
          onRootDrop={handleRootDrop}
          onNewFolderNameChange={setNewFolderName}
          onConfirmCreateFolder={confirmCreateFolder}
          onCancelCreateFolder={cancelCreateFolder}
          onConfirmCreateWorkspace={confirmCreateWorkspace}
          onCancelCreateWorkspace={cancelCreateWorkspace}
          onNewNote={createNewNote}
          onNewFolder={createNewFolder}
          onNewWorkspace={createNewWorkspace}
          formatDate={formatDate}
        />
          <div 
            className="sidebar-resize-handle"
            onMouseDown={handleMouseDown}
          />
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
        <div className="editor-area-wrapper">
          <EditorArea
            selectedNote={selectedNote}
            noteTitle={noteTitle}
            noteContent={noteContent}
            openTabs={openTabs}
            notes={notes}
            workspaceTags={getWorkspaceTagNames()}
            projectPath={projectPath || undefined}
            onTitleChange={setNoteTitle}
            onTitleBlur={() => renameNote(noteTitle)}
            onContentChange={setNoteContent}
            onNoteLink={loadNote}
            onCreateNote={createNoteFromEditor}
            onTabSelect={loadNote}
            onTabClose={handleTabClose}
            onTabsReorder={handleTabsReorder}
          />
        </div>
        <div className="right-sidebar-wrapper" style={{ width: `${rightSidebarWidth}px` }}>
          <div 
            className="right-sidebar-resize-handle"
            onMouseDown={handleMouseDownRight}
          />
          <RightSidebar
            currentNote={selectedNote ? {
              path: selectedNote,
              name: noteTitle,
              content: noteContent
            } : null}
            allNotes={notesWithContent}
            onNoteClick={loadNote}
            onSaveChat={saveChatAsNote}
          />
        </div>
      </div>
    </div>
  );
};

export default MainPage;
