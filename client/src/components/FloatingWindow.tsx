import { useState, useEffect, useRef, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader } from '@/components/ui/card';
import { Maximize2, Minimize2, GripVertical, X } from 'lucide-react';

interface FloatingWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  zIndex?: number;
  onFocus?: () => void;
}

export default function FloatingWindow({
  isOpen,
  onClose,
  title,
  icon,
  children,
  defaultWidth = Math.min(1400, window.innerWidth - 100),
  defaultHeight = Math.min(900, window.innerHeight - 100),
  minWidth = 600,
  minHeight = 400,
  zIndex = 50,
  onFocus,
}: FloatingWindowProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const windowRef = useRef<HTMLDivElement>(null);

  // Handle maximize/minimize toggle
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  // Handle focus - bring window to front
  const handleFocus = () => {
    onFocus?.();
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized || (e.target as HTMLElement).closest('.no-drag')) return;
    
    handleFocus();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Handle touch start for dragging (mobile support)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isMaximized || (e.target as HTMLElement).closest('.no-drag')) return;
    
    handleFocus();
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
    handleFocus();
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
    handleFocus();
    const touch = e.touches[0];
    setIsResizing(true);
    setResizeStart({
      x: touch.clientX,
      y: touch.clientY,
      width: size.width,
      height: size.height
    });
  };

  // Handle window resize to maintain proper sizing
  useEffect(() => {
    const handleResize = () => {
      if (!isMaximized) {
        setSize(prevSize => ({
          width: Math.min(prevSize.width, window.innerWidth - 100),
          height: Math.min(prevSize.height, window.innerHeight - 100)
        }));
        setPosition(prevPos => ({
          x: Math.min(prevPos.x, window.innerWidth - size.width),
          y: Math.min(prevPos.y, window.innerHeight - size.height)
        }));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMaximized, size.width, size.height]);

  // Handle mouse/touch move for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isMaximized) {
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.x));
        const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragStart.y));
        setPosition({ x: newX, y: newY });
      } else if (isResizing && !isMaximized) {
        const newWidth = Math.max(minWidth, Math.min(window.innerWidth - position.x, resizeStart.width + (e.clientX - resizeStart.x)));
        const newHeight = Math.max(minHeight, Math.min(window.innerHeight - position.y, resizeStart.height + (e.clientY - resizeStart.y)));
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
        const newWidth = Math.max(minWidth, Math.min(window.innerWidth - position.x, resizeStart.width + (touch.clientX - resizeStart.x)));
        const newHeight = Math.max(minHeight, Math.min(window.innerHeight - position.y, resizeStart.height + (touch.clientY - resizeStart.y)));
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
  }, [isDragging, isResizing, dragStart, resizeStart, size, isMaximized, minWidth, minHeight]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      className={`fixed bg-background border border-border rounded-lg shadow-2xl flex flex-col ${
        isMaximized ? 'inset-0 rounded-none' : ''
      }`}
      style={
        isMaximized
          ? { zIndex }
          : {
              left: position.x,
              top: position.y,
              width: size.width,
              height: size.height,
              zIndex,
            }
      }
      onClick={handleFocus}
      data-testid="floating-window"
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
            {icon && <span className="text-sm">{icon}</span>}
            <span className="text-sm font-medium">{title}</span>
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
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Content area */}
      <CardContent className="p-0 flex-1 overflow-hidden relative">
        {children}
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