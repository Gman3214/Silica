import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiRouter } from '../lib/ai-router';
import './RightSidebar.css';
import './ChatMarkdown.css';

interface Note {
  path: string;
  name: string;
  content?: string;
}

interface RightSidebarProps {
  currentNote: Note | null;
  allNotes: Note[];
  onNoteClick: (notePath: string) => void;
  onSaveChat?: (title: string, content: string) => Promise<void>;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ currentNote, allNotes, onNoteClick, onSaveChat }) => {
  const [activeTab, setActiveTab] = useState<'nav' | 'chat'>('chat');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAIConfigured, setIsAIConfigured] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check AI configuration on mount
  useEffect(() => {
    const checkAI = async () => {
      try {
        const status = await aiRouter.getConnectionStatus();
        setIsAIConfigured(status.connected && status.provider !== 'none');
      } catch (error) {
        setIsAIConfigured(false);
      }
    };
    checkAI();
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [input]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      // Prepare context from current note if available
      let systemPrompt = "You are a helpful assistant for a note-taking app.";
      if (currentNote) {
        systemPrompt += ` The user is currently viewing a note titled "${currentNote.name}".`;
        if (currentNote.content) {
          // Truncate content if too long to avoid token limits
          const truncatedContent = currentNote.content.slice(0, 2000);
          systemPrompt += ` Here is the content of the note:\n\n${truncatedContent}${currentNote.content.length > 2000 ? '...' : ''}`;
        }
      }

      const response = await aiRouter.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
          userMessage
        ],
        options: {
          temperature: 0.7,
        }
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request. Please check your AI settings.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    setIsLoading(false);
  };

  const handleSaveChatAsNote = async () => {
    if (messages.length === 0 || !onSaveChat) return;

    const timestamp = new Date().toLocaleString();
    const title = `AI Chat - ${timestamp.replace(/[/:]/g, '-')}`;
    
    let content = `# ${title}\n\n`;
    content += `#ai.chats\n\n`;
    if (currentNote) {
      content += `Context: [[${currentNote.name.replace('.md', '')}]]\n\n`;
    }
    
    content += messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'AI';
      return `### ${role}\n${msg.content}\n`;
    }).join('\n');

    try {
      await onSaveChat(title, content);
    } catch (error) {
      console.error('Failed to save chat as note:', error);
    }
  };

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
    if (!currentNote || !currentNote.content) return [];
    
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
    if (!currentNote) return [];
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
    if (!currentNote || !currentNote.content) return [];
    
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="right-sidebar">
      <div className="right-sidebar-tabs">
        <button 
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          AI Chat
        </button>
        <button 
          className={`tab-btn ${activeTab === 'nav' ? 'active' : ''}`}
          onClick={() => setActiveTab('nav')}
        >
          Navigation
        </button>
      </div>

      {activeTab === 'nav' && (
        <>
          {!currentNote ? (
            <div className="right-sidebar-empty">
              <p>Select a note to see connections</p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </>
      )}

      {activeTab === 'chat' && (
        <div className="chat-container">
          {!isAIConfigured ? (
            <div className="chat-empty">
              <p>AI is not configured. Please check your settings.</p>
            </div>
          ) : (
            <>
              <div className="chat-toolbar">
                <span className="chat-context-info">
                  {currentNote ? `Context: ${currentNote.name}` : 'No active note context'}
                </span>
                <div className="chat-actions">
                  <button 
                    className="chat-action-btn"
                    onClick={handleSaveChatAsNote}
                    title="Save Chat as Note"
                    disabled={messages.length === 0}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                  </button>
                  <button 
                    className="chat-action-btn"
                    onClick={handleNewChat}
                    title="New Chat"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6"></path>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty">
                    <p>Start a conversation with AI about your notes.</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.role}`}>
                      <div className={`message-content ${msg.role === 'assistant' ? 'chat-markdown' : ''}`}>
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask AI..."
                  disabled={isLoading}
                  rows={1}
                />
                <button type="submit" disabled={!input.trim() || isLoading}>
                  {isLoading ? (
                    <div className="spinner" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RightSidebar;
