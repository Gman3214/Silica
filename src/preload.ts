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
  renameNote: (oldPath: string, newTitle: string) => ipcRenderer.invoke('rename-note', oldPath, newTitle),
  listNotes: (folderPath: string) => ipcRenderer.invoke('list-notes', folderPath),
  createNote: (folderPath: string, title: string) => ipcRenderer.invoke('create-note', folderPath, title),
  
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
  renameNote: (oldPath: string, newTitle: string) => Promise<string>;
  listNotes: (folderPath: string) => Promise<Array<{ name: string; path: string; modified: number }>>;
  createNote: (folderPath: string, title: string) => Promise<string>;
  getSetting: (key: string) => Promise<any>;
  setSetting: (key: string, value: any) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
