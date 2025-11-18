import React, { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, keymap, WidgetType } from '@codemirror/view';
import { syntaxTree, syntaxHighlighting } from '@codemirror/language';
import { RangeSetBuilder, EditorState, StateField, StateEffect } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import Autocomplete, { AutocompleteItem } from './Autocomplete';
import Floater from './Floater';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import './MarkdownEditor.css';
import { tablePlugin } from './plugins/tablePlugin';
import { checkboxPlugin } from './plugins/checkboxPlugin';
import { bulletListPlugin } from './plugins/bulletListPlugin';
import { codeBlockPlugin } from './plugins/codeBlockPlugin';
import { blockquotePlugin } from './plugins/blockquotePlugin';
import { predictTextPlugin, acceptPredictionKeymap } from './plugins/predictTextPlugin';
import { getPluginSettings } from '../utils/pluginSettings';
import { aiRouter } from '../lib/ai-router';

// Debounce utility for heavy operations
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

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

// Combined plugin for headers and markdown hiding - more efficient with single syntax tree traversal
const combinedMarkdownPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: any) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    // Update on document changes, viewport changes, or cursor movement
    // We need selectionSet for showing/hiding markdown syntax based on cursor position
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  isCursorNear(view: any, nodeFrom: number, nodeTo: number): boolean {
    const cursorPos = view.state.selection.main.head;
    return cursorPos >= nodeFrom - 1 && cursorPos <= nodeTo + 1;
  }

  findFormattedRange(view: any, node: any): { from: number; to: number } | null {
    if (node.name === 'HeaderMark') {
      const line = view.state.doc.lineAt(node.from);
      return { from: node.from, to: line.to };
    }
    
    if (node.name === 'HorizontalRule') {
      return { from: node.from, to: node.to };
    }
    
    if (node.name === 'EmphasisMark') {
      let parent = node.node.parent;
      while (parent) {
        if (parent.name === 'Emphasis' || parent.name === 'StrongEmphasis') {
          return { from: parent.from, to: parent.to };
        }
        parent = parent.parent;
      }
    }
    
    if (node.name === 'CodeMark') {
      let parent = node.node.parent;
      while (parent) {
        if (parent.name === 'InlineCode') {
          return { from: parent.from, to: parent.to };
        }
        parent = parent.parent;
      }
    }
    
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
    const decorations: Array<{ from: number; to: number; decoration: Decoration }> = [];
    
    // Single syntax tree traversal for both headers and markdown hiding
    for (let { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node: any) => {
          // Handle header line decorations
          if (node.name === 'ATXHeading1' || node.name === 'ATXHeading2' || 
              node.name === 'ATXHeading3' || node.name === 'ATXHeading4' || 
              node.name === 'ATXHeading5' || node.name === 'ATXHeading6') {
            
            const line = view.state.doc.lineAt(node.from);
            const level = node.name.charAt(node.name.length - 1);
            
            decorations.push({
              from: line.from,
              to: line.from,
              decoration: Decoration.line({ class: `header-line-${level}` })
            });
          }
          
          // Handle horizontal rules (---, ***, ___)
          if (node.name === 'HorizontalRule') {
            // Check if cursor is within the horizontal rule range (not just on the line)
            const cursorInHR = cursorPos >= node.from && cursorPos <= node.to;
            
            if (!cursorInHR) {
              // Replace the --- with a visual horizontal line only when cursor is NOT in the range
              decorations.push({
                from: node.from,
                to: node.to,
                decoration: Decoration.replace({
                  widget: new class extends WidgetType {
                    toDOM() {
                      const hr = document.createElement('div');
                      hr.className = 'cm-hr';
                      hr.style.cssText = 'display: block; width: 100%; height: 1px; background: linear-gradient(to right, transparent, var(--border) 10%, var(--border) 90%, transparent); margin: 0; padding: 0; border: none; opacity: 0.6; line-height: 1px;';
                      return hr;
                    }
                    
                    eq(other: any) { return true; }
                    
                    ignoreEvent() { return false; }
                  }()
                })
              });
            }
            // When cursor is in the range, show the actual text (no decoration needed)
            return; // Skip further processing for horizontal rules
          }
          
          // Handle markdown syntax hiding
          const formattedRange = this.findFormattedRange(view, node);
          
          if (formattedRange) {
            const cursorInRange = cursorPos >= formattedRange.from && cursorPos <= formattedRange.to;
            
            if (!cursorInRange) {
              if (node.name === 'HeaderMark') {
                const docLength = view.state.doc.length;
                const charAfterMark = node.to < docLength ? view.state.doc.sliceString(node.to, node.to + 1) : '';
                const endPos = charAfterMark === ' ' ? Math.min(node.to + 1, docLength) : node.to;
                
                decorations.push({
                  from: node.from,
                  to: endPos,
                  decoration: Decoration.replace({})
                });
              } else if (node.name === 'EmphasisMark') {
                decorations.push({
                  from: node.from,
                  to: node.to,
                  decoration: Decoration.replace({})
                });
              } else if (node.name === 'LinkMark' || node.name === 'URL') {
                const text = view.state.doc.sliceString(node.from, node.to);
                if (text === '[' || text === ']' || text === '(' || text === ')') {
                  decorations.push({
                    from: node.from,
                    to: node.to,
                    decoration: Decoration.replace({})
                  });
                }
              } else if (node.name === 'CodeMark') {
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
    
    // Sort and add all decorations
    decorations.sort((a, b) => a.from - b.from);
    for (const { from, to, decoration } of decorations) {
      builder.add(from, to, decoration);
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});

// Optimized plugin for regex-based decorations (tags and note links) with debouncing
const regexDecorationsPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  pendingUpdate: any = null;
  debounceTimeout: NodeJS.Timeout | null = null;

  constructor(view: any) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    // For viewport changes, update immediately
    if (update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
      return;
    }
    
    // Only update on document changes, skip selection-only changes
    if (update.docChanged) {
      // Clear existing timeout
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
      
      // Set new timeout for debounced update (200ms for typing comfort)
      this.debounceTimeout = setTimeout(() => {
        this.decorations = this.buildDecorations(update.view);
        update.view.dispatch({});
      }, 200);
    }
  }

  destroy() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
  }

  buildDecorations(view: any) {
    const builder = new RangeSetBuilder<Decoration>();
    const cursorPos = view.state.selection.main.head;
    const decorations: Array<{ from: number; to: number; decoration: Decoration }> = [];
    
    // Only process visible ranges for better performance
    for (let { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      const offset = from;
      
      // Find all tags (#tagname - # without space after it, supports dots for hierarchy)
      const tagRegex = /#([a-zA-Z0-9_.-]+)(?=\s|$)/g;
      let tagMatch;
      
      while ((tagMatch = tagRegex.exec(text)) !== null) {
        const tagFrom = offset + tagMatch.index;
        const tagTo = offset + tagMatch.index + tagMatch[0].length;
        
        // Check if this is NOT a header (header would have space after #)
        const charBefore = tagMatch.index > 0 ? text[tagMatch.index - 1] : '\n';
        const isAtLineStart = charBefore === '\n' || tagMatch.index === 0;
        
        // If it's at line start, check if there's a space after the #
        if (isAtLineStart) {
          const charAfterHash = text[tagMatch.index + 1];
          if (charAfterHash && charAfterHash !== ' ') {
            // This is a tag, not a header
            decorations.push({
              from: tagFrom,
              to: tagTo,
              decoration: Decoration.mark({ class: 'cm-tag' })
            });
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
        const linkFrom = offset + match.index;
        const linkTo = offset + match.index + match[0].length;
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

// Optimized plugin for note link styling (immediate, lightweight)
const noteLinkStylingPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: any) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    // Only update on doc or viewport changes
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: any) {
    const builder = new RangeSetBuilder<Decoration>();
    
    // Only process visible ranges
    for (let { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      const offset = from;
      
      // Find all [[note]] patterns
      const linkRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      
      while ((match = linkRegex.exec(text)) !== null) {
        const matchFrom = offset + match.index;
        const matchTo = offset + match.index + match[0].length;
        
        // Add decoration to make it look like a link
        builder.add(
          matchFrom,
          matchTo,
          Decoration.mark({
            class: 'note-link',
            attributes: {
              'data-note-name': match[1]
            }
          })
        );
      }
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});

// Optimized plugin for custom markdown (highlight and underline) with debouncing
const customMarkdownPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  debounceTimeout: NodeJS.Timeout | null = null;

  constructor(view: any) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    // For viewport changes, update immediately
    if (update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
      return;
    }
    
    // Only update on document changes, skip selection-only changes
    if (update.docChanged) {
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
      
      this.debounceTimeout = setTimeout(() => {
        this.decorations = this.buildDecorations(update.view);
        update.view.dispatch({});
      }, 200);
    }
  }

  destroy() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
  }

  buildDecorations(view: any) {
    const builder = new RangeSetBuilder<Decoration>();
    const cursorPos = view.state.selection.main.head;
    const decorations: Array<{ from: number; to: number; decoration: Decoration }> = [];
    
    // Only process visible ranges
    for (let { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      const offset = from;
      
      // Find all ==highlight== patterns
      const highlightRegex = /==([^=]+)==/g;
      let match;
      
      while ((match = highlightRegex.exec(text)) !== null) {
        const matchFrom = offset + match.index;
        const matchTo = offset + match.index + match[0].length;
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
        const matchFrom = offset + match.index;
        const matchTo = offset + match.index + match[0].length;
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

const MarkdownEditor = forwardRef<any, MarkdownEditorProps>(({ 
  value, 
  onChange, 
  placeholder, 
  notes = [],
  onNoteLink,
  currentNotePath,
  onCreateNote,
  workspaceTags = []
}, ref) => {
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
    selectedText: string;
    autoFocusAI?: boolean;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    position: { x: number; y: number };
    items: ContextMenuItem[];
  } | null>(null);
  
  const editorRef = useRef<any>(null);
  const autocompleteRef = useRef(autocomplete);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isOpeningFloaterRef = useRef(false); // Track when we're opening floater with empty selection

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }
  }));

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
    // Function to show floater (used by both mouse and keyboard)
    const showFloater = () => {
      if (!editorRef.current || !wrapperRef.current) return false;

      const selection = editorRef.current.state.selection.main;
      let hasSelection = selection.from !== selection.to;
      let selectedText = '';
      let selectionRange = { from: selection.from, to: selection.to };

      // If no selection, select the current word or line
      if (!hasSelection) {
        const pos = selection.head;
        const line = editorRef.current.state.doc.lineAt(pos);
        const lineText = line.text;
        
        // Try to find word boundaries
        let wordStart = pos - line.from;
        let wordEnd = pos - line.from;
        
        // Find word start
        while (wordStart > 0 && /\S/.test(lineText[wordStart - 1])) {
          wordStart--;
        }
        
        // Find word end
        while (wordEnd < lineText.length && /\S/.test(lineText[wordEnd])) {
          wordEnd++;
        }
        
        const absoluteStart = line.from + wordStart;
        const absoluteEnd = line.from + wordEnd;
        
        // If we found a word, select it
        if (absoluteEnd > absoluteStart) {
          selectionRange = { from: absoluteStart, to: absoluteEnd };
          selectedText = editorRef.current.state.doc.sliceString(absoluteStart, absoluteEnd);
          hasSelection = true;
          
          // Update the editor selection
          editorRef.current.dispatch({
            selection: { anchor: absoluteStart, head: absoluteEnd }
          });
        } else if (lineText.trim()) {
          // No word found but line has text, select the whole line
          selectionRange = { from: line.from, to: line.to };
          selectedText = lineText;
          hasSelection = true;
          
          // Update the editor selection
          editorRef.current.dispatch({
            selection: { anchor: line.from, head: line.to }
          });
        } else {
          // Empty line - still show floater but with empty selection
          // Use cursor position as both from and to
          selectionRange = { from: pos, to: pos };
          selectedText = ''; // Empty text for AI to work with
          hasSelection = true; // Still show the floater
        }
      } else {
        selectedText = editorRef.current.state.doc.sliceString(selection.from, selection.to);
      }

      if (hasSelection) {
        wrapperRef.current.classList.add('selection-locked');
        
        const toolbarHeight = 200;
        const toolbarWidth = 260;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Get cursor position and position floater next to it
        const cursorPos = editorRef.current.state.selection.main.head;
        const coords = editorRef.current.coordsAtPos(cursorPos);
        
        let x: number;
        let y: number;
        
        if (coords) {
          // Position floater to the right of cursor
          x = coords.left + 10;
          y = coords.top;
          
          // Check if toolbar would go off right edge of viewport
          if (x + toolbarWidth > viewportWidth) {
            // Position to the left of cursor instead
            x = coords.left - toolbarWidth - 10;
          }
          
          // Check if toolbar would go off bottom of viewport
          if (y + toolbarHeight > viewportHeight) {
            y = viewportHeight - toolbarHeight - 10;
          }
          
          // Make sure it doesn't go off left edge
          if (x < 10) {
            x = 10;
          }
          
          // Make sure it doesn't go off top edge
          if (y < 10) {
            y = 10;
          }
        } else {
          // Fallback to center if coords unavailable
          x = (viewportWidth - toolbarWidth) / 2;
          y = (viewportHeight - toolbarHeight) / 2;
        }
        
        setFormatToolbar({
          show: true,
          position: { x, y },
          selection: selectionRange,
          selectedText,
          autoFocusAI: true
        });
        
        // Set flag to prevent handleSelectionChange from closing the floater immediately
        if (selectedText === '') {
          isOpeningFloaterRef.current = true;
          setTimeout(() => {
            isOpeningFloaterRef.current = false;
          }, 100); // Clear flag after 100ms
        }
        
        // Blur the editor to prevent typing in it
        if (editorRef.current) {
          editorRef.current.contentDOM.blur();
        }
        
        return true;
      }
      return false;
    };

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
          // Add class to trigger grow animation
          wrapperRef.current.classList.add('selection-locked');
          
          // Get the coordinates of the selection start and end
          const coordsStart = editorRef.current.coordsAtPos(selection.from);
          const coordsEnd = editorRef.current.coordsAtPos(selection.to);
          
          if (coordsEnd) {
            // Approximate toolbar dimensions (will be adjusted by component)
            const toolbarHeight = 200; // Approximate height when expanded
            const toolbarWidth = 260; // From CSS min-width
            
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            // Center the floater below the selection
            const selectionWidth = coordsEnd.left - (coordsStart?.left || coordsEnd.left);
            const selectionCenter = (coordsStart?.left || coordsEnd.left) + selectionWidth / 2;
            let x = selectionCenter - toolbarWidth / 2;
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
            
            // Get the selected text
            const selectedText = editorRef.current.state.doc.sliceString(selection.from, selection.to);
            
            setFormatToolbar({
              show: true,
              position: { x, y },
              selection: { from: selection.from, to: selection.to },
              selectedText
            });
          }
        } else {
          // No selection, close toolbar and remove locked class
          setFormatToolbar(null);
          if (wrapperRef.current) {
            wrapperRef.current.classList.remove('selection-locked');
          }
        }
      }, 10);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close toolbar if clicking outside of it
      if (!target.closest('.floater')) {
        setFormatToolbar(null);
        if (wrapperRef.current) {
          wrapperRef.current.classList.remove('selection-locked');
        }
      }
    };

    // Show floater when text is selected with keyboard
    const handleKeyUp = (e: KeyboardEvent) => {
      // Trigger on Shift+Arrow keys (selection keys) or Ctrl+A (select all)
      const isSelectAll = (e.ctrlKey || e.metaKey) && e.key === 'a';
      const isShiftArrow = e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      
      if (!isSelectAll && !isShiftArrow) {
        return;
      }

      setTimeout(() => {
        if (!editorRef.current || !wrapperRef.current) return;

        const selection = editorRef.current.state.selection.main;
        const hasSelection = selection.from !== selection.to;

        if (hasSelection) {
          // Add class to trigger grow animation
          wrapperRef.current.classList.add('selection-locked');
          
          // Approximate toolbar dimensions
          const toolbarHeight = 200;
          const toolbarWidth = 260;
          
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          
          let x: number;
          let y: number;
          
          if (isSelectAll) {
            // Center the floater in the viewport for Ctrl+A
            x = (viewportWidth - toolbarWidth) / 2;
            y = (viewportHeight - toolbarHeight) / 2;
          } else {
            // Position relative to selection for Shift+Arrow
            const coordsStart = editorRef.current.coordsAtPos(selection.from);
            const coordsEnd = editorRef.current.coordsAtPos(selection.to);
            
            if (coordsEnd) {
              // Center the floater below the selection
              const selectionWidth = coordsEnd.left - (coordsStart?.left || coordsEnd.left);
              const selectionCenter = (coordsStart?.left || coordsEnd.left) + selectionWidth / 2;
              x = selectionCenter - toolbarWidth / 2;
              y = coordsEnd.bottom + 5;
              
              // Check if toolbar would go off bottom of viewport
              if (y + toolbarHeight > viewportHeight) {
                y = (coordsStart?.top || coordsEnd.top) - toolbarHeight - 5;
              }
              
              // Check if toolbar would go off right edge of viewport
              if (x + toolbarWidth > viewportWidth) {
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
            } else {
              // Fallback to center if coords unavailable
              x = (viewportWidth - toolbarWidth) / 2;
              y = (viewportHeight - toolbarHeight) / 2;
            }
          }
          
          // Get the selected text
          const selectedText = editorRef.current.state.doc.sliceString(selection.from, selection.to);
          
          setFormatToolbar({
            show: true,
            position: { x, y },
            selection: { from: selection.from, to: selection.to },
            selectedText
          });
        }
      }, 10);
    };

    // Open floater with Ctrl+Space
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Space or Cmd+Space
      // Some systems report space as "Unidentified" when combined with Ctrl
      const isSpace = e.key === ' ' || (e.key === 'Unidentified' && e.code === 'Space');
      
      if ((e.ctrlKey || e.metaKey) && isSpace) {
        e.preventDefault(); // Prevent default browser behavior
        e.stopPropagation(); // Stop event from bubbling
        showFloater();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle custom context menu
  useEffect(() => {
    const cleanup = window.electronAPI.onOpenCustomContextMenu((event, data) => {
      const { x, y, misspelledWord, dictionarySuggestions } = data;
      
      const items: ContextMenuItem[] = [];
      
      if (misspelledWord && dictionarySuggestions.length > 0) {
        dictionarySuggestions.forEach((suggestion: string) => {
          items.push({
            label: `Correct to "${suggestion}"`,
            action: () => window.electronAPI.replaceMisspelling(suggestion),
          });
        });
        items.push({ type: 'divider' });
      }
      
      items.push({ label: 'Cut', action: () => document.execCommand('cut') });
      items.push({ label: 'Copy', action: () => document.execCommand('copy') });
      items.push({ label: 'Paste', action: () => document.execCommand('paste') });
      
      setContextMenu({ show: true, position: { x, y }, items });
    });
    
    return cleanup;
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

  // Handle AI actions
  const handleAIAction = async (prompt: string, selectedText: string) => {
    if (!editorRef.current || !selectedText) return;

    try {
      // Check if AI is configured
      const status = await aiRouter.getConnectionStatus();
      if (!status.connected || status.provider === 'none') {
        console.error('AI is not configured or connected');
        alert('Please configure an AI provider in Settings before using AI features.');
        return;
      }

      // Get the current selection range
      const selection = editorRef.current.state.selection.main;
      const from = selection.from;
      const to = selection.to;

      // Build the AI request
      const systemPrompt = `You are a helpful writing assistant. The user has selected some text and wants you to transform it based on their request. Only return the transformed text without any explanations, quotes, or additional commentary.`;
      
      const userPrompt = `${prompt}\n\nText to transform:\n${selectedText}`;

      // Show loading indicator (you can enhance this with a better UI later)
      console.log('Processing AI request...');

      // Call AI router
      const response = await aiRouter.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        options: {
          temperature: 0.7,
          maxTokens: 500,
          topP: 0.9,
        }
      });

      // Get the transformed text
      let transformedText = response.content.trim();

      // Clean up common AI response artifacts
      transformedText = transformedText.replace(/^["']|["']$/g, ''); // Remove quotes
      transformedText = transformedText.replace(/^```[\w]*\n?|```$/g, ''); // Remove code blocks

      // Replace the selected text with the AI response
      editorRef.current.dispatch({
        changes: {
          from: from,
          to: to,
          insert: transformedText
        },
        selection: {
          anchor: from + transformedText.length,
          head: from + transformedText.length
        }
      });

      console.log('AI transformation completed');

    } catch (error) {
      console.error('AI action failed:', error);
      alert(`AI action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  // Handle AI replace from preview
  const handleAIReplace = (transformedText: string) => {
    if (!editorRef.current || !formatToolbar) return;

    try {
      // Get the current selection range
      const selection = editorRef.current.state.selection.main;
      const from = selection.from;
      const to = selection.to;

      // Replace the selected text with the transformed text
      editorRef.current.dispatch({
        changes: {
          from: from,
          to: to,
          insert: transformedText
        },
        selection: {
          anchor: from + transformedText.length,
          head: from + transformedText.length
        }
      });

      console.log('AI transformation replaced selection');

    } catch (error) {
      console.error('Failed to replace with AI transformation:', error);
    }
  };

  // Handle AI add after from preview
  const handleAIAddAfter = (transformedText: string) => {
    if (!editorRef.current || !formatToolbar) return;

    try {
      // Get the current selection range
      const selection = editorRef.current.state.selection.main;
      const to = selection.to;

      // Add the transformed text after the selection with a newline
      const textToInsert = '\n' + transformedText;
      
      editorRef.current.dispatch({
        changes: {
          from: to,
          to: to,
          insert: textToInsert
        },
        selection: {
          anchor: to + textToInsert.length,
          head: to + textToInsert.length
        }
      });

      console.log('AI transformation added after selection');

    } catch (error) {
      console.error('Failed to add AI transformation:', error);
    }
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
    // Override horizontal rule colors in all states
    '.cm-hr, .cm-hr-mark, .cm-horizontal-rule, .cm-horizontalRule': {
      color: 'var(--text-primary) !important',
    },
    // Target the actual markdown horizontal rule token
    '.cm-meta, .cm-meta.cm-hr': {
      color: 'var(--text-primary) !important',
    },
    '.cm-quote': {
      color: 'var(--text-secondary)',
      fontStyle: 'italic',
      borderLeft: '3px solid var(--border)',
      paddingLeft: '10px',
    },
    // Horizontal rule styling
    '.cm-hr': {
      display: 'block',
      width: '100%',
      height: '1px',
      background: 'linear-gradient(to right, transparent, var(--border) 10%, var(--border) 90%, transparent)',
      margin: '0',
      padding: '0',
      border: 'none',
      opacity: 0.6,
      lineHeight: '1px',
    },
    '.hr-text-editing': {
      color: 'var(--text-primary) !important',
      opacity: 0.7,
      fontStyle: 'italic',
    },
    // Override nested spans inside horizontal rule editing
    '.hr-text-editing span': {
      color: 'var(--text-primary) !important',
    },
    // Override CodeMirror's default horizontal rule color
    '.cm-hr-mark': {
      color: 'var(--text-primary) !important',
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

  // Get plugin settings
  const pluginSettings = useMemo(() => getPluginSettings(), []);

  // Build extensions array based on settings
  const extensions = useMemo(() => {
    const exts = [
      markdown({ base: markdownLanguage}),
      theme,
      EditorView.lineWrapping,
    ];

    if (pluginSettings.combinedMarkdownPlugin) {
      exts.push(combinedMarkdownPlugin);
    }
    if (pluginSettings.regexDecorationsPlugin) {
      exts.push(regexDecorationsPlugin);
    }
    if (pluginSettings.noteLinkStylingPlugin) {
      exts.push(noteLinkStylingPlugin);
    }
    if (pluginSettings.customMarkdownPlugin) {
      exts.push(customMarkdownPlugin);
    }
    if (pluginSettings.tablePlugin) {
      exts.push(tablePlugin);
    }
    if (pluginSettings.checkboxPlugin) {
      exts.push(checkboxPlugin(onChange));
    }
    if (pluginSettings.bulletListPlugin) {
      exts.push(bulletListPlugin);
    }
    if (pluginSettings.codeBlockPlugin) {
      exts.push(codeBlockPlugin);
    }
    if (pluginSettings.blockquotePlugin) {
      exts.push(blockquotePlugin);
    }
    if (pluginSettings.predictTextPlugin) {
      exts.push(predictTextPlugin, acceptPredictionKeymap);
    }
    if (pluginSettings.spellCheck) {
      exts.push(EditorView.contentAttributes.of({ spellcheck: 'true' }));
    }

    return exts;
  }, [pluginSettings, onChange]);

  return (
    <div ref={wrapperRef} className="codemirror-wrapper">
      <CodeMirror
        ref={(editor: any) => {
          if (editor?.view) {
            editorRef.current = editor.view;
          }
        }}
        value={value}
        height="auto"
        extensions={extensions}
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
        <Floater
          x={formatToolbar.position.x}
          y={formatToolbar.position.y}
          selectedText={formatToolbar.selectedText}
          onFormat={handleFormat}
          onAIAction={handleAIAction}
          onAIReplace={handleAIReplace}
          onAIAddAfter={handleAIAddAfter}
          onClose={() => setFormatToolbar(null)}
          autoFocusAI={formatToolbar.autoFocusAI}
          onRefocusEditor={() => {
            if (editorRef.current) {
              editorRef.current.focus();
            }
          }}
        />
      )}
      {contextMenu && contextMenu.show && (
        <ContextMenu
          x={contextMenu.position.x}
          y={contextMenu.position.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
});

export default MarkdownEditor;
