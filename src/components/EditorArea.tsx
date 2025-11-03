import React from 'react';
import MarkdownEditor from './MarkdownEditor';
import TabBar from './TabBar';
import './EditorArea.css';

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

interface EditorAreaProps {
  selectedNote: string | null;
  noteTitle: string;
  noteContent: string;
  openTabs: Tab[];
  notes: Note[];
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onContentChange: (content: string) => void;
  onNoteLink: (notePath: string) => void;
  onCreateNote: (title: string, openNote: boolean, updatedContent?: string) => Promise<string | void>;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
  onTabsReorder: (tabs: Tab[]) => void;
}

const EditorArea: React.FC<EditorAreaProps> = ({
  selectedNote,
  noteTitle,
  noteContent,
  openTabs,
  notes,
  onTitleChange,
  onTitleBlur,
  onContentChange,
  onNoteLink,
  onCreateNote,
  onTabSelect,
  onTabClose,
  onTabsReorder,
}) => {
  if (!selectedNote) {
    return (
      <div className="editor-container">
        <div className="no-note-selected">
          <p>Select a note or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <TabBar
        tabs={openTabs}
        activeTab={selectedNote}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
        onTabsReorder={onTabsReorder}
      />
      <div className="editor-header">
        <input 
          type="text" 
          className="note-title-input" 
          placeholder="Untitled Note" 
          value={noteTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
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
          onChange={onContentChange}
          placeholder="Start writing..."
          notes={notes}
          onNoteLink={onNoteLink}
          currentNotePath={selectedNote || undefined}
          onCreateNote={onCreateNote}
        />
      </div>
    </div>
  );
};

export default EditorArea;
