import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Maximize2, Minimize2, GripVertical } from 'lucide-react';
import { useWindowManager } from '@/contexts/WindowManagerContext';

interface PdfImgProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PdfImg({ isOpen, onClose }: PdfImgProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState({ width: Math.min(1400, window.innerWidth - 100), height: Math.min(900, window.innerHeight - 100) });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isMolViewActive, setIsMolViewActive] = useState(false);
  const [currentZIndex, setCurrentZIndex] = useState(1000);

  const pdfImgRef = useRef<HTMLDivElement>(null);
  const { registerSystemWindow, updateSystemWindow, getWindowZIndex, bringToFront } = useWindowManager();

  // Handle maximize/minimize toggle
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  // Register with WindowManager and handle focus
  useEffect(() => {
    const zIndex = registerSystemWindow('pdfimg', isMolViewActive ? '🧬 MolView Editor' : '🎨 Advanced Image Cropper');
    setCurrentZIndex(zIndex);
  }, []);

  useEffect(() => {
    updateSystemWindow('pdfimg', isOpen);
  }, [isOpen]);

  useEffect(() => {
    const zIndex = getWindowZIndex('pdfimg');
    setCurrentZIndex(zIndex);
  }, [getWindowZIndex('pdfimg')]);

  const handleFocus = () => {
    bringToFront('pdfimg');
    const newZIndex = getWindowZIndex('pdfimg');
    setCurrentZIndex(newZIndex);
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
        const newWidth = Math.max(600, Math.min(window.innerWidth - position.x, resizeStart.width + (e.clientX - resizeStart.x)));
        const newHeight = Math.max(400, Math.min(window.innerHeight - position.y, resizeStart.height + (e.clientY - resizeStart.y)));
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
        const newWidth = Math.max(600, Math.min(window.innerWidth - position.x, resizeStart.width + (touch.clientX - resizeStart.x)));
        const newHeight = Math.max(400, Math.min(window.innerHeight - position.y, resizeStart.height + (touch.clientY - resizeStart.y)));
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
      className={`fixed bg-background border border-border rounded-lg shadow-2xl flex flex-col ${
        isMaximized ? 'inset-0 rounded-none' : ''
      }`}
      style={
        isMaximized
          ? { zIndex: currentZIndex }
          : {
              left: position.x,
              top: position.y,
              width: size.width,
              height: size.height,
              zIndex: currentZIndex,
            }
      }
      onClick={handleFocus}
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
            <span className="text-sm font-medium">
              {isMolViewActive ? '🧬 MolView Editor' : '🎨 Advanced Image Cropper'}
            </span>
          </div>
          
          <div className="flex items-center space-x-1 no-drag">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const iframe = document.querySelector('#pdfimg-iframe') as HTMLIFrameElement;
                if (iframe) {
                  const newSrc = isMolViewActive 
                    ? '/FinalCropper/build/index.html'
                    : '/FinalCropper/public/molview/index.html';
                  
                  const viewName = isMolViewActive ? 'Image Cropper' : 'MolView';
                  
                  console.log(`🔄 [Toggle] Button clicked - switching to ${viewName}`);
                  console.log(`   🔄 From: ${iframe.src}`);
                  console.log(`   ➡️  To: ${newSrc}`);
                  console.log(`   🌐 Current location: ${window.location.origin}${window.location.pathname}`);
                  
                  // Check if the target URL is accessible before switching
                  fetch(newSrc, { method: 'HEAD' })
                    .then(response => {
                      console.log(`   🔍 ${viewName} URL accessibility: ${response.status} ${response.statusText}`);
                      if (response.ok) {
                        iframe.src = newSrc;
                        setIsMolViewActive(!isMolViewActive);
                        console.log(`   ✅ ${viewName} iframe source updated successfully`);
                      } else {
                        console.error(`   ❌ ${viewName} URL not accessible: ${response.status} ${response.statusText}`);
                      }
                    })
                    .catch(error => {
                      console.error(`   🚫 ${viewName} URL check failed: ${error.message}`);
                      // Still try to load it in case the HEAD request fails but GET works
                      iframe.src = newSrc;
                      setIsMolViewActive(!isMolViewActive);
                      console.log(`   🤞 Attempting to load ${viewName} despite HEAD request failure`);
                    });
                }
              }}
              className="h-6 px-2 text-xs"
              data-testid="button-molview"
            >
              {isMolViewActive ? '🎨 Image Editor' : '🧬 MolView'}
            </Button>
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
          id="pdfimg-iframe"
          src="/FinalCropper/build/index.html"
          className="w-full h-full border-0"
          title="Advanced Image Cropper"
          allow="fullscreen; camera; microphone; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          style={{
            // Force desktop mode and ensure proper scaling
            width: '100%',
            height: '100%',
            minWidth: '100%',
            minHeight: '100%',
            overflow: 'auto',
            backgroundColor: '#ffffff'
          }}
          data-testid="pdfimg-iframe"
          onLoad={(e) => {
            const iframe = e.target as HTMLIFrameElement;
            console.log('🎨 [PdfImg] Iframe loaded successfully');
            console.log(`   📍 Source URL: ${iframe.src}`);
            console.log(`   🌐 Current location: ${window.location.origin}${window.location.pathname}`);
            console.log(`   ✅ Content window available: ${!!iframe.contentWindow}`);
            
            // Attempt to detect iframe content loading status
            try {
              const contentDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (contentDoc) {
                console.log(`   📄 Content document title: ${contentDoc.title}`);
                console.log(`   📊 Content readyState: ${contentDoc.readyState}`);
              }
            } catch (error) {
              console.log(`   🔒 Cross-origin content (normal behavior): ${error instanceof Error ? error.message : 'Access denied'}`);
            }
          }}
          onError={(e) => {
            const iframe = e.target as HTMLIFrameElement;
            console.error('🚨 [PdfImg] Iframe failed to load');
            console.error(`   📍 Failed source URL: ${iframe.src}`);
            console.error(`   🌐 Current location: ${window.location.origin}${window.location.pathname}`);
            console.error(`   📋 Base URL: ${document.baseURI}`);
            
            // Check if the URL is accessible
            fetch(iframe.src, { method: 'HEAD' })
              .then(response => {
                console.error(`   🔍 URL accessibility check: ${response.status} ${response.statusText}`);
                if (!response.ok) {
                  console.error(`   ❌ Server returned error: ${response.status}`);
                }
              })
              .catch(fetchError => {
                console.error(`   🚫 URL fetch failed: ${fetchError.message}`);
              });
          }}
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