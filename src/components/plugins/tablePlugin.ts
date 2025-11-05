import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Plugin to render markdown tables as actual HTML tables
export const tablePlugin = ViewPlugin.fromClass(class {
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
    
    // Find table blocks (lines starting with |)
    const lines = text.split('\n');
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Check if this is a table line (starts with |)
      if (line.trim().startsWith('|')) {
        const tableStart = i;
        let tableEnd = i;
        
        // Find the end of the table
        while (tableEnd < lines.length && lines[tableEnd].trim().startsWith('|')) {
          tableEnd++;
        }
        
        // Get the table lines
        const tableLines = lines.slice(tableStart, tableEnd);
        
        if (tableLines.length >= 3) { // Must have at least header, separator, and one data row
          // Calculate positions
          const startPos = lines.slice(0, tableStart).join('\n').length + (tableStart > 0 ? 1 : 0);
          const endPos = lines.slice(0, tableEnd).join('\n').length;
          
          // Check if cursor is in this table
          const cursorInTable = cursorPos >= startPos && cursorPos <= endPos;
          
          if (!cursorInTable) {
            // Parse the table
            const headerLine = tableLines[0];
            const headers = headerLine.split('|').map((h: string) => h.trim()).filter((h: string) => h);
            
            const dataLines = tableLines.slice(2); // Skip header and separator
            const rows = dataLines.map((line: string) => 
              line.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell)
            );
            
            // Create a single replacement widget for the entire table
            class TableWidget extends WidgetType {
              toDOM() {
                const table = document.createElement('table');
                table.className = 'cm-markdown-table';
                table.style.cssText = 'display: table; border-collapse: collapse; width: 100%; margin: 4px 0; background: var(--bg-secondary); border-radius: 4px; overflow: hidden; border: 1px solid var(--border);';
                
                // Create header
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                headers.forEach((header: string) => {
                  const th = document.createElement('th');
                  th.textContent = header;
                  th.style.cssText = 'padding: 6px 10px; text-align: left; background: var(--bg-tertiary); color: var(--text-primary); font-weight: 600; border-bottom: 2px solid var(--border);';
                  headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);
                
                // Create body
                const tbody = document.createElement('tbody');
                rows.forEach((row: string[], rowIndex: number) => {
                  const tr = document.createElement('tr');
                  tr.style.cssText = rowIndex % 2 === 0 ? 'background: var(--bg-secondary);' : 'background: var(--bg-primary);';
                  
                  row.forEach((cell: string) => {
                    const td = document.createElement('td');
                    td.textContent = cell;
                    td.style.cssText = 'padding: 4px 10px; color: var(--text-primary); border-bottom: 1px solid var(--border);';
                    tr.appendChild(td);
                  });
                  
                  tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                
                return table;
              }
              
              eq(other: any) { return false; }
              
              ignoreEvent() { return false; }
            }
            
            // Add the widget at the start of the first line
            builder.add(startPos, startPos, Decoration.widget({
              widget: new TableWidget(),
              side: -1
            }));
            
            // Instead of replacing, use mark decorations to hide the text
            let linePos = startPos;
            for (let lineIdx = 0; lineIdx < tableLines.length; lineIdx++) {
              const lineText = tableLines[lineIdx];
              const lineContentEnd = linePos + lineText.length;
              
              // Mark the line to make it invisible using CSS
              if (lineContentEnd > linePos) {
                builder.add(linePos, lineContentEnd, Decoration.mark({
                  class: 'cm-hidden-table-line',
                  attributes: {
                    style: 'display: none;'
                  }
                }));
              }
              
              // Move to next line (skip the newline character)
              linePos = lineContentEnd + 1;
            }
          }
        }
        
        i = tableEnd;
      } else {
        i++;
      }
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});
