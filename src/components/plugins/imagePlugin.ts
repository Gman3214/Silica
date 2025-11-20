import { EditorView, ViewPlugin, ViewUpdate, WidgetType, Decoration, DecorationSet } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

interface ImagePluginOptions {
  projectPath: string | null;
  onChange: (value: string) => void;
}

// Widget to render images inline
class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string) {
    super();
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM() {
    const container = document.createElement('span');
    container.className = 'cm-image-container';
    container.style.cssText = 'display: block; margin: 8px 0;';
    
    const img = document.createElement('img');
    img.alt = this.alt;
    img.className = 'cm-image';
    img.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; display: block; cursor: pointer;';
    
    // Load image as data URL if it's a file path
    if (this.src.startsWith('/') || this.src.match(/^[a-zA-Z]:/)) {
      // Load the image via Electron API
      if (window.electronAPI?.readImage) {
        window.electronAPI.readImage(this.src)
          .then(dataUrl => {
            img.src = dataUrl;
          })
          .catch(error => {
            console.error('Failed to load image:', this.src, error);
            img.style.cssText += ' border: 2px dashed var(--error, red); padding: 20px;';
            img.alt = `Failed to load: ${this.alt}`;
          });
      } else {
        console.error('electronAPI.readImage not available');
        img.style.cssText += ' border: 2px dashed var(--error, red); padding: 20px;';
      }
    } else {
      // Handle URLs or data URLs directly
      img.src = this.src;
    }
    
    // Add error handling for broken images
    img.onerror = () => {
      console.error('Failed to load image:', this.src);
      img.style.cssText += ' border: 2px dashed var(--error, red); padding: 20px;';
    };
    
    // Add click to open in image viewer
    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Dispatch custom event to open image viewer
      const event = new CustomEvent('openImageViewer', {
        detail: { src: this.src, alt: this.alt },
        bubbles: true
      });
      container.dispatchEvent(event);
    });

    // Prevent mousedown from affecting cursor position
    container.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    container.appendChild(img);
    return container;
  }

  ignoreEvent(event: Event): boolean {
    // Ignore click and mousedown events to prevent cursor movement
    return event.type === 'mousedown' || event.type === 'click';
  }
}

// Plugin to render markdown images
const imageRenderingPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>();
    const cursorPos = view.state.selection.main.head;
    
    for (let { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      const offset = from;
      
      // Match markdown images: ![alt](path)
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let match;
      
      while ((match = imageRegex.exec(text)) !== null) {
        const matchFrom = offset + match.index;
        const matchTo = offset + match.index + match[0].length;
        const cursorInMatch = cursorPos >= matchFrom && cursorPos <= matchTo;
        
        // Only render image when cursor is NOT in the markdown syntax
        if (!cursorInMatch) {
          const alt = match[1];
          const src = match[2];
          
          // Replace the markdown with the widget (inline replacement)
          builder.add(
            matchFrom,
            matchTo,
            Decoration.replace({
              widget: new ImageWidget(src, alt)
            })
          );
        }
      }
    }
    
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
});

// Function to save image file to project directory
async function saveImageFile(
  file: File | Blob,
  projectPath: string,
  fileName?: string
): Promise<string | null> {
  try {
    // Generate filename if not provided
    if (!fileName) {
      const timestamp = Date.now();
      const extension = file instanceof File && file.name 
        ? file.name.split('.').pop() 
        : 'png';
      fileName = `image-${timestamp}.${extension}`;
    }
    
    // Read file as ArrayBuffer and convert to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Save via Electron API
    if (window.electronAPI?.saveImage) {
      const savedPath = await window.electronAPI.saveImage(projectPath, fileName, uint8Array);
      return savedPath;
    }
    
    console.error('electronAPI.saveImage not available');
    return null;
  } catch (error) {
    console.error('Failed to save image:', error);
    return null;
  }
}

// Function to insert image markdown at cursor position
function insertImageMarkdown(
  view: EditorView,
  imagePath: string,
  alt: string = 'image'
) {
  const cursor = view.state.selection.main.head;
  const markdown = `![${alt}](${imagePath})`;
  
  view.dispatch({
    changes: {
      from: cursor,
      to: cursor,
      insert: markdown
    },
    selection: {
      anchor: cursor + markdown.length,
      head: cursor + markdown.length
    }
  });
}

// Plugin to handle paste events
export function imagePastePlugin(options: ImagePluginOptions) {
  return EditorView.domEventHandlers({
    paste: (event: ClipboardEvent, view: EditorView) => {
      if (!options.projectPath) {
        console.warn('No project path set, cannot save images');
        return false;
      }
      
      const items = event.clipboardData?.items;
      if (!items) return false;
      
      // Look for image in clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          
          const file = item.getAsFile();
          if (!file) continue;
          
          // Save image asynchronously (don't await in event handler)
          saveImageFile(file, options.projectPath).then(savedPath => {
            if (savedPath) {
              // Insert markdown
              insertImageMarkdown(view, savedPath, 'pasted-image');
              
              // Trigger onChange to save the document
              const newValue = view.state.doc.toString();
              options.onChange(newValue);
            }
          }).catch(error => {
            console.error('Failed to save pasted image:', error);
          });
          
          return true;
        }
      }
      
      return false;
    }
  });
}

// Plugin to handle drag and drop
export function imageDragDropPlugin(options: ImagePluginOptions) {
  return EditorView.domEventHandlers({
    drop: (event: DragEvent, view: EditorView) => {
      if (!options.projectPath) {
        console.warn('No project path set, cannot save images');
        return false;
      }
      
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return false;
      
      // Check if any file is an image
      const imageFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/')
      );
      
      if (imageFiles.length === 0) return false;
      
      event.preventDefault();
      
      // Get drop position
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return true;
      
      // Process each image asynchronously
      Promise.all(
        imageFiles.map(file => saveImageFile(file, options.projectPath!, file.name))
      ).then(paths => {
        let insertText = '';
        paths.forEach((savedPath, index) => {
          if (savedPath) {
            const alt = imageFiles[index].name.split('.')[0] || 'image';
            insertText += `![${alt}](${savedPath})\n`;
          }
        });
        
        if (insertText) {
          view.dispatch({
            changes: {
              from: pos,
              to: pos,
              insert: insertText
            }
          });
          
          // Trigger onChange to save the document
          const newValue = view.state.doc.toString();
          options.onChange(newValue);
        }
      }).catch(error => {
        console.error('Failed to save dropped images:', error);
      });
      
      return true;
    },
    
    dragover: (event: DragEvent) => {
      // Check if dragging files
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    }
  });
}

// Combined export
export function imagePlugin(options: ImagePluginOptions) {
  return [
    imageRenderingPlugin,
    imagePastePlugin(options),
    imageDragDropPlugin(options)
  ];
}
