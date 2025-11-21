# Workspace Notes Not Updating After Rename/Delete

## Problem Description

When editing a note's title or deleting a note inside a workspace (not the default/root workspace), the changes were not reflected in the notes list. Users had to close and reopen the application to see the updated notes list.

This issue occurred specifically when:
- Renaming a note inside a workspace
- Deleting a note inside a workspace
- Deleting a folder inside a workspace
- Creating a note inside a workspace

The default workspace (root folder) did not have this issue.

## Root Cause

The application uses two separate data structures to manage notes:

1. **`notes` state** - Contains all notes from the project root directory
2. **`folderContents` Map** - Contains notes for each workspace, keyed by workspace path

When a user is viewing a workspace, the UI displays notes from `folderContents.get(activeWorkspace)` rather than the `notes` state.

The problem was that after renaming, deleting, or creating notes, the code only called:
```typescript
await loadNotes(projectPath);
await loadTags(projectPath);
```

This reloaded the `notes` state (root directory), but **did not reload** the `folderContents` for the active workspace. Since the UI was displaying from the cached `folderContents`, users saw stale data.

## Solution

Added workspace content reloading logic to all functions that modify notes:

### 1. `renameNote` Function
```typescript
// If in a workspace, reload its contents
if (activeWorkspace && activeWorkspace !== projectPath) {
  try {
    const contents = await window.electronAPI.listNotes(activeWorkspace);
    setFolderContents(prev => {
      const newMap = new Map(prev);
      newMap.set(activeWorkspace, contents);
      return newMap;
    });
  } catch (error) {
    console.error('Failed to reload workspace contents:', error);
  }
}
```

### 2. `deleteNote` Function
Added the same workspace reload logic after deleting a note.

### 3. `deleteFolder` Function
Added the same workspace reload logic after deleting a folder.

### 4. `createNoteFromEditor` Function
Added the same workspace reload logic after creating a new note.

## Additional Fix: Rename Note Behavior

**Original Problem:** When renaming a note, the tab would close and switch to another note.

**Solution:** 
- Added `setNoteTitle(newTitle)` to immediately update the editor title
- Changed `loadNotes(projectPath)` to `loadNotes(projectPath, false)` to prevent auto-selecting the first note
- This keeps the renamed note open and active in its current tab

## Code Changes

**Files Modified:**
- `/src/pages/MainPage.tsx`

**Functions Updated:**
- `renameNote()`
- `deleteNote()`
- `deleteFolder()`
- `createNoteFromEditor()`

## Testing

After the fix:
1. ✅ Rename a note in a workspace → Changes appear immediately in notes list
2. ✅ Delete a note in a workspace → Note disappears from list immediately
3. ✅ Create a note in a workspace → Note appears in list immediately
4. ✅ Rename a note → Note stays open in current tab with new name
5. ✅ All operations work in default workspace (root folder)
6. ✅ All operations work in custom workspaces

## Impact

This fix ensures that workspace operations provide immediate visual feedback without requiring application restart, significantly improving the user experience when working with multiple workspaces.
