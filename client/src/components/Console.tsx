import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Copy, RotateCcw, Archive, Clock, Download, Trash2, Pause, Play, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import FloatingWindow from './FloatingWindow';

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

interface SavedLogCollection {
  id: string;
  name: string;
  logs: ConsoleLog[];
  savedAt: string;
  totalEntries: number;
}

export default function Console({ isOpen, onClose }: ConsoleProps) {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Enhanced clipboard and persistent storage states
  const [selectedLogIds, setSelectedLogIds] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [savedLogCollections, setSavedLogCollections] = useState<SavedLogCollection[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSavedLogsDialog, setShowSavedLogsDialog] = useState(false);
  const [saveLogName, setSaveLogName] = useState('');
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [showRangeDialog, setShowRangeDialog] = useState(false);
  
  // Pause/Resume functionality
  const [isPaused, setIsPaused] = useState(false);
  
  const { toast } = useToast();
  const { registerSystemWindow, updateSystemWindow, getWindowZIndex, bringToFront } = useWindowManager();
  
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Register with WindowManager
  useEffect(() => {
    registerSystemWindow('console', 'Console', <Terminal className="w-4 h-4" />);
  }, []);

  useEffect(() => {
    updateSystemWindow('console', isOpen);
  }, [isOpen]);

  const handleFocus = () => {
    bringToFront('console');
  };

  // Load saved log collections from database and localStorage on mount
  useEffect(() => {
    const loadSavedCollections = async () => {
      try {
        // Try to load from database first
        const response = await fetch('/api/console-logs/collections');
        if (response.ok) {
          const data = await response.json();
          if (data.collections && data.collections.length > 0) {
            setSavedLogCollections(data.collections);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load collections from database:', error);
      }

      // Fallback to localStorage
      const savedCollections = localStorage.getItem('console-saved-logs');
      if (savedCollections) {
        try {
          setSavedLogCollections(JSON.parse(savedCollections));
        } catch (error) {
          console.error('Failed to load saved log collections from localStorage:', error);
        }
      }
    };

    loadSavedCollections();
  }, []);

  // Save log collections to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('console-saved-logs', JSON.stringify(savedLogCollections));
  }, [savedLogCollections]);

  // Fetch ALL logs from API (no limit, from deployment start)
  const fetchLogs = async (offset = 0) => {
    try {
      // Fetch in batches of 1000 to get ALL logs
      const response = await fetch(`/api/console-logs?limit=1000&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setLogs(prev => {
            const combined = offset === 0 ? data : [...prev, ...data];
            // Remove duplicates by ID
            const unique = combined.filter((log: ConsoleLog, index: number, self: ConsoleLog[]) => 
              index === self.findIndex((l: ConsoleLog) => l.id === log.id)
            );
            return unique.sort((a: ConsoleLog, b: ConsoleLog) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          });
          
          // If we got 1000 logs, there might be more - fetch next batch
          if (data.length === 1000) {
            setTimeout(() => fetchLogs(offset + 1000), 100);
          }
        }
        if (offset === 0) scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  // Setup WebSocket connection for real-time logs
  const setupWebSocket = () => {
    if (isPaused) return; // Don't setup WebSocket if paused
    
    // Close existing WebSocket first to avoid multiple connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/console`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log('Console WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        if (isPaused) return; // Don't process messages if paused
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
        // Only reconnect if not paused and component is still mounted
        if (!isPaused && wsRef.current === ws) {
          setTimeout(() => {
            if (!isPaused && wsRef.current === ws) {
              setupWebSocket();
            }
          }, 3000);
        }
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
    if (isPaused) return; // Don't setup auto-refresh if paused
    
    refreshIntervalRef.current = setInterval(() => {
      if (!isPaused) { // Only fetch logs if not paused
        fetchLogs();
      }
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

  // Copy functions
  const copyAllLogs = async () => {
    try {
      const logText = logs.map(log => 
        `[${formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`
      ).join('\n');
      
      await navigator.clipboard.writeText(logText);
      toast({
        title: 'All Logs Copied',
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

  const copySelectedLogs = async () => {
    try {
      const selectedLogs = logs.filter(log => selectedLogIds.has(log.id));
      const logText = selectedLogs.map(log => 
        `[${formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`
      ).join('\n');
      
      await navigator.clipboard.writeText(logText);
      toast({
        title: 'Selected Logs Copied',
        description: `${selectedLogs.length} selected log entries copied to clipboard`,
      });
      setSelectedLogIds(new Set());
      setIsSelectionMode(false);
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy selected logs to clipboard',
        variant: 'destructive',
      });
    }
  };

  const copyRangeLogs = async () => {
    if (rangeStart === null || rangeEnd === null) {
      toast({
        title: 'Invalid Range',
        description: 'Please specify both start and end entry numbers',
        variant: 'destructive',
      });
      return;
    }

    try {
      const sortedLogs = [...logs].reverse(); // Show oldest first for range selection
      const start = Math.max(0, rangeStart - 1);
      const end = Math.min(sortedLogs.length, rangeEnd);
      const rangeLogs = sortedLogs.slice(start, end);
      
      const logText = rangeLogs.map(log => 
        `[${formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`
      ).join('\n');
      
      await navigator.clipboard.writeText(logText);
      toast({
        title: 'Range Copied',
        description: `Log entries ${rangeStart}-${rangeEnd} (${rangeLogs.length} entries) copied to clipboard`,
      });
      setShowRangeDialog(false);
      setRangeStart(null);
      setRangeEnd(null);
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy log range to clipboard',
        variant: 'destructive',
      });
    }
  };

  const copySpecificLog = async (log: ConsoleLog) => {
    try {
      const logText = `[${formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`;
      await navigator.clipboard.writeText(logText);
      toast({
        title: 'Log Entry Copied',
        description: 'Single log entry copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy log entry to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Save current logs persistently to database
  const saveCurrentLogs = async () => {
    if (!saveLogName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for the log collection',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Save to database via API for true persistence
      const response = await fetch('/api/console-logs/save-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveLogName.trim(),
          logs: logs,
          totalEntries: logs.length
        })
      });

      if (response.ok) {
        const savedCollection = await response.json();
        
        // Also save to localStorage as backup
        const newCollection: SavedLogCollection = {
          id: savedCollection.id || Date.now().toString(),
          name: saveLogName.trim(),
          logs: [...logs],
          savedAt: new Date().toISOString(),
          totalEntries: logs.length
        };

        setSavedLogCollections(prev => [newCollection, ...prev].slice(0, 50));
        setSaveLogName('');
        setShowSaveDialog(false);
        
        toast({
          title: 'Logs Saved Permanently',
          description: `Log collection "${newCollection.name}" saved to database with ${logs.length} entries`,
        });
      } else {
        throw new Error('Failed to save to database');
      }
    } catch (error) {
      // Fallback to localStorage only
      const newCollection: SavedLogCollection = {
        id: Date.now().toString(),
        name: saveLogName.trim(),
        logs: [...logs],
        savedAt: new Date().toISOString(),
        totalEntries: logs.length
      };

      setSavedLogCollections(prev => [newCollection, ...prev].slice(0, 50));
      setSaveLogName('');
      setShowSaveDialog(false);
      
      toast({
        title: 'Logs Saved (Local)',
        description: `Log collection "${newCollection.name}" saved locally with ${logs.length} entries`,
        variant: 'destructive',
      });
    }
  };

  // Load saved log collection from database or localStorage
  const loadSavedLogs = async (collection: SavedLogCollection) => {
    // Auto-pause when loading a collection to prevent immediate overwrite
    setIsPaused(true);
    
    // Stop WebSocket and auto-refresh immediately
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    setIsConnected(false);
    
    try {
      // Try to load from database first
      const response = await fetch(`/api/console-logs/collections/${collection.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.collection && data.collection.logs) {
          setLogs(data.collection.logs);
          toast({
            title: 'Logs Loaded (Paused)',
            description: `Loaded "${collection.name}" with ${data.collection.logs.length} entries. Click Resume to continue live logs.`,
          });
          setShowSavedLogsDialog(false);
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load from database, using local copy:', error);
    }

    // Fallback to localStorage copy
    setLogs(collection.logs || []);
    toast({
      title: 'Logs Loaded (Paused)',
      description: `Loaded "${collection.name}" with ${collection.totalEntries} entries. Click Resume to continue live logs.`,
    });
    setShowSavedLogsDialog(false);
  };

  // Delete saved log collection
  const deleteSavedLogs = (collectionId: string) => {
    setSavedLogCollections(prev => prev.filter(c => c.id !== collectionId));
    toast({
      title: 'Collection Deleted',
      description: 'Log collection has been deleted',
    });
  };

  // Export saved logs as formatted HTML (console-like appearance)
  const exportSavedLogs = (collection: SavedLogCollection) => {
    try {
      // Validate collection and logs data
      if (!collection) {
        throw new Error('Collection data is missing');
      }
      
      // Handle different possible log data structures
      let logsToExport: ConsoleLog[] = [];
      
      // Strategy 1: Check if we have current logs loaded and this collection is being viewed
      if (logs && logs.length > 0) {
        console.log('Using current logs from memory:', logs.length);
        logsToExport = logs;
      }
      // Strategy 2: Try the collection's logs property
      else if (collection.logs && Array.isArray(collection.logs) && collection.logs.length > 0) {
        console.log('Using collection.logs:', collection.logs.length);
        logsToExport = collection.logs;
      } 
      // Strategy 3: Handle case where logs are stored as JSON string in logsData
      else if ((collection as any).logsData) {
        try {
          console.log('Attempting to parse logsData...');
          const parsedLogs = typeof (collection as any).logsData === 'string' 
            ? JSON.parse((collection as any).logsData) 
            : (collection as any).logsData;
          if (Array.isArray(parsedLogs) && parsedLogs.length > 0) {
            console.log('Using parsed logsData:', parsedLogs.length);
            logsToExport = parsedLogs;
          }
        } catch (parseError) {
          console.error('Failed to parse logsData:', parseError);
        }
      }
      
      // Strategy 4: Try to fetch from database if we have an ID
      if ((!logsToExport || logsToExport.length === 0) && collection.id) {
        console.log('Attempting to fetch from database...');
        // This is a fallback - we'll create a simple export with available data
        logsToExport = [{
          id: 1,
          level: 'INFO',
          message: `Collection "${collection.name}" contains ${collection.totalEntries} entries but logs are not available for export. This may be because the collection was saved to database and needs to be loaded first.`,
          source: 'Export',
          timestamp: new Date().toISOString()
        }];
      }
      
      if (!Array.isArray(logsToExport) || logsToExport.length === 0) {
        throw new Error('Collection has no valid logs to export');
      }
      
      // Escape HTML to prevent issues
      const escapeHtml = (unsafe: string) => {
        if (typeof unsafe !== 'string') {
          return String(unsafe || '');
        }
        return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };
      
      const getLevelBadgeStyle = (level: string) => {
        switch ((level || 'INFO').toUpperCase()) {
          case 'ERROR':
            return 'background: #ef4444; color: white;';
          case 'WARN':
            return 'background: #f59e0b; color: white;';
          case 'INFO':
            return 'background: #3b82f6; color: white;';
          case 'DEBUG':
            return 'background: #6b7280; color: white;';
          default:
            return 'background: #6b7280; color: white;';
        }
      };
      
      const formatLogEntry = (log: ConsoleLog, index: number) => {
        // Validate log entry
        if (!log) {
          return `<div class="log-entry" style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; color: #ef4444;">Invalid log entry</div>`;
        }
        
        const timestamp = escapeHtml(formatTimestamp(log.timestamp || new Date().toISOString()));
        const level = escapeHtml((log.level || 'INFO').toUpperCase());
        const message = escapeHtml(log.message || 'No message');
        const source = log.source ? escapeHtml(log.source) : '';
        const metadata = log.metadata ? escapeHtml(JSON.stringify(log.metadata, null, 2)) : '';
        const badgeStyle = getLevelBadgeStyle(log.level || 'INFO');
        
        return `<div class="log-entry" style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; display: flex; align-items: flex-start; gap: 8px; ${index % 2 === 0 ? '' : 'background-color: #f9fafb;'}">
            <span class="log-timestamp" style="color: #6b7280; font-size: 12px; white-space: nowrap; margin-top: 2px;">${timestamp}</span>
            <span class="log-level-badge" style="padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; min-width: 50px; text-align: center; ${badgeStyle}">${level}</span>
            <div class="log-content" style="flex: 1;">
              <div class="log-message" style="white-space: pre-wrap; word-break: break-word;">${message}</div>
              ${source ? `<div class="log-source" style="color: #9ca3af; font-size: 11px; margin-top: 2px;">Source: ${source}</div>` : ''}
              ${metadata ? `<details class="log-metadata" style="margin-top: 4px; font-size: 12px;"><summary style="color: #6b7280; cursor: pointer;">Metadata</summary><pre style="background: #f9fafb; padding: 8px; border-radius: 4px; margin-top: 4px; overflow-x: auto; font-size: 11px;">${metadata}</pre></details>` : ''}
            </div>
          </div>`;
      };
      
      const collectionName = escapeHtml(collection.name || 'Unnamed Collection');
      const savedTimestamp = escapeHtml(formatTimestamp(collection.savedAt || new Date().toISOString()));
      const exportTimestamp = escapeHtml(new Date().toLocaleString());
      const totalEntries = collection.totalEntries || logsToExport.length || 0;
      
      // Generate the HTML content with exact console styling
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Console Logs - ${collectionName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #ffffff;
            line-height: 1.5;
        }
        .header {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0 0 8px 0;
            color: #1e293b;
            font-size: 24px;
            font-weight: 600;
        }
        .header-info {
            color: #64748b;
            font-size: 14px;
        }
        .logs-container {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
            min-height: 200px;
        }
        .log-entry:hover {
            background-color: #f1f5f9 !important;
        }
        .no-logs {
            padding: 40px;
            text-align: center;
            color: #6b7280;
            font-style: italic;
        }
        @media (max-width: 768px) {
            body { padding: 10px; }
            .log-entry { font-size: 12px; padding: 6px 8px; }
            .log-timestamp { display: none; }
        }
        @media print {
            body { background: white; }
            .header { background: white; border: 1px solid #ccc; }
            .logs-container { border: 1px solid #ccc; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Console Logs Export</h1>
        <div class="header-info">
            <strong>Collection:</strong> ${collectionName}<br>
            <strong>Total Entries:</strong> ${totalEntries}<br>
            <strong>Saved:</strong> ${savedTimestamp}<br>
            <strong>Exported:</strong> ${exportTimestamp}
        </div>
    </div>
    <div class="logs-container">
        ${logsToExport && logsToExport.length > 0 
          ? logsToExport.map((log, index) => formatLogEntry(log, index)).join('')
          : '<div class="no-logs">No log entries found in this collection</div>'
        }
    </div>
    <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center; color: #64748b; font-size: 12px;">
        Exported from Console Application on ${exportTimestamp}
    </div>
</body>
</html>`;

      // Create and trigger download
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `console-logs-${collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Export Complete',
        description: `Exported ${logsToExport.length} log entries to HTML file`,
      });
      
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: `Failed to export logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  // Toggle pause/resume
  const togglePause = () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    
    if (newPausedState) {
      // PAUSE - Stop WebSocket and auto-refresh immediately
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      setIsConnected(false);
      toast({
        title: 'Console Paused',
        description: 'Live log streaming paused. Current logs retained.',
      });
    } else {
      // RESUME - Start fresh WebSocket and auto-refresh
      setupWebSocket();
      setupAutoRefresh();
      toast({
        title: 'Console Resumed',
        description: 'Live log streaming resumed.',
      });
    }
  };

  // Clear all logs
  const clearAllLogs = () => {
    setLogs([]);
    setSelectedLogIds(new Set());
    setIsSelectionMode(false);
    toast({
      title: 'Logs Cleared',
      description: 'All log entries have been cleared from view',
    });
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedLogIds(new Set());
    }
  };

  // Handle log selection
  const toggleLogSelection = (logId: number) => {
    const newSelection = new Set(selectedLogIds);
    if (newSelection.has(logId)) {
      newSelection.delete(logId);
    } else {
      newSelection.add(logId);
    }
    setSelectedLogIds(newSelection);
  };

  // Helper functions
  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR': return 'text-red-600 bg-red-50 border-red-200';
      case 'WARN': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'INFO': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'DEBUG': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Setup connections when console opens and not paused
  useEffect(() => {
    if (isOpen && !isPaused) {
      fetchLogs();
      setupWebSocket();
      setupAutoRefresh();
      
      return () => {
        if (wsRef.current) {
          wsRef.current.close();
        }
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [isOpen, isPaused]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <FloatingWindow
      id="console"
      title="Console"
      isOpen={isOpen}
      onClose={onClose}
      onFocus={handleFocus}
      zIndex={getWindowZIndex('console')}
      defaultPosition={{ x: 50, y: 50 }}
      defaultSize={{ width: 700, height: 500 }}
      minSize={{ width: 600, height: 400 }}
      data-testid="console-window"
      headerContent={
        <div className="flex items-center space-x-1 no-drag">
          {/* Connection status */}
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          } mr-2`} title={isConnected ? 'Connected' : 'Disconnected'} />
          
          {/* Pause/Resume button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={togglePause}
            className="h-6 w-6 p-0"
            title={isPaused ? 'Resume log streaming' : 'Pause log streaming'}
            data-testid="button-pause-resume"
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </Button>
          
          {/* Clear logs */}
          <Button
            size="sm"
            variant="ghost"
            onClick={clearAllLogs}
            className="h-6 w-6 p-0"
            title="Clear all logs"
            data-testid="button-clear"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          
          {/* Copy all logs */}
          <Button
            size="sm"
            variant="ghost"
            onClick={copyAllLogs}
            className="h-6 w-6 p-0"
            title="Copy all logs"
            data-testid="button-copy-all"
          >
            <Copy className="h-3 w-3" />
          </Button>
          
          {/* Save logs */}
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                title="Save logs permanently"
                data-testid="button-save"
              >
                <Archive className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Log Collection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="save-name">Collection Name</Label>
                  <Input
                    id="save-name"
                    value={saveLogName}
                    onChange={(e) => setSaveLogName(e.target.value)}
                    placeholder="Enter name for log collection"
                    data-testid="input-save-name"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  This will save {logs.length} log entries permanently to the database.
                </div>
                <div className="flex space-x-2">
                  <Button onClick={saveCurrentLogs} data-testid="button-confirm-save">
                    Save Collection
                  </Button>
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Load saved logs */}
          <Dialog open={showSavedLogsDialog} onOpenChange={setShowSavedLogsDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                title="Load saved logs"
                data-testid="button-load"
              >
                <Clock className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Saved Log Collections</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {savedLogCollections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No saved log collections found
                  </div>
                ) : (
                  savedLogCollections.map((collection) => (
                    <Card key={collection.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{collection.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {collection.totalEntries} entries • Saved {formatTimestamp(collection.savedAt)}
                          </div>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadSavedLogs(collection)}
                            data-testid={`button-load-${collection.id}`}
                          >
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => exportSavedLogs(collection)}
                            title="Export as HTML"
                            data-testid={`button-export-${collection.id}`}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSavedLogs(collection.id)}
                            title="Delete collection"
                            data-testid={`button-delete-${collection.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {/* Console Content */}
      <div className="flex flex-col h-full bg-black text-green-400 font-mono text-sm">
        {/* Enhanced toolbar */}
        <div className="flex items-center justify-between p-2 bg-gray-900 border-b border-gray-700 text-xs">
          <div className="flex items-center space-x-4">
            <Badge variant={isPaused ? 'destructive' : 'default'}>
              {isPaused ? 'PAUSED' : 'LIVE'}
            </Badge>
            <span>{logs.length} entries</span>
            {selectedLogIds.size > 0 && (
              <span className="text-yellow-400">{selectedLogIds.size} selected</span>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Selection mode toggle */}
            <Button
              size="sm"
              variant={isSelectionMode ? 'default' : 'ghost'}
              onClick={toggleSelectionMode}
              className="h-6 px-2 text-xs"
              data-testid="button-selection-mode"
            >
              Select
            </Button>
            
            {/* Copy selected (only when in selection mode and has selections) */}
            {isSelectionMode && selectedLogIds.size > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={copySelectedLogs}
                className="h-6 px-2 text-xs"
                data-testid="button-copy-selected"
              >
                Copy Selected
              </Button>
            )}
            
            {/* Copy range */}
            <Dialog open={showRangeDialog} onOpenChange={setShowRangeDialog}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  data-testid="button-copy-range"
                >
                  Copy Range
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Copy Log Range</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Logs are numbered from 1 (oldest) to {logs.length} (newest)
                  </div>
                  <div className="flex space-x-2">
                    <div>
                      <Label htmlFor="range-start">From Entry #</Label>
                      <Input
                        id="range-start"
                        type="number"
                        min="1"
                        max={logs.length}
                        value={rangeStart || ''}
                        onChange={(e) => setRangeStart(parseInt(e.target.value) || null)}
                        placeholder="1"
                        data-testid="input-range-start"
                      />
                    </div>
                    <div>
                      <Label htmlFor="range-end">To Entry #</Label>
                      <Input
                        id="range-end"
                        type="number"
                        min="1"
                        max={logs.length}
                        value={rangeEnd || ''}
                        onChange={(e) => setRangeEnd(parseInt(e.target.value) || null)}
                        placeholder={logs.length.toString()}
                        data-testid="input-range-end"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={copyRangeLogs} data-testid="button-confirm-copy-range">
                      Copy Range
                    </Button>
                    <Button variant="outline" onClick={() => setShowRangeDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Logs container */}
        <div 
          ref={logsContainerRef}
          className="flex-1 overflow-y-auto p-2 space-y-1"
          data-testid="logs-container"
        >
          {logs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {isPaused ? 'Console is paused. Click Resume to continue live logging.' : 'No logs available. Connecting...'}
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`p-2 rounded border cursor-pointer transition-colors ${
                  selectedLogIds.has(log.id) 
                    ? 'bg-blue-900 border-blue-700' 
                    : isSelectionMode 
                      ? 'hover:bg-gray-800 border-gray-700'
                      : 'hover:bg-gray-900 border-gray-800'
                }`}
                onClick={() => isSelectionMode ? toggleLogSelection(log.id) : copySpecificLog(log)}
                data-testid={`log-entry-${log.id}`}
              >
                <div className="flex items-start space-x-2 text-xs">
                  <span className="text-gray-500 shrink-0 w-20">
                    {formatTimestamp(log.timestamp).split(' ')[1]}
                  </span>
                  <Badge 
                    className={`shrink-0 text-xs ${getLevelColor(log.level)}`}
                    variant="outline"
                  >
                    {log.level.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="break-words">{log.message}</div>
                    {log.source && (
                      <div className="text-gray-600 text-xs mt-1">
                        Source: {log.source}
                      </div>
                    )}
                    {log.metadata && (
                      <details className="mt-1">
                        <summary className="text-gray-600 cursor-pointer text-xs">
                          Metadata
                        </summary>
                        <pre className="text-gray-400 text-xs mt-1 bg-gray-900 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </FloatingWindow>
  );
}