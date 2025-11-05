import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Plugin to style blockquotes
export const blockquotePlugin = ViewPlugin.fromClass(class {
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
    const text = view.state.doc.toString();
    const lines = text.split('\n');
    let pos = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStart = pos;
      const lineEnd = pos + line.length;

      // Match blockquote lines starting with >
      if (line.match(/^>\s/)) {
        const cursorNear = this.isCursorNear(view, lineStart, lineEnd);

        if (!cursorNear) {
          // Hide the > marker
          const markerEnd = lineStart + line.indexOf('>') + 1;
          const spaceEnd = line.match(/^>\s+/) ? lineStart + line.match(/^>\s+/)![0].length : markerEnd + 1;
          
          builder.add(lineStart, spaceEnd, Decoration.mark({
            attributes: { style: 'display: none;' }
          }));

          // Add styled decoration for the blockquote content
          builder.add(spaceEnd, lineEnd, Decoration.mark({
            class: 'cm-blockquote-content',
            attributes: {
              style: 'display: block; padding-left: 16px; border-left: 4px solid var(--accent); color: var(--text-secondary); font-style: italic; margin-left: -16px;'
            }
          }));
        }
      }

      pos = lineEnd + 1; // +1 for newline
    }

    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});
