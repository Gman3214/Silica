import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, EditorState } from '@codemirror/state';
import { syntaxTree, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { tags as t } from '@lezer/highlight';

// Helper function to get language parser
function getLanguageSupport(lang: string) {
  const langMap: { [key: string]: any } = {
    'javascript': javascript(),
    'js': javascript(),
    'jsx': javascript({ jsx: true }),
    'typescript': javascript({ typescript: true }),
    'ts': javascript({ typescript: true }),
    'tsx': javascript({ typescript: true, jsx: true }),
    'python': python(),
    'py': python(),
    'java': java(),
    'cpp': cpp(),
    'c++': cpp(),
    'c': cpp(),
    'css': css(),
    'html': html(),
    'json': json(),
    'sql': sql(),
  };
  return langMap[lang.toLowerCase()] || null;
}

// Helper function to highlight code with syntax
function highlightCode(code: string, language: string): HTMLElement {
  const langSupport = getLanguageSupport(language);
  
  if (!langSupport) {
    // No syntax highlighting available, return plain code
    const codeElement = document.createElement('code');
    codeElement.textContent = code;
    codeElement.style.cssText = 'color: var(--text-primary);';
    return codeElement;
  }
  
  // Create a temporary CodeMirror state to parse the code
  const state = EditorState.create({
    doc: code,
    extensions: [langSupport]
  });
  
  const tree = syntaxTree(state);
  const codeElement = document.createElement('code');
  
  // Style map for syntax tokens
  const styleMap: { [key: string]: string } = {
    'keyword': 'color: var(--syntax-keyword, #c678dd);',
    'string': 'color: var(--syntax-string, #98c379);',
    'comment': 'color: var(--syntax-comment, #5c6370); font-style: italic;',
    'number': 'color: var(--syntax-number, #d19a66);',
    'function': 'color: var(--syntax-function, #61afef);',
    'variable': 'color: var(--syntax-variable, #e06c75);',
    'operator': 'color: var(--syntax-operator, #56b6c2);',
    'property': 'color: var(--syntax-property, #e5c07b);',
    'type': 'color: var(--syntax-type, #e5c07b);',
  };
  
  // Collect all leaf nodes (tokens) with their styles
  const tokens: Array<{ from: number, to: number, style: string }> = [];
  
  tree.iterate({
    enter: (node) => {
      // Only process leaf nodes (actual tokens, not parent nodes)
      if (node.node.firstChild === null) {
        const nodeName = node.name.toLowerCase();
        let style = 'color: var(--text-primary);';
        
        if (nodeName.includes('keyword')) {
          style = styleMap['keyword'];
        } else if (nodeName.includes('string')) {
          style = styleMap['string'];
        } else if (nodeName.includes('comment')) {
          style = styleMap['comment'];
        } else if (nodeName.includes('number') || nodeName.includes('integer') || nodeName.includes('float')) {
          style = styleMap['number'];
        } else if (nodeName.includes('function') || nodeName.includes('definition')) {
          style = styleMap['function'];
        } else if (nodeName.includes('variable')) {
          style = styleMap['variable'];
        } else if (nodeName.includes('operator')) {
          style = styleMap['operator'];
        } else if (nodeName.includes('property')) {
          style = styleMap['property'];
        } else if (nodeName.includes('type')) {
          style = styleMap['type'];
        }
        
        tokens.push({ from: node.from, to: node.to, style });
      }
    }
  });
  
  // Build the highlighted code from tokens
  let lastIndex = 0;
  for (const token of tokens) {
    // Add any text between tokens
    if (token.from > lastIndex) {
      const textNode = document.createTextNode(code.slice(lastIndex, token.from));
      codeElement.appendChild(textNode);
    }
    
    // Add the styled token
    const span = document.createElement('span');
    span.textContent = code.slice(token.from, token.to);
    span.style.cssText = token.style;
    codeElement.appendChild(span);
    
    lastIndex = token.to;
  }
  
  // Add any remaining text
  if (lastIndex < code.length) {
    codeElement.appendChild(document.createTextNode(code.slice(lastIndex)));
  }
  
  return codeElement;
}

// Plugin to style code blocks with language header
export const codeBlockPlugin = ViewPlugin.fromClass(class {
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
    
    // Match code blocks: ```language\ncode\n```
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;
    let match: RegExpExecArray | null;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const matchResult = match;
      const blockStart = matchResult.index;
      const blockEnd = blockStart + matchResult[0].length;
      const language = matchResult[1] || 'plaintext';
      const code = matchResult[2];
      
      // Check if cursor is in this code block
      const cursorInBlock = cursorPos >= blockStart && cursorPos <= blockEnd;
      
      if (!cursorInBlock) {
        // Hide the entire code block and replace with widget
        const doc = view.state.doc;
        const startLine = doc.lineAt(blockStart);
        const endLine = doc.lineAt(blockEnd);
        
        // First, add the widget at the very start (BEFORE hiding anything)
        builder.add(startLine.from, startLine.from, Decoration.widget({
          widget: new class extends WidgetType {
            toDOM(view: any) {
              const container = document.createElement('div');
              container.className = 'cm-code-block-container';
              container.style.cssText = 'margin: 8px 0; cursor: pointer; max-width: 100%; overflow: hidden;';
              
              // Click handler to enter edit mode
              container.addEventListener('click', () => {
                // Position cursor inside the code content (after the opening ```language\n)
                const codeStartPos = blockStart + 3 + language.length + 1;
                view.dispatch({
                  selection: { anchor: codeStartPos, head: codeStartPos }
                });
                view.focus();
              });
              
              // Language header
              const header = document.createElement('div');
              header.className = 'cm-code-block-header';
              header.style.cssText = 'background: var(--bg-tertiary); border-radius: 6px 6px 0 0; padding: 8px 12px; border: 1px solid var(--border); border-bottom: none; display: flex; justify-content: space-between; align-items: center;';
              
              const label = document.createElement('span');
              label.textContent = language;
              label.style.cssText = 'color: var(--text-secondary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;';
              header.appendChild(label);
              
              // Button group
              const buttonGroup = document.createElement('div');
              buttonGroup.style.cssText = 'display: flex; gap: 8px; align-items: center;';
              
              // Run code button
              const runBtn = document.createElement('button');
              runBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              `;
              runBtn.title = 'Run Code';
              runBtn.style.cssText = 'background: transparent; border: 1px solid var(--border); color: var(--text-secondary); padding: 4px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;';
              runBtn.addEventListener('mouseenter', () => {
                runBtn.style.backgroundColor = 'var(--bg-hover)';
                runBtn.style.color = 'var(--accent)';
              });
              runBtn.addEventListener('mouseleave', () => {
                runBtn.style.backgroundColor = 'transparent';
                runBtn.style.color = 'var(--text-secondary)';
              });
              runBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // TODO: Implement run code functionality
                console.log('Run code:', language, code);
              });
              buttonGroup.appendChild(runBtn);
              
              // Open in VS Code button
              const vscodeBtn = document.createElement('button');
              vscodeBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              `;
              vscodeBtn.title = 'Open in VS Code';
              vscodeBtn.style.cssText = 'background: transparent; border: 1px solid var(--border); color: var(--text-secondary); padding: 4px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;';
              vscodeBtn.addEventListener('mouseenter', () => {
                vscodeBtn.style.backgroundColor = 'var(--bg-hover)';
                vscodeBtn.style.color = 'var(--accent)';
              });
              vscodeBtn.addEventListener('mouseleave', () => {
                vscodeBtn.style.backgroundColor = 'transparent';
                vscodeBtn.style.color = 'var(--text-secondary)';
              });
              vscodeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // TODO: Implement open in VS Code functionality
                console.log('Open in VS Code:', language, code);
              });
              buttonGroup.appendChild(vscodeBtn);
              
              header.appendChild(buttonGroup);
              
              // Code content with syntax highlighting
              const codeWrapper = document.createElement('pre');
              codeWrapper.className = 'cm-code-block-content';
              codeWrapper.style.cssText = 'margin: 0; background: var(--bg-secondary); padding: 12px; border: 1px solid var(--border); border-top: none; border-radius: 0 0 6px 6px; font-family: "Fira Code", "Consolas", "Monaco", monospace; font-size: 14px; line-height: 1.6; overflow-x: auto; white-space: pre; max-width: 100%; box-sizing: border-box;';
              
              // Use syntax highlighting
              const codeElement = highlightCode(code, language);
              codeElement.style.cssText = 'display: inline-block; min-width: 100%;';
              codeWrapper.appendChild(codeElement);
              
              container.appendChild(header);
              container.appendChild(codeWrapper);
              
              return container;
            }
          }(),
          side: 1
        }));
        
        // Then hide each line's content individually (not the line breaks)
        for (let pos = startLine.from; pos <= endLine.to;) {
          const line = doc.lineAt(pos);
          if (line.from < line.to) {
            builder.add(line.from, line.to, Decoration.mark({
              attributes: { style: 'display: none;' }
            }));
          }
          pos = line.to + 1;
        }
      }
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});
