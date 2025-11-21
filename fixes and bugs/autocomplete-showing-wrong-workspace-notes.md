# Autocomplete Showing Wrong Workspace Notes

## Problem Description

When using the `@` mention feature to link notes inside the markdown editor, the autocomplete dropdown was showing notes from the wrong workspace.

**Specific Issue:**
- When editing a note inside a workspace, pressing `@` would show notes from the default workspace (root folder) instead of notes from the current workspace
- This made it difficult to link notes within the same workspace
- Users had to manually type full note names or couldn't find notes they wanted to link

## Root Cause

The `MarkdownEditor` component was receiving the `notes` prop directly from the full notes list in `MainPage`:

```typescript
<EditorArea
  notes={notes}  // ❌ Wrong: all notes from project
  ...
/>
```

The `notes` state contains all notes from the project root directory, not filtered by workspace. When the editor's `@` autocomplete filtered these notes, it would only show root-level notes regardless of which workspace the current note belonged to.

The filtering logic in `MarkdownEditor.tsx`:
```typescript
const filterNotes = (query: string): AutocompleteItem[] => {
  const lowerQuery = query.toLowerCase();
  const filteredNotes = notes  // ❌ Using all notes, not workspace-specific
    .filter(note => 
      note.name.toLowerCase().includes(lowerQuery) && 
      note.path !== currentNotePath
    )
    // ...
};
```

## Solution

Created a new function `getNotesForAutocomplete()` in `MainPage.tsx` that intelligently determines which notes to show based on the current note's location.

### Implementation

```typescript
// Get notes for autocomplete based on the current note's workspace
const getNotesForAutocomplete = () => {
  if (!selectedNote || !projectPath) {
    return [];
  }

  // Determine which workspace the current note belongs to
  const noteDir = selectedNote.substring(0, selectedNote.lastIndexOf('/'));
  
  // Check if the note is in the root directory (default workspace)
  if (noteDir === projectPath) {
    // Return only root-level notes (excluding folders and workspaces)
    return notes.filter(note => !note.isFolder && !note.isWorkspace);
  }
  
  // Check if the note is in a workspace
  const workspace = workspaces.find(ws => selectedNote.startsWith(ws.path + '/'));
  if (workspace) {
    // Return notes from that workspace
    return folderContents.get(workspace.path) || [];
  }
  
  // Fallback: return all notes
  return notes.filter(note => !note.isFolder && !note.isWorkspace);
};
```

### Logic Flow

1. **Extract note directory** - Determines the folder containing the current note
2. **Check if in root workspace**:
   - If `noteDir === projectPath`, the note is in the root folder
   - Returns only root-level notes (filters out folders and workspace folders)
3. **Check if in a specific workspace**:
   - Searches through the `workspaces` array to find a matching workspace
   - Returns notes from `folderContents.get(workspace.path)`
4. **Fallback** - Returns filtered notes if no match found

### Updated Component Call

```typescript
<EditorArea
  notes={getNotesForAutocomplete()}  // ✅ Correct: workspace-filtered notes
  ...
/>
```

## Benefits

1. **Context-Aware Autocomplete** - `@` mentions only show relevant notes from the same workspace
2. **Cleaner Results** - Excludes folders and workspace folders from autocomplete
3. **Better UX** - Users can easily find and link notes within their current workspace
4. **No Cross-Contamination** - Notes from different workspaces don't pollute the autocomplete

## Code Changes

**Files Modified:**
- `/src/pages/MainPage.tsx`

**New Function:**
- `getNotesForAutocomplete()`

**Updated:**
- `EditorArea` component props: `notes={notes}` → `notes={getNotesForAutocomplete()}`

## Testing

After the fix:
1. ✅ In root workspace → `@` shows only root-level notes
2. ✅ In custom workspace → `@` shows only notes from that workspace
3. ✅ Folders are excluded from autocomplete
4. ✅ Workspace folders are excluded from autocomplete
5. ✅ Current note is excluded from autocomplete (no self-linking)
6. ✅ Autocomplete updates when switching between notes in different workspaces

## Impact

This fix makes the note-linking feature workspace-aware, significantly improving usability when organizing notes across multiple workspaces. Users can now confidently use `@` mentions knowing they'll see only relevant notes from their current context.
