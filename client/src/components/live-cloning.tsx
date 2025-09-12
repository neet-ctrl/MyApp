import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Play, Square, Activity, Terminal, AlertTriangle, CheckCircle, 
  Copy, Trash2, Plus, Save, Edit3, X, Link, Filter, Settings,
  MessageSquare, Users, Zap
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/lib/storage';
import type { Chat } from '@shared/schema';

interface EntityLink {
  id?: number;
  instanceId: string;
  fromEntity: string;
  toEntity: string;
  isActive: boolean;
}

interface WordFilter {
  id?: number;
  instanceId: string;
  fromWord: string;
  toWord: string;
  isActive: boolean;
}

interface LiveCloningStatus {
  running: boolean;
  instanceId?: string;
  lastActivity: string | null;
  processedMessages: number;
  totalLinks: number;
  currentUserInfo?: {
    id: number;
    username: string;
    firstName: string;
  };
  sessionValid: boolean;
  botEnabled: boolean;
  filterWords: boolean;
  addSignature: boolean;
  signature?: string;
  logs: string[];
}

export function LiveCloning() {
  const [sessionString, setSessionString] = useState(import.meta.env.VITE_DEFAULT_SESSION_STRING || '');
  const [entityLinks, setEntityLinks] = useState<EntityLink[]>([]);
  const [wordFilters, setWordFilters] = useState<WordFilter[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
  // Entity Link Form
  const [newFromEntity, setNewFromEntity] = useState('');
  const [newToEntity, setNewToEntity] = useState('');
  
  // Word Filter Form
  const [newFromWord, setNewFromWord] = useState('');
  const [newToWord, setNewToWord] = useState('');
  
  // Bot Settings
  const [botEnabled, setBotEnabled] = useState(true);
  const [filterWords, setFilterWords] = useState(true);
  const [addSignature, setAddSignature] = useState(false);
  const [signature, setSignature] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch chats from storage for dropdowns
  const { data: chats = [], isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ['chats'],
    queryFn: async () => {
      return await storage.getChats();
    },
  });

  // Fetch live cloning status
  const { data: statusData, isLoading } = useQuery({
    queryKey: ['live-cloning-status'],
    queryFn: async () => {
      const response = await fetch('/api/live-cloning/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      return response.json();
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Fetch logs
  const { data: logsData } = useQuery({
    queryKey: ['live-cloning-logs'],
    queryFn: async () => {
      const response = await fetch('/api/live-cloning/logs');
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
    refetchInterval: 3000, // Poll every 3 seconds
    enabled: showLogs,
  });

  const status: LiveCloningStatus = statusData?.status || {
    running: false,
    instanceId: undefined,
    lastActivity: null,
    processedMessages: 0,
    totalLinks: 0,
    sessionValid: false,
    botEnabled: true,
    filterWords: true,
    addSignature: false,
    signature: undefined,
    logs: []
  };

  // Test session string login
  const testSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/live-cloning/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionString: sessionString.trim() }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to test session');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setLoginStatus('success');
      toast({ 
        title: 'Session Valid! ✅', 
        description: `Logged in as ${data.userInfo.firstName} (@${data.userInfo.username}) - ID: ${data.userInfo.id}` 
      });
      queryClient.invalidateQueries({ queryKey: ['live-cloning-status'] });
    },
    onError: (error: Error) => {
      setLoginStatus('error');
      toast({ 
        title: 'Session Invalid ❌', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
    onMutate: () => {
      setLoginStatus('testing');
    }
  });

  // Add entity link
  const addEntityLinkMutation = useMutation({
    mutationFn: async () => {
      if (!newFromEntity || !newToEntity) {
        throw new Error('Both source and target entities are required');
      }

      const instanceId = status.instanceId || `live_cloning_${Date.now()}`;
      
      const response = await fetch('/api/live-cloning/entity-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instanceId,
          fromEntity: newFromEntity,
          toEntity: newToEntity
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add entity link');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setEntityLinks([...entityLinks, data.link]);
      setNewFromEntity('');
      setNewToEntity('');
      toast({ 
        title: 'Entity Link Added', 
        description: `Added forwarding from ${newFromEntity} to ${newToEntity}` 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to Add Entity Link', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Add word filter
  const addWordFilterMutation = useMutation({
    mutationFn: async () => {
      if (!newFromWord || !newToWord) {
        throw new Error('Both source and target words are required');
      }

      const instanceId = status.instanceId || `live_cloning_${Date.now()}`;
      
      const response = await fetch('/api/live-cloning/word-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instanceId,
          fromWord: newFromWord,
          toWord: newToWord
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add word filter');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setWordFilters([...wordFilters, data.filter]);
      setNewFromWord('');
      setNewToWord('');
      toast({ 
        title: 'Word Filter Added', 
        description: `Added filter from "${newFromWord}" to "${newToWord}"` 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to Add Word Filter', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Start live cloning mutation
  const startLiveCloningMutation = useMutation({
    mutationFn: async () => {
      if (!sessionString.trim()) {
        throw new Error('Session string is required. Please enter your session string.');
      }

      const response = await fetch('/api/live-cloning/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionString: sessionString.trim(),
          entityLinks: entityLinks.map(link => [link.fromEntity, link.toEntity]),
          wordFilters: wordFilters.map(filter => [filter.fromWord, filter.toWord]),
          settings: {
            botEnabled,
            filterWords,
            addSignature,
            signature
          }
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start live cloning');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: 'Live Cloning Started! 🚀', 
        description: 'Live message cloning has started using your session!' 
      });
      queryClient.invalidateQueries({ queryKey: ['live-cloning-status'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to Start Live Cloning', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Stop live cloning mutation
  const stopLiveCloningMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/live-cloning/stop', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to stop live cloning');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Live Cloning Stopped', description: 'Live message cloning has been stopped.' });
      queryClient.invalidateQueries({ queryKey: ['live-cloning-status'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to Stop Live Cloning', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Clear logs mutation
  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/live-cloning/clear-logs', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clear logs');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Logs Cleared', description: 'All live cloning logs have been cleared successfully.' });
      queryClient.invalidateQueries({ queryKey: ['live-cloning-logs'] });
      queryClient.invalidateQueries({ queryKey: ['live-cloning-status'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to Clear Logs', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Remove entity link
  const removeEntityLink = (index: number) => {
    const updatedLinks = entityLinks.filter((_, i) => i !== index);
    setEntityLinks(updatedLinks);
    toast({ title: 'Entity Link Removed', description: 'Forwarding configuration removed' });
  };

  // Remove word filter
  const removeWordFilter = (index: number) => {
    const updatedFilters = wordFilters.filter((_, i) => i !== index);
    setWordFilters(updatedFilters);
    toast({ title: 'Word Filter Removed', description: 'Filter configuration removed' });
  };

  // Get chat name helper
  const getChatName = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return chatId;
    
    if (chat.username) {
      return `@${chat.username} (${chat.title})`;
    }
    return `${chat.title} (${chat.id})`;
  };

  // Generate Telegram link from chat ID or username
  const getTelegramLink = (chatId: string) => {
    if (chatId.startsWith('@')) {
      return `https://t.me/${chatId.substring(1)}`;
    } else if (chatId.startsWith('-100')) {
      return `https://t.me/c/${chatId.substring(4)}`;
    } else if (chatId.startsWith('-')) {
      return `https://t.me/joinchat/${Math.abs(parseInt(chatId))}`;
    } else {
      return `https://t.me/${chatId}`;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl" data-testid="live-cloning-container">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Live Cloning
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Real-time message cloning between Telegram channels with advanced filtering and customization
        </p>
      </div>

      {/* Status Card */}
      <Card className="border-2" data-testid="status-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Live Cloning Status
            </CardTitle>
            <div className="flex gap-2">
              {status.running && (
                <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                  Running
                </Badge>
              )}
              {status.sessionValid && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Session Valid
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600" data-testid="processed-messages">
                {status.processedMessages}
              </div>
              <div className="text-sm text-muted-foreground">Messages Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600" data-testid="total-links">
                {status.totalLinks}
              </div>
              <div className="text-sm text-muted-foreground">Entity Links</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600" data-testid="bot-status">
                {status.botEnabled ? 'ON' : 'OFF'}
              </div>
              <div className="text-sm text-muted-foreground">Bot Status</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600" data-testid="filter-status">
                {status.filterWords ? 'ON' : 'OFF'}
              </div>
              <div className="text-sm text-muted-foreground">Word Filters</div>
            </div>
          </div>
          
          {status.currentUserInfo && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium" data-testid="current-user">
                  Logged in as {status.currentUserInfo.firstName} (@{status.currentUserInfo.username}) - ID: {status.currentUserInfo.id}
                </span>
              </div>
            </div>
          )}
          
          {status.lastActivity && (
            <div className="mt-2 text-sm text-muted-foreground">
              Last activity: {new Date(status.lastActivity).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session Management */}
        <Card data-testid="session-management-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Session Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="session-string">Telegram Session String</Label>
              <Textarea
                id="session-string"
                placeholder="Enter your Telegram session string..."
                value={sessionString}
                onChange={(e) => setSessionString(e.target.value)}
                className="min-h-[100px] font-mono text-sm"
                data-testid="session-string-input"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => testSessionMutation.mutate()}
                disabled={testSessionMutation.isPending || !sessionString.trim()}
                variant="outline"
                className="flex-1"
                data-testid="test-session-button"
              >
                {testSessionMutation.isPending ? 'Testing...' : 'Test Session'}
                {loginStatus === 'success' && <CheckCircle className="w-4 h-4 ml-2 text-green-600" />}
                {loginStatus === 'error' && <AlertTriangle className="w-4 h-4 ml-2 text-red-600" />}
              </Button>
              
              <Button
                onClick={() => navigator.clipboard.writeText(sessionString)}
                variant="ghost"
                size="icon"
                disabled={!sessionString}
                data-testid="copy-session-button"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            {/* Bot Settings */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Bot Settings
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bot-enabled">Bot Enabled</Label>
                  <Switch
                    id="bot-enabled"
                    checked={botEnabled}
                    onCheckedChange={setBotEnabled}
                    data-testid="bot-enabled-switch"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="filter-words">Filter Words</Label>
                  <Switch
                    id="filter-words"
                    checked={filterWords}
                    onCheckedChange={setFilterWords}
                    data-testid="filter-words-switch"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="add-signature">Add Signature</Label>
                  <Switch
                    id="add-signature"
                    checked={addSignature}
                    onCheckedChange={setAddSignature}
                    data-testid="add-signature-switch"
                  />
                </div>
                
                {addSignature && (
                  <div>
                    <Label htmlFor="signature-text">Signature Text</Label>
                    <Input
                      id="signature-text"
                      placeholder="Enter signature text..."
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      data-testid="signature-text-input"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Control Panel */}
        <Card data-testid="control-panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Control Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {!status.running ? (
                <Button
                  onClick={() => startLiveCloningMutation.mutate()}
                  disabled={startLiveCloningMutation.isPending || !sessionString.trim()}
                  className="w-full bg-green-600 hover:bg-green-700"
                  data-testid="start-button"
                >
                  {startLiveCloningMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Starting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      Start Live Cloning
                    </div>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => stopLiveCloningMutation.mutate()}
                  disabled={stopLiveCloningMutation.isPending}
                  variant="destructive"
                  className="w-full"
                  data-testid="stop-button"
                >
                  {stopLiveCloningMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Stopping...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Square className="w-4 h-4" />
                      Stop Live Cloning
                    </div>
                  )}
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowLogs(!showLogs)}
                variant="outline"
                className="flex-1"
                data-testid="toggle-logs-button"
              >
                <Terminal className="w-4 h-4 mr-2" />
                {showLogs ? 'Hide' : 'Show'} Logs
              </Button>
              
              <Button
                onClick={() => clearLogsMutation.mutate()}
                disabled={clearLogsMutation.isPending}
                variant="ghost"
                size="icon"
                data-testid="clear-logs-button"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="text-lg font-semibold text-purple-600">
                  {entityLinks.length}
                </div>
                <div className="text-xs text-muted-foreground">Entity Links</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-lg font-semibold text-blue-600">
                  {wordFilters.length}
                </div>
                <div className="text-xs text-muted-foreground">Word Filters</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entity Links Management */}
      <Card data-testid="entity-links-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Entity Links ({entityLinks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Entity Link Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="from-entity">From Entity (Source)</Label>
              {chatsLoading ? (
                <div className="text-sm text-muted-foreground">Loading chats...</div>
              ) : (
                <Select value={newFromEntity} onValueChange={setNewFromEntity} data-testid="from-entity-select">
                  <SelectTrigger id="from-entity">
                    <SelectValue placeholder="Select source chat" />
                  </SelectTrigger>
                  <SelectContent>
                    {chats.map((chat) => (
                      <SelectItem key={chat.id} value={chat.id}>
                        {getChatName(chat.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="to-entity">To Entity (Target)</Label>
              {chatsLoading ? (
                <div className="text-sm text-muted-foreground">Loading chats...</div>
              ) : (
                <Select value={newToEntity} onValueChange={setNewToEntity} data-testid="to-entity-select">
                  <SelectTrigger id="to-entity">
                    <SelectValue placeholder="Select target chat" />
                  </SelectTrigger>
                  <SelectContent>
                    {chats.map((chat) => (
                      <SelectItem key={chat.id} value={chat.id}>
                        {getChatName(chat.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={() => addEntityLinkMutation.mutate()}
                disabled={addEntityLinkMutation.isPending || !newFromEntity || !newToEntity}
                className="w-full"
                data-testid="add-entity-link-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            </div>
          </div>

          {/* Entity Links List */}
          <div className="space-y-2">
            {entityLinks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-entity-links">
                <Link className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No entity links configured</p>
                <p className="text-sm">Add forwarding rules between channels above</p>
              </div>
            ) : (
              entityLinks.map((link, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-card" data-testid={`entity-link-${index}`}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 flex-1">
                      <Badge variant="outline" className="text-xs">
                        FROM
                      </Badge>
                      <span className="font-mono text-sm truncate">
                        {getChatName(link.fromEntity)}
                      </span>
                    </div>
                    <div className="px-2">
                      <span className="text-muted-foreground">→</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <Badge variant="outline" className="text-xs">
                        TO
                      </Badge>
                      <span className="font-mono text-sm truncate">
                        {getChatName(link.toEntity)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={link.isActive ? "default" : "secondary"} className="text-xs">
                      {link.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      onClick={() => removeEntityLink(index)}
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      data-testid={`remove-entity-link-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Word Filters Management */}
      <Card data-testid="word-filters-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Word Filters ({wordFilters.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Word Filter Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="from-word">From Word</Label>
              <Input
                id="from-word"
                placeholder="Original word/phrase"
                value={newFromWord}
                onChange={(e) => setNewFromWord(e.target.value)}
                data-testid="from-word-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="to-word">To Word</Label>
              <Input
                id="to-word"
                placeholder="Replacement word/phrase"
                value={newToWord}
                onChange={(e) => setNewToWord(e.target.value)}
                data-testid="to-word-input"
              />
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={() => addWordFilterMutation.mutate()}
                disabled={addWordFilterMutation.isPending || !newFromWord || !newToWord}
                className="w-full"
                data-testid="add-word-filter-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Filter
              </Button>
            </div>
          </div>

          {/* Word Filters List */}
          <div className="space-y-2">
            {wordFilters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-word-filters">
                <Filter className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No word filters configured</p>
                <p className="text-sm">Add text replacement rules above</p>
              </div>
            ) : (
              wordFilters.map((filter, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-card" data-testid={`word-filter-${index}`}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 flex-1">
                      <Badge variant="outline" className="text-xs">
                        FROM
                      </Badge>
                      <span className="font-mono text-sm">"{filter.fromWord}"</span>
                    </div>
                    <div className="px-2">
                      <span className="text-muted-foreground">→</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <Badge variant="outline" className="text-xs">
                        TO
                      </Badge>
                      <span className="font-mono text-sm">"{filter.toWord}"</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={filter.isActive ? "default" : "secondary"} className="text-xs">
                      {filter.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      onClick={() => removeWordFilter(index)}
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      data-testid={`remove-word-filter-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      {showLogs && (
        <Card data-testid="logs-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Live Cloning Logs
              {logsData?.logs?.length > 0 && (
                <Badge variant="secondary">{logsData.logs.length} entries</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-64 overflow-y-auto whitespace-pre-wrap" data-testid="logs-container">
              {logsData?.logs?.length > 0 ? (
                logsData.logs.join('\n')
              ) : (
                <div className="text-gray-500">No logs available. Start live cloning to see logs here.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}