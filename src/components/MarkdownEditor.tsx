import React, { useState, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, keymap, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, EditorState } from '@codemirror/state';
import Autocomplete, { AutocompleteItem } from './Autocomplete';
import TextFormatToolbar from './TextFormatToolbar';
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
  onCreateNote?: (title: string, openNote: boolean, updatedContent?: string) => Promise<string | void>;
  workspaceTags?: string[];
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
    
    // Find all tags (#tagname - # without space after it, supports dots for hierarchy)
    const tagRegex = /#([a-zA-Z0-9_.-]+)(?=\s|$)/g;
    let tagMatch;
    
    while ((tagMatch = tagRegex.exec(text)) !== null) {
      const tagFrom = tagMatch.index;
      const tagTo = tagMatch.index + tagMatch[0].length;
      
      // Check if this is NOT a header (header would have space after #)
      const charBefore = tagFrom > 0 ? text[tagFrom - 1] : '\n';
      const isAtLineStart = charBefore === '\n' || tagFrom === 0;
      
      // If it's at line start, check if there's a space after the #
      if (isAtLineStart) {
        const charAfterHash = text[tagFrom + 1];
        if (charAfterHash && charAfterHash !== ' ') {
          // This is a tag, not a header
          decorations.push({
            from: tagFrom,
            to: tagTo,
            decoration: Decoration.mark({ class: 'cm-tag' })
          });
          continue;
        }
      } else {
        // Not at line start, so it's definitely a tag
        decorations.push({
          from: tagFrom,
          to: tagTo,
          decoration: Decoration.mark({ class: 'cm-tag' })
        });
      }
    }
    
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
              // Hide header marks (# ## ###) and the space after them
              if (node.name === 'HeaderMark') {
                const docLength = view.state.doc.length;
                // Check if there's a space after the header mark
                const charAfterMark = node.to < docLength ? view.state.doc.sliceString(node.to, node.to + 1) : '';
                
                // If there's a space after the header mark, include it in the hidden range
                const endPos = charAfterMark === ' ' ? Math.min(node.to + 1, docLength) : node.to;
                
                decorations.push({
                  from: node.from,
                  to: endPos,
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

// Plugin to style custom markdown (highlight and underline)
const customMarkdownPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: any) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: any) {
    const builder = new RangeSetBuilder<Decoration>();
    const text = view.state.doc.toString();
    const cursorPos = view.state.selection.main.head;
    
    // Collect all decorations first, then add them sorted
    const decorations: Array<{ from: number; to: number; decoration: Decoration }> = [];
    
    // Find all ==highlight== patterns
    const highlightRegex = /==([^=]+)==/g;
    let match;
    
    while ((match = highlightRegex.exec(text)) !== null) {
      const matchFrom = match.index;
      const matchTo = match.index + match[0].length;
      const cursorInMatch = cursorPos >= matchFrom && cursorPos <= matchTo;
      
      if (!cursorInMatch) {
        // Hide the == markers
        decorations.push({
          from: matchFrom,
          to: matchFrom + 2,
          decoration: Decoration.replace({})
        });
        decorations.push({
          from: matchTo - 2,
          to: matchTo,
          decoration: Decoration.replace({})
        });
      }
      
      // Style the entire match (including markers when visible)
      decorations.push({
        from: matchFrom,
        to: matchTo,
        decoration: Decoration.mark({
          class: 'custom-highlight'
        })
      });
    }
    
    // Find all <u>underline</u> patterns
    const underlineRegex = /<u>([^<]+)<\/u>/g;
    
    while ((match = underlineRegex.exec(text)) !== null) {
      const matchFrom = match.index;
      const matchTo = match.index + match[0].length;
      const contentFrom = matchFrom + 3; // After <u>
      const contentTo = matchTo - 4; // Before </u>
      const cursorInMatch = cursorPos >= matchFrom && cursorPos <= matchTo;
      
      if (!cursorInMatch) {
        // Hide the <u> and </u> tags
        decorations.push({
          from: matchFrom,
          to: contentFrom,
          decoration: Decoration.replace({})
        });
        decorations.push({
          from: contentTo,
          to: matchTo,
          decoration: Decoration.replace({})
        });
      }
      
      // Style the content with underline
      decorations.push({
        from: contentFrom,
        to: contentTo,
        decoration: Decoration.mark({
          class: 'custom-underline'
        })
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

// Plugin to add interactive checkboxes for task lists
const checkboxPlugin = (onChangeCallback: (newValue: string) => void) => ViewPlugin.fromClass(class {
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
    
    // Match task list items: - [ ] or - [x]
    const checkboxRegex = /^(\s*)-\s\[([ xX])\]\s/gm;
    let match: RegExpExecArray | null;
    
    while ((match = checkboxRegex.exec(text)) !== null) {
      const matchResult = match; // Capture for closure
      const from = matchResult.index + matchResult[1].length; // After leading spaces
      const checkboxEnd = from + matchResult[0].length - matchResult[1].length;
      const isChecked = matchResult[2].toLowerCase() === 'x';
      
      // Create a widget for the checkbox
      const checkbox = Decoration.widget({
        widget: new class extends WidgetType {
          toDOM() {
            const span = document.createElement('span');
            span.className = 'task-checkbox';
            span.setAttribute('data-checked', isChecked.toString());
            span.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 16 16" class="checkbox-icon">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
                ${isChecked ? '<path d="M5 8L7 10L11 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
              </svg>
            `;
            
            span.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Toggle the checkbox in the document
              const newChecked = !isChecked;
              const newCheckChar = newChecked ? 'x' : ' ';
              const oldCheckbox = matchResult[0];
              const newCheckbox = oldCheckbox.replace(/\[([ xX])\]/, `[${newCheckChar}]`);
              
              const transaction = view.state.update({
                changes: {
                  from: matchResult.index,
                  to: matchResult.index + matchResult[0].length,
                  insert: newCheckbox
                }
              });
              
              view.dispatch(transaction);
              
              // Call the onChange callback with the updated text
              const newText = view.state.doc.toString();
              onChangeCallback(newText);
            });
            
            return span;
          }
        }(),
        side: -1
      });
      
      // Hide the markdown syntax
      builder.add(from, from, checkbox);
      builder.add(from, checkboxEnd, Decoration.replace({}));
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
  currentNotePath,
  onCreateNote,
  workspaceTags = []
}) => {
  const [autocomplete, setAutocomplete] = useState<{
    show: boolean;
    position: { x: number; y: number };
    query: string;
    items: AutocompleteItem[];
    selectedIndex: number;
    startPos: number;
  } | null>(null);
  
  const [formatToolbar, setFormatToolbar] = useState<{
    show: boolean;
    position: { x: number; y: number };
    selection: { from: number; to: number };
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
    const filteredNotes = notes
      .filter(note => 
        note.name.toLowerCase().includes(lowerQuery) && 
        note.path !== currentNotePath
      )
      .map(note => ({
        id: note.path,
        label: note.name,
        subtitle: note.path.split(/[/\\]/).slice(-2, -1)[0] || '',
        type: 'note' as const
      }))
      .slice(0, 10);

    // Check if there's an exact match
    const hasExactMatch = notes.some(note => 
      note.name.toLowerCase() === lowerQuery && 
      note.path !== currentNotePath
    );

    // If query is not empty and no exact match, add create options
    const items: AutocompleteItem[] = [...filteredNotes];
    if (query.trim() && !hasExactMatch) {
      items.push({
        id: 'create-note',
        label: `Create "${query}"`,
        subtitle: 'Create new note',
        type: 'create' as const
      });
      items.push({
        id: 'create-and-move',
        label: `Create "${query}" and move`,
        subtitle: 'Create and open new note',
        type: 'create-and-move' as const
      });
    }

    return items;
  };

  // Filter tags based on query
  const filterTags = (query: string): AutocompleteItem[] => {
    const lowerQuery = query.toLowerCase();
    const filteredTags = workspaceTags
      .filter(tag => tag.toLowerCase().includes(lowerQuery))
      .map(tag => ({
        id: tag,
        label: tag,
        subtitle: 'Tag',
        type: 'tag' as const
      }))
      .slice(0, 10);

    return filteredTags;
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

  // Handle text selection and show format toolbar on left click
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Small delay to let CodeMirror update the selection
      setTimeout(() => {
        if (!editorRef.current || !wrapperRef.current) return;

        // Check if the click was inside the editor
        const target = e.target as HTMLElement;
        if (!wrapperRef.current.contains(target)) return;

        // Check if we have a selection
        const selection = editorRef.current.state.selection.main;
        const hasSelection = selection.from !== selection.to;

        if (hasSelection && e.button === 0) { // Left click
          // Get the coordinates of the selection start and end
          const coordsStart = editorRef.current.coordsAtPos(selection.from);
          const coordsEnd = editorRef.current.coordsAtPos(selection.to);
          
          if (coordsEnd) {
            // Approximate toolbar dimensions (will be adjusted by component)
            const toolbarHeight = 200; // Approximate height when expanded
            const toolbarWidth = 240; // From CSS min-width
            
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            let x = coordsEnd.left;
            let y = coordsEnd.bottom + 5;
            
            // Check if toolbar would go off bottom of viewport
            if (y + toolbarHeight > viewportHeight) {
              // Position above the selection instead
              y = (coordsStart?.top || coordsEnd.top) - toolbarHeight - 5;
            }
            
            // Check if toolbar would go off right edge of viewport
            if (x + toolbarWidth > viewportWidth) {
              // Position from the right edge
              x = viewportWidth - toolbarWidth - 10;
            }
            
            // Make sure it doesn't go off left edge
            if (x < 10) {
              x = 10;
            }
            
            // Make sure it doesn't go off top edge
            if (y < 10) {
              y = 10;
            }
            
            setFormatToolbar({
              show: true,
              position: { x, y },
              selection: { from: selection.from, to: selection.to }
            });
          }
        } else {
          // No selection, close toolbar
          setFormatToolbar(null);
        }
      }, 10);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close toolbar if clicking outside of it
      if (!target.closest('.text-format-toolbar')) {
        setFormatToolbar(null);
      }
    };

    // Also close toolbar when selection changes (e.g., clicking somewhere)
    const handleSelectionChange = () => {
      setTimeout(() => {
        if (!editorRef.current) return;
        
        const selection = editorRef.current.state.selection.main;
        const hasSelection = selection.from !== selection.to;
        
        if (!hasSelection) {
          setFormatToolbar(null);
        }
      }, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);


  // Handle @ key press
  const handleEditorChange = (newValue: string, viewUpdate: any) => {
    onChange(newValue);

    if (!viewUpdate.view) return;

    const cursorPos = viewUpdate.state.selection.main.head;
    const textBefore = newValue.substring(0, cursorPos);
    const lastAtIndex = textBefore.lastIndexOf('@');
    const lastHashIndex = textBefore.lastIndexOf('#');

    // Determine which trigger is more recent
    const usingAtMention = lastAtIndex > lastHashIndex;
    const triggerIndex = usingAtMention ? lastAtIndex : lastHashIndex;

    // Check if we're in an @ mention or # tag
    if (triggerIndex !== -1) {
      const textAfterTrigger = textBefore.substring(triggerIndex + 1);
      
      // Only show autocomplete if there's no space after trigger (still typing)
      if (!textAfterTrigger.includes(' ') && !textAfterTrigger.includes('\n')) {
        const query = textAfterTrigger;
        
        // For tags, require at least one character after #
        if (!usingAtMention && query.length === 0) {
          setAutocomplete(null);
          return;
        }
        
        const filteredItems = usingAtMention ? filterNotes(query) : filterTags(query);

        // Only show autocomplete if there are items to show
        if (filteredItems.length > 0) {
          // Get cursor coordinates
          const coords = viewUpdate.view.coordsAtPos(cursorPos);
          if (coords) {
            setAutocomplete({
              show: true,
              position: { x: coords.left, y: coords.bottom + 5 },
              query,
              items: filteredItems,
              selectedIndex: 0,
              startPos: triggerIndex
            });
          }
        } else {
          setAutocomplete(null);
        }
      } else {
        setAutocomplete(null);
      }
    } else {
      setAutocomplete(null);
    }
  };

  // Handle autocomplete selection
  const handleAutocompleteSelect = async (item: AutocompleteItem) => {
    if (!autocomplete || !editorRef.current) return;

    const cursorPos = editorRef.current.state.selection.main.head;
    const beforeMention = value.substring(0, autocomplete.startPos);
    const afterCursor = value.substring(cursorPos);
    
    // Handle tag selection
    if (item.type === 'tag') {
      const tag = `#${item.label}`;
      const newValue = beforeMention + tag + afterCursor;
      
      onChange(newValue);
      setAutocomplete(null);

      // Move cursor after the tag
      setTimeout(() => {
        if (editorRef.current) {
          const newPos = autocomplete.startPos + tag.length;
          const docLength = editorRef.current.state.doc.length;
          const clampedPos = Math.min(newPos, docLength);
          editorRef.current.dispatch({
            selection: { anchor: clampedPos, head: clampedPos }
          });
        }
      }, 10);
      return;
    }
    
    // Handle create note actions
    if (item.type === 'create' || item.type === 'create-and-move') {
      if (!onCreateNote) return;
      
      // Extract the note title from the label (format: 'Create "title"' or 'Create "title" and move')
      const titleMatch = item.label.match(/Create "([^"]+)"/);
      const noteTitle = titleMatch ? titleMatch[1] : autocomplete.query;
      
      const shouldOpen = item.type === 'create-and-move';
      
      try {
        // Always insert the link to the new note in the current note
        const link = `[[${noteTitle}]]`;
        const newValue = beforeMention + link + afterCursor;
        onChange(newValue);
        
        // Create the note (passing the updated content if we're moving)
        await onCreateNote(noteTitle, shouldOpen, shouldOpen ? newValue : undefined);
        
        // If not opening, move cursor after the link in current note
        if (!shouldOpen) {
          setTimeout(() => {
            if (editorRef.current) {
              const newPos = autocomplete.startPos + link.length;
              const docLength = editorRef.current.state.doc.length;
              const clampedPos = Math.min(newPos, docLength);
              editorRef.current.dispatch({
                selection: { anchor: clampedPos, head: clampedPos }
              });
            }
          }, 10);
        }
        // If opening, the MainPage will handle loading the new note
      } catch (error) {
        console.error('Failed to create note:', error);
      }
      
      setAutocomplete(null);
      return;
    }
    
    // Handle regular note link selection
    const link = `[[${item.label}]]`;
    const newValue = beforeMention + link + afterCursor;
    
    onChange(newValue);
    setAutocomplete(null);

    // Move cursor after the link
    setTimeout(() => {
      if (editorRef.current) {
        const newPos = autocomplete.startPos + link.length;
        const docLength = editorRef.current.state.doc.length;
        const clampedPos = Math.min(newPos, docLength);
        editorRef.current.dispatch({
          selection: { anchor: clampedPos, head: clampedPos }
        });
      }
    }, 10);
  };

  // Handle text formatting
  const handleFormat = (format: string) => {
    if (!formatToolbar || !editorRef.current) return;

    const { from, to } = formatToolbar.selection;
    const selectedText = value.substring(from, to);
    const beforeText = value.substring(0, from);
    const afterText = value.substring(to);

    let newText = '';
    let cursorOffset = 0;

    switch (format) {
      case 'bold':
        newText = `**${selectedText}**`;
        cursorOffset = newText.length;
        break;
      case 'italic':
        newText = `*${selectedText}*`;
        cursorOffset = newText.length;
        break;
      case 'underline':
        newText = `<u>${selectedText}</u>`;
        cursorOffset = newText.length;
        break;
      case 'highlight':
        newText = `==${selectedText}==`;
        cursorOffset = newText.length;
        break;
      case 'internal-link':
        newText = `[[${selectedText}]]`;
        cursorOffset = newText.length;
        break;
      case 'external-link':
        newText = `[${selectedText}](url)`;
        cursorOffset = newText.length - 4; // Position cursor at 'url'
        break;
      case 'bullet-list':
        newText = `- ${selectedText}`;
        cursorOffset = newText.length;
        break;
      case 'numbered-list':
        newText = `1. ${selectedText}`;
        cursorOffset = newText.length;
        break;
      case 'task-list':
        newText = `- [ ] ${selectedText}`;
        cursorOffset = newText.length;
        break;
      case 'heading':
        newText = `## ${selectedText}`;
        cursorOffset = newText.length;
        break;
      case 'quote':
        newText = `> ${selectedText}`;
        cursorOffset = newText.length;
        break;
      default:
        return;
    }

    const newValue = beforeText + newText + afterText;
    onChange(newValue);

    // Update cursor position
    setTimeout(() => {
      if (editorRef.current) {
        const newPos = from + cursorOffset;
        const docLength = editorRef.current.state.doc.length;
        const clampedPos = Math.min(newPos, docLength);
        editorRef.current.dispatch({
          selection: { anchor: clampedPos, head: clampedPos }
        });
        editorRef.current.focus();
      }
    }, 10);

    setFormatToolbar(null);
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
      borderRadius: '6px',
      padding: '2px 5px 5px 5px',
      animation: 'selectionGrow 0.15s ease-out',
    },
    '&.cm-focused .cm-selectionBackground, &.cm-focused ::selection': {
      backgroundColor: 'var(--accent-light) !important',
      borderRadius: '6px',
      padding: '2px 5px 5px 5px',
    },
    '@keyframes selectionGrow': {
      from: {
        opacity: 0.5,
        transform: 'scaleX(0.95)',
      },
      to: {
        opacity: 1,
        transform: 'scaleX(1)',
      },
    },
    '.cm-selectionMatch': {
      backgroundColor: 'var(--accent-light)',
      borderRadius: '6px',
      padding: '2px 5px 5px 5px',
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
    // Custom markdown styles
    '.custom-highlight': {
      backgroundColor: 'rgba(255, 235, 59, 0.3)',
      color: 'var(--text-primary)',
    },
    '.custom-underline': {
      textDecoration: 'underline !important',
      color: 'var(--text-primary)',
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
        extensions={[
          markdown({ base: markdownLanguage }), 
          headerLinePlugin, 
          hideMarkdownPlugin, 
          noteLinkPlugin,
          customMarkdownPlugin,
          checkboxPlugin(onChange),
          theme,
          EditorView.lineWrapping
        ]}
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
      {formatToolbar && formatToolbar.show && (
        <TextFormatToolbar
          x={formatToolbar.position.x}
          y={formatToolbar.position.y}
          onFormat={handleFormat}
          onClose={() => setFormatToolbar(null)}
        />
      )}
    </div>
  );
};

export default MarkdownEditor;
