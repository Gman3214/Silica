import React from 'react';
import './RightSidebar.css';

interface Note {
  path: string;
  name: string;
  content?: string;
}

interface RightSidebarProps {
  currentNote: Note | null;
  allNotes: Note[];
  onNoteClick: (notePath: string) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ currentNote, allNotes, onNoteClick }) => {
  if (!currentNote) {
    return (
      <div className="right-sidebar">
        <div className="right-sidebar-empty">
          <p>Select a note to see connections</p>
        </div>
      </div>
    );
  }

  // Extract links from note content using [[Note Name]] syntax
  const extractLinks = (content: string): string[] => {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }
    return links;
  };

  // Extract tags from note content
  const extractTags = (content: string): string[] => {
    const tagRegex = /#([a-zA-Z0-9_.-]+)(?=\s|$)/g;
    const tags: string[] = [];
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1]);
    }
    return [...new Set(tags)]; // Remove duplicates
  };

  // Get forward links (notes this note links to)
  const getForwardLinks = (): Note[] => {
    if (!currentNote.content) return [];
    
    const linkedNames = extractLinks(currentNote.content);
    return allNotes.filter(note => 
      linkedNames.some(linkName => 
        note.name.toLowerCase() === linkName.toLowerCase() ||
        note.name.toLowerCase() === linkName.toLowerCase() + '.md'
      )
    );
  };

  // Get backlinks (notes that link to this note)
  const getBacklinks = (): Note[] => {
    const currentNoteName = currentNote.name.replace('.md', '');
    
    return allNotes.filter(note => {
      if (!note.content || note.path === currentNote.path) return false;
      
      const linkedNames = extractLinks(note.content);
      return linkedNames.some(linkName => 
        linkName.toLowerCase() === currentNoteName.toLowerCase()
      );
    });
  };

  // Get related notes by shared tags
  const getRelatedNotes = (): Note[] => {
    if (!currentNote.content) return [];
    
    const currentTags = extractTags(currentNote.content);
    if (currentTags.length === 0) return [];

    const relatedNotes = allNotes
      .filter(note => {
        if (!note.content || note.path === currentNote.path) return false;
        
        const noteTags = extractTags(note.content);
        return noteTags.some(tag => currentTags.includes(tag));
      })
      .map(note => ({
        ...note,
        sharedTags: extractTags(note.content || '').filter(tag => 
          currentTags.includes(tag)
        )
      }))
      .sort((a, b) => b.sharedTags.length - a.sharedTags.length);

    return relatedNotes;
  };

  const forwardLinks = getForwardLinks();
  const backlinks = getBacklinks();
  const relatedNotes = getRelatedNotes();

  return (
    <div className="right-sidebar">
      <div className="right-sidebar-section">
        <div className="section-header">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h12M8 2l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h3>Forward Links</h3>
          <span className="count">{forwardLinks.length}</span>
        </div>
        <div className="section-content">
          {forwardLinks.length === 0 ? (
            <p className="empty-message">No outgoing links</p>
          ) : (
            forwardLinks.map(note => (
              <div 
                key={note.path} 
                className="link-item"
                onClick={() => onNoteClick(note.path)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M9 3h4v4M13 3L7 9M11 13H3V5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{note.name.replace('.md', '')}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="right-sidebar-section">
        <div className="section-header">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8H2M8 14l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h3>Backlinks</h3>
          <span className="count">{backlinks.length}</span>
        </div>
        <div className="section-content">
          {backlinks.length === 0 ? (
            <p className="empty-message">No incoming links</p>
          ) : (
            backlinks.map(note => (
              <div 
                key={note.path} 
                className="link-item"
                onClick={() => onNoteClick(note.path)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M9 3h4v4M13 3L7 9M11 13H3V5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{note.name.replace('.md', '')}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="right-sidebar-section">
        <div className="section-header">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8a5 5 0 015-5h0a5 5 0 015 5h0a5 5 0 01-5 5h0a5 5 0 01-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
          </svg>
          <h3>Related Notes</h3>
          <span className="count">{relatedNotes.length}</span>
        </div>
        <div className="section-content">
          {relatedNotes.length === 0 ? (
            <p className="empty-message">No related notes</p>
          ) : (
            relatedNotes.map(note => (
              <div 
                key={note.path} 
                className="link-item related"
                onClick={() => onNoteClick(note.path)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M9 3h4v4M13 3L7 9M11 13H3V5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="link-info">
                  <span className="link-name">{note.name.replace('.md', '')}</span>
                  <div className="shared-tags">
                    {(note as any).sharedTags.map((tag: string) => (
                      <span key={tag} className="tag">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;
