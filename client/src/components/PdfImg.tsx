import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Maximize2, Minimize2, GripVertical } from 'lucide-react';

interface PdfImgProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PdfImg({ isOpen, onClose }: PdfImgProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const pdfImgRef = useRef<HTMLDivElement>(null);

  // Handle maximize/minimize toggle
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized || (e.target as HTMLElement).closest('.no-drag')) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Handle touch start for dragging (mobile support)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isMaximized || (e.target as HTMLElement).closest('.no-drag')) return;
    
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    });
  };

  // Handle mouse down for resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  // Handle touch start for resizing (mobile support)
  const handleResizeTouchStart = (e: React.TouchEvent) => {
    if (isMaximized) return;
    
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    setIsResizing(true);
    setResizeStart({
      x: touch.clientX,
      y: touch.clientY,
      width: size.width,
      height: size.height
    });
  };

  // Handle mouse/touch move for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isMaximized) {
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.x));
        const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragStart.y));
        setPosition({ x: newX, y: newY });
      } else if (isResizing && !isMaximized) {
        const newWidth = Math.max(400, resizeStart.width + (e.clientX - resizeStart.x));
        const newHeight = Math.max(300, resizeStart.height + (e.clientY - resizeStart.y));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && !isMaximized) {
        const touch = e.touches[0];
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, touch.clientX - dragStart.x));
        const newY = Math.max(0, Math.min(window.innerHeight - size.height, touch.clientY - dragStart.y));
        setPosition({ x: newX, y: newY });
      } else if (isResizing && !isMaximized) {
        const touch = e.touches[0];
        const newWidth = Math.max(400, resizeStart.width + (touch.clientX - resizeStart.x));
        const newHeight = Math.max(300, resizeStart.height + (touch.clientY - resizeStart.y));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, size, isMaximized]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      ref={pdfImgRef}
      className={`fixed bg-background border border-border rounded-lg shadow-2xl z-50 flex flex-col ${
        isMaximized ? 'inset-0 rounded-none' : ''
      }`}
      style={
        isMaximized
          ? {}
          : {
              left: position.x,
              top: position.y,
              width: size.width,
              height: size.height,
            }
      }
      data-testid="pdfimg-window"
    >
      {/* Header with drag handle and controls */}
      <CardHeader className="px-4 py-2 border-b border-border cursor-move select-none bg-muted/50">
        <div
          className="flex items-center justify-between"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="flex items-center space-x-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">🎨 Advanced Image Cropper</span>
          </div>
          
          <div className="flex items-center space-x-1 no-drag">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleMaximize}
              className="h-6 w-6 p-0"
              data-testid="button-maximize"
            >
              {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-6 w-6 p-0"
              data-testid="button-close"
            >
              ×
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Content area with iframe */}
      <CardContent className="p-0 flex-1 overflow-hidden relative">
        <iframe
          src="/FinalCropper/public/index.html"
          className="w-full h-full border-0"
          title="Advanced Image Cropper"
          allow="fullscreen; camera; microphone; clipboard-read; clipboard-write"
          style={{
            // Force desktop mode and ensure proper scaling
            width: '100%',
            height: '100%',
            minWidth: '1200px',
            minHeight: '800px',
            overflow: 'auto'
          }}
          data-testid="pdfimg-iframe"
        />
      </CardContent>

      {/* Resize Handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-muted hover:bg-muted-foreground/20 transition-colors"
          onMouseDown={handleResizeMouseDown}
          onTouchStart={handleResizeTouchStart}
          data-testid="resize-handle"
        >
          <GripVertical className="h-3 w-3 rotate-90" />
        </div>
      )}
    </div>
  );
}