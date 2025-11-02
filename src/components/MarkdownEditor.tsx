import React, { useState, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, keymap } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, EditorState } from '@codemirror/state';
import Autocomplete, { AutocompleteItem } from './Autocomplete';
import './MarkdownEditor.css';

interface Note {
  name: string;
  path: string;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  notes?: Note[];
  onNoteLink?: (notePath: string) => void;
  currentNotePath?: string;
}

// Create a view plugin to add line-level decorations for headers
const headerLinePlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: any) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: any) {
    const builder = new RangeSetBuilder<Decoration>();
    
    for (let { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node: any) => {
          // Check if this is a header node
          if (node.name === 'ATXHeading1' || node.name === 'ATXHeading2' || 
              node.name === 'ATXHeading3' || node.name === 'ATXHeading4' || 
              node.name === 'ATXHeading5' || node.name === 'ATXHeading6') {
            
            const line = view.state.doc.lineAt(node.from);
            const level = node.name.charAt(node.name.length - 1);
            
            // Add a line decoration with the appropriate header class
            builder.add(
              line.from,
              line.from,
              Decoration.line({ class: `header-line-${level}` })
            );
          }
        },
      });
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});

// Plugin to hide markdown formatting when cursor is not touching the formatted text
const hideMarkdownPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: any) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  isCursorNear(view: any, nodeFrom: number, nodeTo: number): boolean {
    const cursorPos = view.state.selection.main.head;
    // Check if cursor is within or immediately adjacent to the formatting mark
    return cursorPos >= nodeFrom - 1 && cursorPos <= nodeTo + 1;
  }

  findFormattedRange(view: any, node: any): { from: number; to: number } | null {
    // For header marks, find the entire header line
    if (node.name === 'HeaderMark') {
      const line = view.state.doc.lineAt(node.from);
      return { from: node.from, to: line.to };
    }
    
    // For emphasis marks, find the parent emphasis node
    if (node.name === 'EmphasisMark') {
      let parent = node.node.parent;
      while (parent) {
        if (parent.name === 'Emphasis' || parent.name === 'StrongEmphasis') {
          return { from: parent.from, to: parent.to };
        }
        parent = parent.parent;
      }
    }
    
    // For code marks, find the parent inline code node
    if (node.name === 'CodeMark') {
      let parent = node.node.parent;
      while (parent) {
        if (parent.name === 'InlineCode') {
          return { from: parent.from, to: parent.to };
        }
        parent = parent.parent;
      }
    }
    
    // For links, find the parent link node
    if (node.name === 'LinkMark' || node.name === 'URL') {
      let parent = node.node.parent;
      while (parent) {
        if (parent.name === 'Link') {
          return { from: parent.from, to: parent.to };
        }
        parent = parent.parent;
      }
    }
    
    return null;
  }

  buildDecorations(view: any) {
    const builder = new RangeSetBuilder<Decoration>();
    const cursorPos = view.state.selection.main.head;
    const text = view.state.doc.toString();
    
    // Collect all decorations first, then add them sorted
    const decorations: Array<{ from: number; to: number; decoration: Decoration }> = [];
    
    // Find all [[note]] links and check if cursor is in any of them
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      const linkFrom = match.index;
      const linkTo = match.index + match[0].length;
      const cursorInLink = cursorPos >= linkFrom && cursorPos <= linkTo;
      
      // Hide the brackets if cursor is NOT in this link
      if (!cursorInLink) {
        // Hide opening [[
        decorations.push({
          from: linkFrom,
          to: linkFrom + 2,
          decoration: Decoration.replace({})
        });
        // Hide closing ]]
        decorations.push({
          from: linkTo - 2,
          to: linkTo,
          decoration: Decoration.replace({})
        });
      }
    }
    
    // Process syntax tree for other markdown formatting
    for (let { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node: any) => {
          // Find the range of the formatted text (including marks)
          const formattedRange = this.findFormattedRange(view, node);
          
          if (formattedRange) {
            // Check if cursor is anywhere within the formatted text range
            const cursorInRange = cursorPos >= formattedRange.from && cursorPos <= formattedRange.to;
            
            // Only hide formatting if cursor is NOT in the formatted range
            if (!cursorInRange) {
              // Hide header marks (# ## ###)
              if (node.name === 'HeaderMark') {
                decorations.push({
                  from: node.from,
                  to: node.to,
                  decoration: Decoration.replace({})
                });
              }
              // Hide emphasis marks (** __ * _)
              else if (node.name === 'EmphasisMark') {
                decorations.push({
                  from: node.from,
                  to: node.to,
                  decoration: Decoration.replace({})
                });
              }
              // Hide link marks ([ ] ( ))
              else if (node.name === 'LinkMark' || node.name === 'URL') {
                const text = view.state.doc.sliceString(node.from, node.to);
                if (text === '[' || text === ']' || text === '(' || text === ')') {
                  decorations.push({
                    from: node.from,
                    to: node.to,
                    decoration: Decoration.replace({})
                  });
                }
              }
              // Hide code marks (`)
              else if (node.name === 'CodeMark') {
                decorations.push({
                  from: node.from,
                  to: node.to,
                  decoration: Decoration.replace({})
                });
              }
            }
          }
        },
      });
    }
    
    // Sort decorations by position and add to builder
    decorations.sort((a, b) => a.from - b.from);
    for (const { from, to, decoration } of decorations) {
      builder.add(from, to, decoration);
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});

// Plugin to style [[note]] links
const noteLinkPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: any) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: any) {
    const builder = new RangeSetBuilder<Decoration>();
    const text = view.state.doc.toString();
    
    // Find all [[note]] patterns
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      const from = match.index;
      const to = match.index + match[0].length;
      
      // Add decoration to make it look like a link
      builder.add(
        from,
        to,
        Decoration.mark({
          class: 'note-link',
          attributes: {
            'data-note-name': match[1]
          }
        })
      );
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  notes = [],
  onNoteLink,
  currentNotePath
}) => {
  const [autocomplete, setAutocomplete] = useState<{
    show: boolean;
    position: { x: number; y: number };
    query: string;
    items: AutocompleteItem[];
    selectedIndex: number;
    startPos: number;
  } | null>(null);
  
  const editorRef = useRef<any>(null);
  const autocompleteRef = useRef(autocomplete);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync with state
  useEffect(() => {
    autocompleteRef.current = autocomplete;
  }, [autocomplete]);

  // Filter notes based on query, excluding current note
  const filterNotes = (query: string): AutocompleteItem[] => {
    const lowerQuery = query.toLowerCase();
    return notes
      .filter(note => 
        note.name.toLowerCase().includes(lowerQuery) && 
        note.path !== currentNotePath
      )
      .map(note => ({
        id: note.path,
        label: note.name,
        subtitle: note.path.split(/[/\\]/).slice(-2, -1)[0] || ''
      }))
      .slice(0, 10);
  };

  // Handle clicks on [[note]] links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!wrapperRef.current || !onNoteLink) return;

      const target = e.target as HTMLElement;
      
      // Check if clicked element has note-link class or is inside one
      const noteLink = target.closest('.note-link');
      if (noteLink) {
        const noteName = noteLink.getAttribute('data-note-name');
        if (noteName) {
          // Find the note by name
          const note = notes.find(n => n.name === noteName);
          if (note) {
            onNoteLink(note.path);
          }
        }
      }
    };

    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener('click', handleClick);
      return () => wrapper.removeEventListener('click', handleClick);
    }
  }, [notes, onNoteLink]);

  // Handle @ key press
  const handleEditorChange = (newValue: string, viewUpdate: any) => {
    onChange(newValue);

    if (!viewUpdate.view) return;

    const cursorPos = viewUpdate.state.selection.main.head;
    const textBefore = newValue.substring(0, cursorPos);
    const lastAtIndex = textBefore.lastIndexOf('@');

    // Check if we're in an @ mention
    if (lastAtIndex !== -1) {
      const textAfterAt = textBefore.substring(lastAtIndex + 1);
      
      // Only show autocomplete if there's no space after @ (still typing the mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        const query = textAfterAt;
        const filteredNotes = filterNotes(query);

        // Get cursor coordinates
        const coords = viewUpdate.view.coordsAtPos(cursorPos);
        if (coords) {
          setAutocomplete({
            show: true,
            position: { x: coords.left, y: coords.bottom + 5 },
            query,
            items: filteredNotes,
            selectedIndex: 0,
            startPos: lastAtIndex
          });
        }
      } else {
        setAutocomplete(null);
      }
    } else {
      setAutocomplete(null);
    }
  };

  // Handle autocomplete selection
  const handleAutocompleteSelect = (item: AutocompleteItem) => {
    if (!autocomplete || !editorRef.current) return;

    const cursorPos = editorRef.current.state.selection.main.head;
    const beforeMention = value.substring(0, autocomplete.startPos);
    const afterCursor = value.substring(cursorPos);
    
    // Create a link format: [[NoteName]]
    const link = `[[${item.label}]]`;
    const newValue = beforeMention + link + afterCursor;
    
    onChange(newValue);
    setAutocomplete(null);

    // Move cursor after the link
    setTimeout(() => {
      if (editorRef.current) {
        const newPos = autocomplete.startPos + link.length;
        editorRef.current.dispatch({
          selection: { anchor: newPos, head: newPos }
        });
      }
    }, 10);
  };

  // Handle keyboard navigation in autocomplete
  useEffect(() => {
    if (!autocomplete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!autocompleteRef.current) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setAutocomplete(prev => prev ? {
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.items.length - 1)
        } : null);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setAutocomplete(prev => prev ? {
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0)
        } : null);
      } else if (e.key === 'Enter') {
        if (autocompleteRef.current && autocompleteRef.current.items.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleAutocompleteSelect(autocompleteRef.current.items[autocompleteRef.current.selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setAutocomplete(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [autocomplete]);

  const theme = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '16px',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    },
    '.cm-scroller': {
      backgroundColor: 'var(--bg-primary)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif',
    },
    '.cm-content': {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif',
      padding: '0',
      caretColor: 'var(--text-primary)',
      color: 'var(--text-primary)',
    },
    '.cm-line': {
      padding: '0 4px',
      lineHeight: '1.6',
      color: 'var(--text-primary)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-secondary)',
      border: 'none',
      color: 'var(--text-tertiary)',
    },
    '.cm-lineNumbers': {
      minWidth: '40px',
      color: 'var(--text-tertiary)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--accent-light) !important',
    },
    '&.cm-focused .cm-selectionBackground, &.cm-focused ::selection': {
      backgroundColor: 'var(--accent-light) !important',
    },
    '.cm-cursor, .cm-cursor-primary': {
      borderLeftColor: 'var(--text-primary)',
      borderLeftWidth: '2px',
    },
    // Line-level header styling
    '.header-line-1': {
      fontSize: '2em',
      fontWeight: '700',
      lineHeight: '1.3',
      paddingTop: '0.5em',
      paddingBottom: '0.3em',
      textDecoration: 'none',
    },
    '.header-line-2': {
      fontSize: '1.6em',
      fontWeight: '600',
      lineHeight: '1.3',
      paddingTop: '0.4em',
      paddingBottom: '0.2em',
      textDecoration: 'none',
    },
    '.header-line-3': {
      fontSize: '1.4em',
      fontWeight: '600',
      lineHeight: '1.3',
      paddingTop: '0.3em',
      paddingBottom: '0.1em',
      textDecoration: 'none',
    },
    '.header-line-4': {
      fontSize: '1.2em',
      fontWeight: '600',
      lineHeight: '1.3',
      textDecoration: 'none',
    },
    '.header-line-5': {
      fontSize: '1.1em',
      fontWeight: '600',
      lineHeight: '1.3',
      textDecoration: 'none',
    },
    '.header-line-6': {
      fontSize: '1em',
      fontWeight: '600',
      lineHeight: '1.3',
      color: 'var(--text-secondary)',
      textDecoration: 'none',
    },
    // Markdown styling - make headers larger and styled
    '.cm-header-1': {
      fontSize: '2em',
      fontWeight: '700',
      lineHeight: '1.3',
      color: 'var(--text-primary)',
      textDecoration: 'none',
    },
    '.cm-header-2': {
      fontSize: '1.6em',
      fontWeight: '600',
      lineHeight: '1.3',
      color: 'var(--text-primary)',
      textDecoration: 'none',
    },
    '.cm-header-3': {
      fontSize: '1.4em',
      fontWeight: '600',
      lineHeight: '1.3',
      color: 'var(--text-primary)',
      textDecoration: 'none',
    },
    '.cm-header-4': {
      fontSize: '1.2em',
      fontWeight: '600',
      lineHeight: '1.3',
      color: 'var(--text-primary)',
      textDecoration: 'none',
    },
    '.cm-header-5': {
      fontSize: '1.1em',
      fontWeight: '600',
      lineHeight: '1.3',
      color: 'var(--text-primary)',
      textDecoration: 'none',
    },
    '.cm-header-6': {
      fontSize: '1em',
      fontWeight: '600',
      lineHeight: '1.3',
      color: 'var(--text-secondary)',
      textDecoration: 'none',
    },
    // Make header marks (# ## ###) lighter/smaller
    '.cm-formatting-header': {
      color: 'var(--text-tertiary)',
      fontSize: '0.8em',
      fontWeight: '400',
    },
    '.cm-strong': {
      fontWeight: '700',
      color: 'var(--text-primary)',
    },
    '.cm-em': {
      fontStyle: 'italic',
      color: 'var(--text-primary)',
    },
    '.cm-link': {
      color: 'var(--accent)',
      textDecoration: 'underline',
    },
    '.cm-url': {
      color: 'var(--accent)',
      opacity: 0.7,
    },
    '.cm-monospace, .cm-code': {
      fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
      backgroundColor: 'var(--bg-tertiary)',
      padding: '2px 4px',
      borderRadius: '3px',
      color: 'var(--accent)',
    },
    '.cm-list': {
      color: 'var(--accent)',
    },
    '.cm-quote': {
      color: 'var(--text-secondary)',
      fontStyle: 'italic',
      borderLeft: '3px solid var(--border)',
      paddingLeft: '10px',
    },
  }, { dark: document.documentElement.getAttribute('data-theme') === 'dark' });

  return (
    <div ref={wrapperRef} className="codemirror-wrapper">
      <CodeMirror
        ref={(editor: any) => {
          if (editor?.view) {
            editorRef.current = editor.view;
          }
        }}
        value={value}
        height="100%"
        extensions={[markdown({ base: markdownLanguage }), headerLinePlugin, hideMarkdownPlugin, noteLinkPlugin, theme]}
        onChange={handleEditorChange}
        basicSetup={{
          lineNumbers: false,
          highlightActiveLineGutter: false,
          highlightActiveLine: false,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: false,
          closeBrackets: false,
          autocompletion: false,
          rectangularSelection: true,
          crosshairCursor: false,
          highlightSelectionMatches: false,
          closeBracketsKeymap: false,
          searchKeymap: true,
          foldKeymap: false,
          completionKeymap: false,
          lintKeymap: false,
        }}
      />
      {autocomplete && autocomplete.show && (
        <Autocomplete
          items={autocomplete.items}
          position={autocomplete.position}
          selectedIndex={autocomplete.selectedIndex}
          onSelect={handleAutocompleteSelect}
          onClose={() => setAutocomplete(null)}
        />
      )}
    </div>
  );
};

export default MarkdownEditor;
