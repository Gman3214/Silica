// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readNote: (filePath: string) => ipcRenderer.invoke('read-note', filePath),
  saveNote: (filePath: string, content: string) => ipcRenderer.invoke('save-note', filePath, content),
  deleteNote: (filePath: string) => ipcRenderer.invoke('delete-note', filePath),
  deleteFolder: (folderPath: string) => ipcRenderer.invoke('delete-folder', folderPath),
  renameNote: (oldPath: string, newTitle: string) => ipcRenderer.invoke('rename-note', oldPath, newTitle),
  listNotes: (folderPath: string) => ipcRenderer.invoke('list-notes', folderPath),
  createNote: (folderPath: string, title: string) => ipcRenderer.invoke('create-note', folderPath, title),
  createFolder: (parentPath: string, folderName: string) => ipcRenderer.invoke('create-folder', parentPath, folderName),
  createWorkspace: (parentPath: string, workspaceName: string, color: string) => ipcRenderer.invoke('create-workspace', parentPath, workspaceName, color),
  getWorkspaceConfig: (workspacePath: string) => ipcRenderer.invoke('get-workspace-config', workspacePath),
  updateWorkspaceConfig: (workspacePath: string, name: string, color: string) => ipcRenderer.invoke('update-workspace-config', workspacePath, name, color),
  moveNote: (notePath: string, targetFolderPath: string) => ipcRenderer.invoke('move-note', notePath, targetFolderPath),
  getAllTags: (folderPath: string) => ipcRenderer.invoke('get-all-tags', folderPath),
  searchNotes: (folderPath: string, query: string) => ipcRenderer.invoke('search-notes', folderPath, query),
  
  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('set-setting', key, value),
});

// Type definitions for TypeScript
export interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  readNote: (filePath: string) => Promise<string>;
  saveNote: (filePath: string, content: string) => Promise<void>;
  deleteNote: (filePath: string) => Promise<void>;
  deleteFolder: (folderPath: string) => Promise<void>;
  renameNote: (oldPath: string, newTitle: string) => Promise<string>;
  listNotes: (folderPath: string) => Promise<Array<{ name: string; path: string; modified: number; isFolder: boolean; isWorkspace?: boolean; workspaceColor?: string }>>;
  createNote: (folderPath: string, title: string) => Promise<string>;
  createFolder: (parentPath: string, folderName: string) => Promise<string>;
  createWorkspace: (parentPath: string, workspaceName: string, color: string) => Promise<string>;
  getWorkspaceConfig: (workspacePath: string) => Promise<{ name: string; color: string; createdAt: number } | null>;
  updateWorkspaceConfig: (workspacePath: string, name: string, color: string) => Promise<{ name: string; color: string; createdAt: number; updatedAt: number }>;
  moveNote: (notePath: string, targetFolderPath: string) => Promise<string>;
  getAllTags: (folderPath: string) => Promise<{ [tag: string]: Array<{ name: string; path: string }> }>;
  searchNotes: (folderPath: string, query: string) => Promise<Array<{
    name: string;
    path: string;
    isFolder: boolean;
    matchType: 'title' | 'content';
    snippet?: string;
  }>>;
  getSetting: (key: string) => Promise<any>;
  setSetting: (key: string, value: any) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
