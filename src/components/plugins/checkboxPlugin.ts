import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Optimized plugin for interactive checkboxes - only processes visible range
export const checkboxPlugin = (onChangeCallback: (newValue: string) => void) => ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: any) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  isCursorNear(view: any, from: number, to: number): boolean {
    const cursorPos = view.state.selection.main.head;
    return cursorPos >= from && cursorPos <= to;
  }

  buildDecorations(view: any) {
    const builder = new RangeSetBuilder<Decoration>();
    
    // Only process visible ranges for better performance
    for (let { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      
      // Match task list items: - [ ] or - [x] or * [ ] or * [x]
      const checkboxRegex = /^(\s*)[-*]\s\[([ xX])\]\s/gm;
      let match: RegExpExecArray | null;
      
      while ((match = checkboxRegex.exec(text)) !== null) {
        const matchResult = match;
        const absoluteIndex = from + matchResult.index;
        const checkboxStart = absoluteIndex + matchResult[1].length; // After leading spaces
        const checkboxEnd = checkboxStart + matchResult[0].length - matchResult[1].length;
        const isChecked = matchResult[2].toLowerCase() === 'x';
        
        // Check if cursor is near the checkbox (but not including the position right after the space)
        // So cursor at "- [ ] |" will show the checkbox, but at "- [ ]|" will show formatting
        const cursorNear = this.isCursorNear(view, checkboxStart, checkboxEnd - 1);
        
        if (!cursorNear) {
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
                      from: absoluteIndex,
                      to: absoluteIndex + matchResult[0].length,
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
          builder.add(checkboxStart, checkboxStart, checkbox);
          builder.add(checkboxStart, checkboxEnd, Decoration.replace({}));
        }
      }
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});
