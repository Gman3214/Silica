import React, { useEffect, useState } from 'react';
import './ImageViewer.css';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imgRef = React.useRef<HTMLImageElement>(null);

  // Load image as data URL if it's a file path
  useEffect(() => {
    const loadImage = async () => {
      if (src.startsWith('/') || src.match(/^[a-zA-Z]:/)) {
        // It's a file path, load via Electron API
        if (window.electronAPI?.readImage) {
          try {
            const dataUrl = await window.electronAPI.readImage(src);
            setImageSrc(dataUrl);
            setLoading(false);
          } catch (error) {
            console.error('Failed to load image:', src, error);
            setLoading(false);
          }
        }
      } else {
        // It's already a URL or data URL
        setImageSrc(src);
        setLoading(false);
      }
    };

    loadImage();
  }, [src]);

  // Reset position when zoom changes
  useEffect(() => {
    if (zoom <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [zoom]);

  // Constrain position to keep image within viewport
  const constrainPosition = (pos: { x: number; y: number }, currentZoom: number) => {
    if (currentZoom <= 1 || !imgRef.current) return { x: 0, y: 0 };

    const img = imgRef.current;
    const viewportWidth = window.innerWidth * 0.9;
    const viewportHeight = window.innerHeight * 0.9;
    
    const scaledWidth = img.naturalWidth * currentZoom;
    const scaledHeight = img.naturalHeight * currentZoom;

    // Calculate max offset to keep edges within viewport
    const maxX = Math.max(0, (scaledWidth - viewportWidth) / 2 / currentZoom);
    const maxY = Math.max(0, (scaledHeight - viewportHeight) / 2 / currentZoom);

    return {
      x: Math.max(-maxX, Math.min(maxX, pos.x)),
      y: Math.max(-maxY, Math.min(maxY, pos.y))
    };
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.min(Math.max(0.5, prev + delta), 5));
    };

    document.addEventListener('keydown', handleEscape);
    const viewer = document.querySelector('.image-viewer-content');
    viewer?.addEventListener('wheel', handleWheel as any);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      viewer?.removeEventListener('wheel', handleWheel as any);
    };
  }, [onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging when zoomed in
    if (zoom <= 1) return;
    // Allow dragging anywhere on the image
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      e.preventDefault();
      const newPos = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
      const constrainedPos = constrainPosition(newPos, zoom);
      setPosition(constrainedPos);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Only close when clicking the dark overlay background, not the image
    if ((e.target as HTMLElement).classList.contains('image-viewer-overlay')) {
      onClose();
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 0.2, 5);
    setZoom(newZoom);
    // Constrain position after zoom change
    setPosition(prev => constrainPosition(prev, newZoom));
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 0.2, 0.5);
    setZoom(newZoom);
    // Constrain position after zoom change
    setPosition(prev => constrainPosition(prev, newZoom));
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="image-viewer-overlay" onClick={handleBackgroundClick}>
      <div className="image-viewer-controls">
        <button onClick={handleZoomOut} title="Zoom Out">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} title="Zoom In">+</button>
        <button onClick={handleReset} title="Reset">Reset</button>
        <button onClick={onClose} className="close-btn" title="Close (Esc)">×</button>
      </div>
      <div
        className="image-viewer-content"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleMouseDown}
        style={{
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
      >
        {loading ? (
          <div style={{ color: 'var(--text-primary)', fontSize: '18px' }}>Loading...</div>
        ) : imageSrc ? (
          <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              pointerEvents: 'none' // Let the container handle mouse events
            }}
            draggable={false}
          />
        ) : (
          <div style={{ color: 'var(--error, red)', fontSize: '18px' }}>Failed to load image</div>
        )}
      </div>
    </div>
  );
};

export default ImageViewer;
