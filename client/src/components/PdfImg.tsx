import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import FloatingWindow from './FloatingWindow';

interface PdfImgProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PdfImg({ isOpen, onClose }: PdfImgProps) {
  const [isMolViewActive, setIsMolViewActive] = useState(false);
  const { registerSystemWindow, updateSystemWindow, getWindowZIndex, bringToFront } = useWindowManager();

  // Register with WindowManager
  useEffect(() => {
    registerSystemWindow('pdfimg', isMolViewActive ? '🧬 MolView Editor' : '🎨 Advanced Image Cropper');
  }, []);

  useEffect(() => {
    updateSystemWindow('pdfimg', isOpen);
  }, [isOpen]);

  const handleFocus = () => {
    bringToFront('pdfimg');
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <FloatingWindow
      id="pdfimg"
      title={isMolViewActive ? '🧬 MolView Editor' : '🎨 Advanced Image Cropper'}
      isOpen={isOpen}
      onClose={onClose}
      onFocus={handleFocus}
      zIndex={getWindowZIndex('pdfimg')}
      defaultPosition={{ x: 50, y: 50 }}
      defaultSize={{ width: Math.min(1400, window.innerWidth - 100), height: Math.min(900, window.innerHeight - 100) }}
      minSize={{ width: 600, height: 400 }}
      data-testid="pdfimg-window"
      headerContent={
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
        </div>
      }
    >
      {/* Content area with iframe - full height and width */}
      <div className="flex-1 overflow-hidden relative w-full h-full">
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
      </div>
    </FloatingWindow>
  );
}