import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Plugin to replace * with bullet points in lists
export const bulletListPlugin = ViewPlugin.fromClass(class {
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
      
      // Match bullet list items: * at start of line
      const bulletRegex = /^(\s*)\*\s/gm;
      let match: RegExpExecArray | null;
      
      while ((match = bulletRegex.exec(text)) !== null) {
        const matchResult = match;
        const absoluteIndex = from + matchResult.index;
        const bulletStart = absoluteIndex + matchResult[1].length; // After leading spaces
        const bulletEnd = bulletStart + 1; // Just the *
        
        // Check if cursor is near the bullet
        const cursorNear = this.isCursorNear(view, bulletStart, bulletEnd);
        
        if (!cursorNear) {
          // Replace * with bullet point
          builder.add(bulletStart, bulletEnd, Decoration.replace({
            widget: new class extends WidgetType {
              toDOM() {
                const span = document.createElement('span');
                span.textContent = '•';
                span.style.cssText = 'color: var(--text-secondary);';
                return span;
              }
            }()
          }));
        }
      }
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});
