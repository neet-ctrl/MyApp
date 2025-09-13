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
  MessageSquare, Users, Zap, Eye, BarChart3, Clock, UserCheck,
  Shield, Database, Wifi, AlertCircle, TrendingUp, MessageCircle,
  Hash, FileText, Image, Video, AudioLines, Archive
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/lib/storage';
import { formatChatToTelegramEntity, parseEntityInput, validateTelegramEntity, getSuggestedEntityFormat, createEntityDisplayName } from '@/lib/telegram-entity-formatter';
import type { Chat, EntityLink, WordFilter } from '@shared/schema';

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
  // Advanced monitoring data
  performance: {
    messagesPerMinute: number;
    averageProcessingTime: number;
    successRate: number;
    errorCount: number;
    uptime: number;
  };
  statistics: {
    totalProcessed: number;
    totalFiltered: number;
    totalForwarded: number;
    mediaProcessed: number;
    textProcessed: number;
    errorMessages: number;
  };
  activeUsers: Array<{
    id: number;
    username: string;
    lastSeen: string;
    messageCount: number;
  }>;
  messageTypes: {
    text: number;
    photo: number;
    video: number;
    audio: number;
    document: number;
    sticker: number;
    voice: number;
  };
  recentActivity: Array<{
    timestamp: string;
    type: 'message' | 'filter' | 'forward' | 'error';
    description: string;
    fromEntity?: string;
    toEntity?: string;
  }>;
}

export function LiveCloning() {
  const [sessionString, setSessionString] = useState('1BVtsOLABux3cdf9iA7_7csD0HjZ-vqy3pQUfbynyLah5ZQQNGCTgc6ao1FOFHur4mvJkRsrzS3KKi65RNXczTxtlxpNIkqoIQvN0ILt2kPp9dUcCuIn8ZlFftx63derTrb_LS6TdeZ4Ly3cI26C_E14TUvhlWNHwB_zDZ1mvpvluQb9EhodVRsWSAQimUWNIrKp9stJum7amnoLzCSdqAydjsfTXej1KZQ1TfxX79yAb-DPIw2kzFWf6Mk9ScDlTeGJg6qRQkiDOHiRrUnrzle1REurAN_4h9qWahhR1ffbreGvOYVDip35Uya4Kn4YGmJM0vtGLq3HoEico3umwBrO6GOc0oxU=');
  const [entityLinks, setEntityLinks] = useState<EntityLink[]>([]);
  const [wordFilters, setWordFilters] = useState<WordFilter[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
  // Entity Link Form
  const [newFromEntity, setNewFromEntity] = useState('');
  const [newToEntity, setNewToEntity] = useState('');
  const [manualFromEntity, setManualFromEntity] = useState('');
  const [manualToEntity, setManualToEntity] = useState('');
  const [useManualInput, setUseManualInput] = useState(false);
  
  // Word Filter Form
  const [newFromWord, setNewFromWord] = useState('');
  const [newToWord, setNewToWord] = useState('');
  
  // Edit states
  const [editingEntityLink, setEditingEntityLink] = useState<EntityLink | null>(null);
  const [editingWordFilter, setEditingWordFilter] = useState<WordFilter | null>(null);
  
  // Bot Settings
  const [botEnabled, setBotEnabled] = useState(true);
  const [filterWords, setFilterWords] = useState(true);
  const [addSignature, setAddSignature] = useState(false);
  const [signature, setSignature] = useState('');
  
  // Advanced Settings
  const [showAdvancedMonitoring, setShowAdvancedMonitoring] = useState(true);
  const [showPerformanceStats, setShowPerformanceStats] = useState(false);
  const [showActiveUsers, setShowActiveUsers] = useState(false);
  const [showRecentActivity, setShowRecentActivity] = useState(false);
  const [messageTypeFilter, setMessageTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [performanceThreshold, setPerformanceThreshold] = useState(90);
  
  // Advanced Bot Features
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preserveFormatting, setPreserveFormatting] = useState(true);
  const [forwardMedia, setForwardMedia] = useState(true);
  const [forwardStickers, setForwardStickers] = useState(false);
  const [forwardVoice, setForwardVoice] = useState(true);
  const [maxMessageLength, setMaxMessageLength] = useState(4096);
  const [delayBetweenMessages, setDelayBetweenMessages] = useState(1);
  const [retryFailedMessages, setRetryFailedMessages] = useState(true);
  const [logLevel, setLogLevel] = useState('INFO');

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
    logs: [],
    performance: {
      messagesPerMinute: 0,
      averageProcessingTime: 0,
      successRate: 0,
      errorCount: 0,
      uptime: 0
    },
    statistics: {
      totalProcessed: 0,
      totalFiltered: 0,
      totalForwarded: 0,
      mediaProcessed: 0,
      textProcessed: 0,
      errorMessages: 0
    },
    activeUsers: [],
    messageTypes: {
      text: 0,
      photo: 0,
      video: 0,
      audio: 0,
      document: 0,
      sticker: 0,
      voice: 0
    },
    recentActivity: []
  };

  // Fetch existing entity links for the current instance
  const { data: entityLinksData } = useQuery({
    queryKey: ['entity-links', status.instanceId],
    queryFn: async () => {
      if (!status.instanceId) return { links: [] };
      const response = await fetch(`/api/live-cloning/entity-links/${status.instanceId}`);
      if (!response.ok) throw new Error('Failed to fetch entity links');
      return response.json();
    },
    enabled: !!status.instanceId,
  });

  // Fetch existing word filters for the current instance
  const { data: wordFiltersData } = useQuery({
    queryKey: ['word-filters', status.instanceId],
    queryFn: async () => {
      if (!status.instanceId) return { filters: [] };
      const response = await fetch(`/api/live-cloning/word-filters/${status.instanceId}`);
      if (!response.ok) throw new Error('Failed to fetch word filters');
      return response.json();
    },
    enabled: !!status.instanceId,
  });

  // Update local state when data is fetched
  useEffect(() => {
    if (entityLinksData?.links) {
      setEntityLinks(entityLinksData.links);
    }
  }, [entityLinksData]);

  useEffect(() => {
    if (wordFiltersData?.filters) {
      setWordFilters(wordFiltersData.filters);
    }
  }, [wordFiltersData]);

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

  // Settings mutations
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { botEnabled?: boolean; filterWords?: boolean; addSignature?: boolean; signature?: string }) => {
      const response = await fetch('/api/live-cloning/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Bot settings updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['live-cloning-status'] });
      queryClient.invalidateQueries({ queryKey: ['live-cloning-settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Settings",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Load settings from backend
  const { data: settingsData } = useQuery({
    queryKey: ['live-cloning-settings'],
    queryFn: async () => {
      const response = await fetch('/api/live-cloning/settings');
      return response.json();
    },
    enabled: true
  });

  // Update local state when backend settings change
  useEffect(() => {
    if (settingsData?.settings) {
      const { botEnabled: backendBotEnabled, filterWords: backendFilterWords, addSignature: backendAddSignature, signature: backendSignature } = settingsData.settings;
      if (typeof backendBotEnabled === 'boolean') setBotEnabled(backendBotEnabled);
      if (typeof backendFilterWords === 'boolean') setFilterWords(backendFilterWords);
      if (typeof backendAddSignature === 'boolean') setAddSignature(backendAddSignature);
      if (typeof backendSignature === 'string') setSignature(backendSignature);
    }
  }, [settingsData]);

  // Add entity link
  const addEntityLinkMutation = useMutation({
    mutationFn: async () => {
      if (!newFromEntity || !newToEntity) {
        throw new Error('Both source and target entities are required');
      }

      // Format entity IDs to proper Telegram format
      let formattedFromEntity, formattedToEntity;
      
      if (useManualInput) {
        // Handle manual input - parse and validate the entered entities
        formattedFromEntity = parseEntityInput(manualFromEntity);
        formattedToEntity = parseEntityInput(manualToEntity);
      } else {
        // Handle dropdown selection - find and format chats
        const fromChat = chats.find(c => c.id === newFromEntity);
        const toChat = chats.find(c => c.id === newToEntity);
        
        if (!fromChat || !toChat) {
          throw new Error('Selected chats not found');
        }
        
        formattedFromEntity = formatChatToTelegramEntity(fromChat);
        formattedToEntity = formatChatToTelegramEntity(toChat);
      }
      
      // Validate the formatted entity IDs
      if (!validateTelegramEntity(formattedFromEntity.id)) {
        throw new Error(`Invalid source entity format: ${formattedFromEntity.id}. ${getSuggestedEntityFormat(formattedFromEntity.id)}`);
      }
      
      if (!validateTelegramEntity(formattedToEntity.id)) {
        throw new Error(`Invalid target entity format: ${formattedToEntity.id}. ${getSuggestedEntityFormat(formattedToEntity.id)}`);
      }

      const instanceId = status.instanceId || `live_cloning_${Date.now()}`;
      
      const response = await fetch('/api/live-cloning/entity-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instanceId,
          fromEntity: formattedFromEntity.id,
          toEntity: formattedToEntity.id
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
          entityLinks: (entityLinks || []).map(link => [link.fromEntity, link.toEntity]),
          wordFilters: (wordFilters || []).map(filter => [filter.fromWord, filter.toWord]),
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

  // Remove entity link mutation
  const removeEntityLinkMutation = useMutation({
    mutationFn: async (linkId: number) => {
      const response = await fetch(`/api/live-cloning/entity-links/${linkId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete entity link');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch entity links and invalidate cache
      queryClient.invalidateQueries({ queryKey: ['entity-links', status.instanceId] });
      toast({ title: 'Entity Link Removed', description: 'Forwarding configuration removed successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to Remove Entity Link', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Remove word filter mutation
  const removeWordFilterMutation = useMutation({
    mutationFn: async (filterId: number) => {
      const response = await fetch(`/api/live-cloning/word-filters/${filterId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete word filter');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch word filters and invalidate cache
      queryClient.invalidateQueries({ queryKey: ['word-filters', status.instanceId] });
      toast({ title: 'Word Filter Removed', description: 'Filter configuration removed successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to Remove Word Filter', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Remove entity link
  const removeEntityLink = (link: EntityLink) => {
    if (link.id) {
      removeEntityLinkMutation.mutate(link.id);
    } else {
      // For local-only links, remove from local state
      const updatedLinks = entityLinks.filter((l) => l !== link);
      setEntityLinks(updatedLinks);
      toast({ title: 'Entity Link Removed', description: 'Forwarding configuration removed' });
    }
  };

  // Remove word filter
  const removeWordFilter = (filter: WordFilter) => {
    if (filter.id) {
      removeWordFilterMutation.mutate(filter.id);
    } else {
      // For local-only filters, remove from local state
      const updatedFilters = wordFilters.filter((f) => f !== filter);
      setWordFilters(updatedFilters);
      toast({ title: 'Word Filter Removed', description: 'Filter configuration removed' });
    }
  };

  // Edit entity link mutation
  const editEntityLinkMutation = useMutation({
    mutationFn: async (link: EntityLink) => {
      if (!link.id) throw new Error('Cannot edit entity link without ID');
      
      const response = await fetch(`/api/live-cloning/entity-links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEntity: link.fromEntity,
          toEntity: link.toEntity,
          isActive: link.isActive
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update entity link');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setEditingEntityLink(null);
      queryClient.invalidateQueries({ queryKey: ['entity-links', status.instanceId] });
      toast({ title: 'Entity Link Updated', description: 'Forwarding configuration updated successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to Update Entity Link', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Edit word filter mutation
  const editWordFilterMutation = useMutation({
    mutationFn: async (filter: WordFilter) => {
      if (!filter.id) throw new Error('Cannot edit word filter without ID');
      
      const response = await fetch(`/api/live-cloning/word-filters/${filter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWord: filter.fromWord,
          toWord: filter.toWord,
          isActive: filter.isActive
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update word filter');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setEditingWordFilter(null);
      queryClient.invalidateQueries({ queryKey: ['word-filters', status.instanceId] });
      toast({ title: 'Word Filter Updated', description: 'Filter configuration updated successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to Update Word Filter', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Start editing entity link
  const startEditEntityLink = (link: EntityLink) => {
    setEditingEntityLink({...link});
  };

  // Start editing word filter
  const startEditWordFilter = (filter: WordFilter) => {
    setEditingWordFilter({...filter});
  };

  // Save entity link edit
  const saveEntityLinkEdit = () => {
    if (editingEntityLink) {
      editEntityLinkMutation.mutate(editingEntityLink);
    }
  };

  // Save word filter edit
  const saveWordFilterEdit = () => {
    if (editingWordFilter) {
      editWordFilterMutation.mutate(editingWordFilter);
    }
  };

  // Cancel entity link edit
  const cancelEntityLinkEdit = () => {
    setEditingEntityLink(null);
  };

  // Cancel word filter edit
  const cancelWordFilterEdit = () => {
    setEditingWordFilter(null);
  };

  // Get chat name helper with proper Telegram entity formatting
  const getChatName = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      // If not found in chats, try to parse as entity format
      const entityInfo = parseEntityInput(chatId);
      return entityInfo.isValid ? createEntityDisplayName(entityInfo) : `Unknown (${chatId})`;
    }
    
    const entityInfo = formatChatToTelegramEntity(chat);
    return createEntityDisplayName(entityInfo, chat);
  };
  
  // Get properly formatted entity ID for a chat
  const getFormattedEntityId = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      return parseEntityInput(chatId).id;
    }
    return formatChatToTelegramEntity(chat).id;
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
                    onCheckedChange={(checked) => {
                      setBotEnabled(checked);
                      updateSettingsMutation.mutate({ botEnabled: checked });
                    }}
                    data-testid="bot-enabled-switch"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="filter-words">Filter Words</Label>
                  <Switch
                    id="filter-words"
                    checked={filterWords}
                    onCheckedChange={(checked) => {
                      setFilterWords(checked);
                      updateSettingsMutation.mutate({ filterWords: checked });
                    }}
                    data-testid="filter-words-switch"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="add-signature">Add Signature</Label>
                  <Switch
                    id="add-signature"
                    checked={addSignature}
                    onCheckedChange={(checked) => {
                      setAddSignature(checked);
                      updateSettingsMutation.mutate({ addSignature: checked });
                    }}
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
                      onChange={(e) => {
                        setSignature(e.target.value);
                        // Debounce the API call to avoid too many requests
                        setTimeout(() => {
                          updateSettingsMutation.mutate({ signature: e.target.value });
                        }, 1000);
                      }}
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
                  {entityLinks?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Entity Links</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-lg font-semibold text-blue-600">
                  {wordFilters?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Word Filters</div>
              </div>
            </div>
            
            {/* Advanced Monitoring Toggle */}
            <div className="pt-4 border-t">
              <Button
                onClick={() => setShowAdvancedMonitoring(!showAdvancedMonitoring)}
                variant="outline"
                className="w-full"
                data-testid="toggle-advanced-monitoring"
              >
                <Eye className="w-4 h-4 mr-2" />
                {showAdvancedMonitoring ? 'Hide' : 'Show'} Advanced Monitoring
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Monitoring Dashboard */}
      {showAdvancedMonitoring && (
        <>
          {/* Performance Metrics */}
          <Card data-testid="performance-metrics-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Performance Metrics
                <Button
                  onClick={() => setShowPerformanceStats(!showPerformanceStats)}
                  variant="ghost"
                  size="sm"
                >
                  <TrendingUp className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-lg font-semibold text-green-600">
                    {status.performance?.messagesPerMinute?.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-xs text-muted-foreground">Messages/Min</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-lg font-semibold text-blue-600">
                    {status.performance?.averageProcessingTime?.toFixed(2) || '0.00'}ms
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Processing</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="text-lg font-semibold text-purple-600">
                    {status.performance?.successRate?.toFixed(1) || '0.0'}%
                  </div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="text-lg font-semibold text-orange-600">
                    {Math.floor((status.performance?.uptime || 0) / 3600)}h {Math.floor(((status.performance?.uptime || 0) % 3600) / 60)}m
                  </div>
                  <div className="text-xs text-muted-foreground">Uptime</div>
                </div>
              </div>
              
              {showPerformanceStats && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Message Statistics</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Total Processed:</span>
                          <span className="font-mono">{status.statistics?.totalProcessed || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Filtered:</span>
                          <span className="font-mono">{status.statistics?.totalFiltered || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Forwarded:</span>
                          <span className="font-mono">{status.statistics?.totalForwarded || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Media Statistics</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Media Files:</span>
                          <span className="font-mono">{status.statistics?.mediaProcessed || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Text Messages:</span>
                          <span className="font-mono">{status.statistics?.textProcessed || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Errors:</span>
                          <span className="font-mono text-red-600">{status.statistics?.errorMessages || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Performance Alerts</div>
                      <div className="space-y-1">
                        {(status.performance?.successRate || 0) < performanceThreshold && (
                          <div className="flex items-center gap-2 text-sm text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            Low success rate
                          </div>
                        )}
                        {(status.performance?.errorCount || 0) > 10 && (
                          <div className="flex items-center gap-2 text-sm text-yellow-600">
                            <AlertTriangle className="w-4 h-4" />
                            High error count
                          </div>
                        )}
                        {(status.performance?.messagesPerMinute || 0) > 100 && (
                          <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            High throughput
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message Types Distribution */}
          <Card data-testid="message-types-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Message Types Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium">{status.messageTypes?.text || 0}</div>
                    <div className="text-xs text-muted-foreground">Text</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded">
                  <Image className="w-4 h-4 text-green-600" />
                  <div>
                    <div className="text-sm font-medium">{status.messageTypes?.photo || 0}</div>
                    <div className="text-xs text-muted-foreground">Photos</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950 rounded">
                  <Video className="w-4 h-4 text-purple-600" />
                  <div>
                    <div className="text-sm font-medium">{status.messageTypes?.video || 0}</div>
                    <div className="text-xs text-muted-foreground">Videos</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950 rounded">
                  <AudioLines className="w-4 h-4 text-orange-600" />
                  <div>
                    <div className="text-sm font-medium">{status.messageTypes?.audio || 0}</div>
                    <div className="text-xs text-muted-foreground">Audio</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 rounded">
                  <Archive className="w-4 h-4 text-red-600" />
                  <div>
                    <div className="text-sm font-medium">{status.messageTypes?.document || 0}</div>
                    <div className="text-xs text-muted-foreground">Documents</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                  <MessageCircle className="w-4 h-4 text-yellow-600" />
                  <div>
                    <div className="text-sm font-medium">{status.messageTypes?.sticker || 0}</div>
                    <div className="text-xs text-muted-foreground">Stickers</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-950 rounded">
                  <AudioLines className="w-4 h-4 text-indigo-600" />
                  <div>
                    <div className="text-sm font-medium">{status.messageTypes?.voice || 0}</div>
                    <div className="text-xs text-muted-foreground">Voice</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Users Monitoring */}
          <Card data-testid="active-users-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Active Users ({status.activeUsers?.length || 0})
                <Button
                  onClick={() => setShowActiveUsers(!showActiveUsers)}
                  variant="ghost"
                  size="sm"
                >
                  <UserCheck className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showActiveUsers && (status.activeUsers?.length || 0) > 0 ? (
                <div className="space-y-2">
                  {(status.activeUsers || []).map((user, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">
                            {user.username?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">@{user.username}</div>
                          <div className="text-sm text-muted-foreground">ID: {user.id}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{user.messageCount} messages</div>
                        <div className="text-xs text-muted-foreground">
                          Last seen: {new Date(user.lastSeen).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No active users detected</p>
                  <p className="text-sm">Start live cloning to monitor user activity</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card data-testid="recent-activity-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Activity ({status.recentActivity?.length || 0})
                <Button
                  onClick={() => setShowRecentActivity(!showRecentActivity)}
                  variant="ghost"
                  size="sm"
                >
                  <Activity className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showRecentActivity && (status.recentActivity?.length || 0) > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(status.recentActivity || []).slice(0, 20).map((activity, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 border-l-2 border-blue-200 dark:border-blue-800 pl-3">
                      <div className="flex-shrink-0 mt-1">
                        {activity.type === 'message' && <MessageSquare className="w-4 h-4 text-blue-600" />}
                        {activity.type === 'filter' && <Filter className="w-4 h-4 text-purple-600" />}
                        {activity.type === 'forward' && <Link className="w-4 h-4 text-green-600" />}
                        {activity.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{activity.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                          {activity.fromEntity && ` • From: ${activity.fromEntity}`}
                          {activity.toEntity && ` • To: ${activity.toEntity}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No recent activity</p>
                  <p className="text-sm">Activity will appear here when live cloning is running</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced Bot Settings */}
          <Card data-testid="advanced-settings-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Advanced Bot Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Message Processing Settings */}
              <div className="space-y-4">
                <div className="text-sm font-medium">Message Processing</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="skip-duplicates">Skip Duplicate Messages</Label>
                    <Switch
                      id="skip-duplicates"
                      checked={skipDuplicates}
                      onCheckedChange={setSkipDuplicates}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="preserve-formatting">Preserve Formatting</Label>
                    <Switch
                      id="preserve-formatting"
                      checked={preserveFormatting}
                      onCheckedChange={setPreserveFormatting}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="retry-failed">Retry Failed Messages</Label>
                    <Switch
                      id="retry-failed"
                      checked={retryFailedMessages}
                      onCheckedChange={setRetryFailedMessages}
                    />
                  </div>
                </div>
              </div>

              {/* Media Settings */}
              <div className="space-y-4">
                <div className="text-sm font-medium">Media Forwarding</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="forward-media">Forward Media Files</Label>
                    <Switch
                      id="forward-media"
                      checked={forwardMedia}
                      onCheckedChange={setForwardMedia}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="forward-stickers">Forward Stickers</Label>
                    <Switch
                      id="forward-stickers"
                      checked={forwardStickers}
                      onCheckedChange={setForwardStickers}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="forward-voice">Forward Voice Messages</Label>
                    <Switch
                      id="forward-voice"
                      checked={forwardVoice}
                      onCheckedChange={setForwardVoice}
                    />
                  </div>
                </div>
              </div>

              {/* Performance Settings */}
              <div className="space-y-4">
                <div className="text-sm font-medium">Performance Settings</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-message-length">Max Message Length</Label>
                    <Input
                      id="max-message-length"
                      type="number"
                      value={maxMessageLength}
                      onChange={(e) => setMaxMessageLength(parseInt(e.target.value))}
                      min={1}
                      max={4096}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delay-messages">Delay Between Messages (seconds)</Label>
                    <Input
                      id="delay-messages"
                      type="number"
                      value={delayBetweenMessages}
                      onChange={(e) => setDelayBetweenMessages(parseFloat(e.target.value))}
                      min={0}
                      step={0.1}
                    />
                  </div>
                </div>
              </div>

              {/* Monitoring Settings */}
              <div className="space-y-4">
                <div className="text-sm font-medium">Monitoring & Alerts</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="alerts-enabled">Enable Performance Alerts</Label>
                    <Switch
                      id="alerts-enabled"
                      checked={alertsEnabled}
                      onCheckedChange={setAlertsEnabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="performance-threshold">Performance Threshold (%)</Label>
                    <Input
                      id="performance-threshold"
                      type="number"
                      value={performanceThreshold}
                      onChange={(e) => setPerformanceThreshold(parseInt(e.target.value))}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="log-level">Log Level</Label>
                    <Select value={logLevel} onValueChange={setLogLevel}>
                      <SelectTrigger id="log-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEBUG">DEBUG</SelectItem>
                        <SelectItem value="INFO">INFO</SelectItem>
                        <SelectItem value="WARNING">WARNING</SelectItem>
                        <SelectItem value="ERROR">ERROR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Entity Links Management */}
      <Card data-testid="entity-links-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Entity Links ({entityLinks?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enhanced Entity Link Form with Manual Input & Validation */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            {/* Input Mode Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Entity Link Configuration</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="manual-input" className="text-sm">Manual Input</Label>
                <Switch
                  id="manual-input"
                  checked={useManualInput}
                  onCheckedChange={(checked) => {
                    setUseManualInput(checked);
                    if (checked) {
                      setNewFromEntity('');
                      setNewToEntity('');
                    } else {
                      setManualFromEntity('');
                      setManualToEntity('');
                    }
                  }}
                  data-testid="manual-input-toggle"
                />
              </div>
            </div>
            
            {!useManualInput ? (
              /* Dropdown Selection Mode */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                        {chats.map((chat) => {
                          const entityInfo = formatChatToTelegramEntity(chat);
                          return (
                            <SelectItem key={chat.id} value={chat.id}>
                              {createEntityDisplayName(entityInfo, chat)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {newFromEntity && (
                    <div className="text-xs text-muted-foreground">
                      Formatted ID: <code className="bg-muted px-1 rounded">{getFormattedEntityId(newFromEntity)}</code>
                    </div>
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
                        {chats.map((chat) => {
                          const entityInfo = formatChatToTelegramEntity(chat);
                          return (
                            <SelectItem key={chat.id} value={chat.id}>
                              {createEntityDisplayName(entityInfo, chat)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {newToEntity && (
                    <div className="text-xs text-muted-foreground">
                      Formatted ID: <code className="bg-muted px-1 rounded">{getFormattedEntityId(newToEntity)}</code>
                    </div>
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
            ) : (
              /* Manual Input Mode */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="manual-from-entity">From Entity (Source)</Label>
                  <Input
                    id="manual-from-entity"
                    placeholder="@username or -100123456789"
                    value={manualFromEntity}
                    onChange={(e) => setManualFromEntity(e.target.value)}
                    data-testid="manual-from-entity-input"
                    className={`font-mono ${
                      manualFromEntity && !validateTelegramEntity(parseEntityInput(manualFromEntity).id)
                        ? 'border-red-500 focus:border-red-500'
                        : manualFromEntity
                        ? 'border-green-500 focus:border-green-500'
                        : ''
                    }`}
                  />
                  {manualFromEntity && (
                    <div className="text-xs">
                      {validateTelegramEntity(parseEntityInput(manualFromEntity).id) ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Valid: <code className="bg-green-50 px-1 rounded">{parseEntityInput(manualFromEntity).id}</code>
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {getSuggestedEntityFormat(manualFromEntity)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="manual-to-entity">To Entity (Target)</Label>
                  <Input
                    id="manual-to-entity"
                    placeholder="@username or -100123456789"
                    value={manualToEntity}
                    onChange={(e) => setManualToEntity(e.target.value)}
                    data-testid="manual-to-entity-input"
                    className={`font-mono ${
                      manualToEntity && !validateTelegramEntity(parseEntityInput(manualToEntity).id)
                        ? 'border-red-500 focus:border-red-500'
                        : manualToEntity
                        ? 'border-green-500 focus:border-green-500'
                        : ''
                    }`}
                  />
                  {manualToEntity && (
                    <div className="text-xs">
                      {validateTelegramEntity(parseEntityInput(manualToEntity).id) ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Valid: <code className="bg-green-50 px-1 rounded">{parseEntityInput(manualToEntity).id}</code>
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {getSuggestedEntityFormat(manualToEntity)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-end">
                  <Button
                    onClick={() => {
                      // Set the parsed entity IDs for manual input
                      const fromEntityId = parseEntityInput(manualFromEntity).id;
                      const toEntityId = parseEntityInput(manualToEntity).id;
                      
                      if (!validateTelegramEntity(fromEntityId) || !validateTelegramEntity(toEntityId)) {
                        toast({
                          title: 'Invalid Entity Format',
                          description: 'Please fix the invalid entity formats before adding.',
                          variant: 'destructive'
                        });
                        return;
                      }
                      
                      // Create temporary entity objects for the mutation
                      setNewFromEntity(fromEntityId);
                      setNewToEntity(toEntityId);
                      
                      // Trigger the mutation after a short delay to let state update
                      setTimeout(() => {
                        addEntityLinkMutation.mutate();
                      }, 100);
                    }}
                    disabled={
                      addEntityLinkMutation.isPending || 
                      !manualFromEntity || 
                      !manualToEntity ||
                      !validateTelegramEntity(parseEntityInput(manualFromEntity).id) ||
                      !validateTelegramEntity(parseEntityInput(manualToEntity).id)
                    }
                    className="w-full"
                    data-testid="add-manual-entity-link-button"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Link
                  </Button>
                </div>
              </div>
            )}
            
            {/* Format Guide */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">✅ Supported Entity Formats (100% Telegram Compatible)</div>
              <div className="text-xs text-blue-700 dark:text-blue-200 space-y-1">
                <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">@username</code> - Public channels/groups with username</div>
                <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">-100123456789</code> - Private supergroups and channels</div>
                <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">123456789</code> - User IDs (private chats)</div>
                <div className="text-blue-600 dark:text-blue-300 text-xs mt-2">💡 These formats are automatically validated and will work 100% with Telegram forwarding, just like the Python copier!</div>
              </div>
            </div>
          </div>

          {/* Entity Links List */}
          <div className="space-y-2">
            {(entityLinks?.length || 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-entity-links">
                <Link className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No entity links configured</p>
                <p className="text-sm">Add forwarding rules between channels above</p>
              </div>
            ) : (
              entityLinks.map((link, index) => (
                <div key={index} className="border rounded-lg bg-card" data-testid={`entity-link-${index}`}>
                  {editingEntityLink?.id === link.id ? (
                    // Edit mode
                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>From Entity (Source)</Label>
                          <Select 
                            value={editingEntityLink?.fromEntity || ''} 
                            onValueChange={(value) => editingEntityLink && setEditingEntityLink({
                              ...editingEntityLink, 
                              fromEntity: value,
                              instanceId: editingEntityLink.instanceId || status.instanceId || '',
                              toEntity: editingEntityLink.toEntity || '',
                              isActive: editingEntityLink.isActive ?? true
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {chats.map((chat) => (
                                <SelectItem key={chat.id} value={chat.id}>
                                  {getChatName(chat.id)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>To Entity (Target)</Label>
                          <Select 
                            value={editingEntityLink?.toEntity || ''} 
                            onValueChange={(value) => editingEntityLink && setEditingEntityLink({
                              ...editingEntityLink, 
                              toEntity: value,
                              instanceId: editingEntityLink.instanceId || status.instanceId || '',
                              fromEntity: editingEntityLink.fromEntity || '',
                              isActive: editingEntityLink.isActive ?? true
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {chats.map((chat) => (
                                <SelectItem key={chat.id} value={chat.id}>
                                  {getChatName(chat.id)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editingEntityLink?.isActive ?? false}
                            onCheckedChange={(checked) => editingEntityLink && setEditingEntityLink({
                              ...editingEntityLink, 
                              isActive: checked,
                              instanceId: editingEntityLink.instanceId || status.instanceId || '',
                              fromEntity: editingEntityLink.fromEntity || '',
                              toEntity: editingEntityLink.toEntity || ''
                            })}
                          />
                          <Label>Active</Label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={saveEntityLinkEdit}
                            size="sm"
                            disabled={editEntityLinkMutation.isPending}
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            onClick={cancelEntityLinkEdit}
                            size="sm"
                            variant="outline"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between p-3">
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
                        {link.id && (
                          <Button
                            onClick={() => startEditEntityLink(link)}
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            data-testid={`edit-entity-link-${index}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          onClick={() => removeEntityLink(link)}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          data-testid={`remove-entity-link-${index}`}
                          disabled={removeEntityLinkMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
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
            Word Filters ({wordFilters?.length || 0})
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
            {(wordFilters?.length || 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-word-filters">
                <Filter className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No word filters configured</p>
                <p className="text-sm">Add text replacement rules above</p>
              </div>
            ) : (
              wordFilters.map((filter, index) => (
                <div key={index} className="border rounded-lg bg-card" data-testid={`word-filter-${index}`}>
                  {editingWordFilter?.id === filter.id ? (
                    // Edit mode
                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>From Word</Label>
                          <Input
                            value={editingWordFilter?.fromWord || ''}
                            onChange={(e) => editingWordFilter && setEditingWordFilter({
                              ...editingWordFilter,
                              fromWord: e.target.value,
                              instanceId: editingWordFilter.instanceId || status.instanceId || '',
                              toWord: editingWordFilter.toWord || '',
                              isActive: editingWordFilter.isActive ?? true
                            })}
                            placeholder="Original word/phrase"
                          />
                        </div>
                        <div>
                          <Label>To Word</Label>
                          <Input
                            value={editingWordFilter?.toWord || ''}
                            onChange={(e) => editingWordFilter && setEditingWordFilter({
                              ...editingWordFilter,
                              toWord: e.target.value,
                              instanceId: editingWordFilter.instanceId || status.instanceId || '',
                              fromWord: editingWordFilter.fromWord || '',
                              isActive: editingWordFilter.isActive ?? true
                            })}
                            placeholder="Replacement word/phrase"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editingWordFilter?.isActive ?? false}
                            onCheckedChange={(checked) => editingWordFilter && setEditingWordFilter({
                              ...editingWordFilter,
                              isActive: checked,
                              instanceId: editingWordFilter.instanceId || status.instanceId || '',
                              fromWord: editingWordFilter.fromWord || '',
                              toWord: editingWordFilter.toWord || ''
                            })}
                          />
                          <Label>Active</Label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={saveWordFilterEdit}
                            size="sm"
                            disabled={editWordFilterMutation.isPending}
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            onClick={cancelWordFilterEdit}
                            size="sm"
                            variant="outline"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between p-3">
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
                        {filter.id && (
                          <Button
                            onClick={() => startEditWordFilter(filter)}
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            data-testid={`edit-word-filter-${index}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          onClick={() => removeWordFilter(filter)}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          data-testid={`remove-word-filter-${index}`}
                          disabled={removeWordFilterMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
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