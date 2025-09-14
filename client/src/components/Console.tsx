import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Maximize2, Minimize2, Copy, RotateCcw, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConsoleLog {
  id: number;
  level: string;
  message: string;
  source: string;
  metadata?: any;
  timestamp: string;
}

interface ConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Console({ isOpen, onClose }: ConsoleProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const { toast } = useToast();
  
  const consoleRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial logs from API
  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/console-logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  // Setup WebSocket connection for real-time logs
  const setupWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/console`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log('Console WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const logEntry = JSON.parse(event.data);
          setLogs(prev => [logEntry, ...prev].slice(0, 1000)); // Keep last 1000 logs
          scrollToBottom();
        } catch (error) {
          console.error('Failed to parse log entry:', error);
        }
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        console.log('Console WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        setTimeout(setupWebSocket, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('Console WebSocket error:', error);
        setIsConnected(false);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnected(false);
    }
  };

  // Setup auto-refresh every 15 seconds
  const setupAutoRefresh = () => {
    refreshIntervalRef.current = setInterval(() => {
      fetchLogs();
    }, 15000);
  };

  // Scroll to bottom of logs
  const scrollToBottom = () => {
    setTimeout(() => {
      if (logsContainerRef.current) {
        logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // Copy all logs to clipboard
  const copyLogs = async () => {
    try {
      const logText = logs.map(log => 
        `[${new Date(log.timestamp).toLocaleString()}] ${log.level.toUpperCase()}: ${log.message}`
      ).join('\n');
      
      await navigator.clipboard.writeText(logText);
      toast({
        title: 'Logs Copied',
        description: `${logs.length} log entries copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy logs to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Handle last log button (manual refresh)
  const handleLastLog = () => {
    fetchLogs();
    toast({
      title: 'Logs Refreshed',
      description: 'Console logs have been refreshed',
    });
  };

  // Handle maximize/minimize
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  // Mouse event handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && !isMaximized) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Mouse event handlers for resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.stopPropagation();
    
    setIsResizing(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (isResizing && !isMaximized) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      setSize(prev => ({
        width: Math.max(300, prev.width + deltaX),
        height: Math.max(200, prev.height + deltaY),
      }));
      
      setDragStart({
        x: e.clientX,
        y: e.clientY,
      });
    }
  };

  // Effect to setup WebSocket and intervals
  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      setupWebSocket();
      setupAutoRefresh();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isOpen]);

  // Effect to handle mouse events
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', isDragging ? handleMouseMove : handleResizeMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', isDragging ? handleMouseMove : handleResizeMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart]);

  // Format log level with colors
  const getLogLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR': return 'text-red-500';
      case 'WARN': return 'text-yellow-500';
      case 'INFO': return 'text-blue-500';
      case 'DEBUG': return 'text-gray-500';
      default: return 'text-gray-700 dark:text-gray-300';
    }
  };

  if (!isOpen) return null;

  const consoleStyle = isMaximized
    ? {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1000,
      }
    : {
        position: 'fixed' as const,
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 1000,
      };

  return (
    <div
      ref={consoleRef}
      style={consoleStyle}
      className="bg-background border shadow-lg rounded-lg overflow-hidden"
      data-testid="console-window"
    >
      {/* Header Bar */}
      <CardHeader 
        className="py-2 px-4 bg-muted cursor-move select-none flex flex-row items-center justify-between space-y-0"
        onMouseDown={handleMouseDown}
        data-testid="console-header"
      >
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">Console</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {logs.length} logs • {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLastLog}
            className="h-6 w-6 p-0"
            data-testid="button-refresh"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={copyLogs}
            className="h-6 w-6 p-0"
            data-testid="button-copy"
          >
            <Copy className="h-3 w-3" />
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
      </CardHeader>

      {/* Logs Content */}
      <CardContent className="p-0 h-full">
        <div 
          ref={logsContainerRef}
          className="h-full overflow-y-auto bg-black dark:bg-gray-900 text-green-400 dark:text-green-300 font-mono text-sm p-4"
          data-testid="logs-container"
        >
          {logs.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              No logs available. Waiting for real-time logs...
            </div>
          ) : (
            logs.slice().reverse().map((log, index) => (
              <div key={log.id || index} className="mb-1 break-words" data-testid={`log-entry-${index}`}>
                <span className="text-gray-400 dark:text-gray-500">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>{' '}
                <span className={getLogLevelColor(log.level)}>
                  {log.level.toUpperCase()}
                </span>{' '}
                <span className="text-gray-300 dark:text-gray-400">
                  [{log.source}]
                </span>{' '}
                <span className="text-white dark:text-gray-100">
                  {log.message}
                </span>
                {log.metadata && (
                  <div className="ml-4 text-xs text-gray-500 dark:text-gray-400">
                    {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* Resize Handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-muted hover:bg-muted-foreground/20 transition-colors"
          onMouseDown={handleResizeMouseDown}
          data-testid="resize-handle"
        >
          <GripVertical className="h-3 w-3 rotate-90" />
        </div>
      )}
    </div>
  );
}