import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Copy, 
  Eye, 
  EyeOff, 
  MoreVertical, 
  Info, 
  Download, 
  Plus,
  History,
  Trash2,
  Save,
  RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface HardcodedValue {
  id: string;
  title: string;
  value: string;
  category: string;
  description: string;
  locations: string[];
  type: 'api_key' | 'session_string' | 'phone' | 'url' | 'token' | 'config' | 'other';
  sensitive: boolean;
}

interface CustomValue {
  id: string;
  title: string;
  value: string;
  created: Date;
  updated: Date;
}

interface ValueHistory {
  id: string;
  title: string;
  oldValue: string;
  newValue: string;
  changed: Date;
  location: string;
}

export default function SettingsPage() {
  const [hardcodedValues, setHardcodedValues] = useState<HardcodedValue[]>([]);
  const [customValues, setCustomValues] = useState<CustomValue[]>([]);
  const [valueHistory, setValueHistory] = useState<ValueHistory[]>([]);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [newCustomTitle, setNewCustomTitle] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Load hardcoded values from backend API
  useEffect(() => {
    const fetchHardcodedValues = async () => {
      try {
        const response = await fetch('/api/settings/hardcoded-values');
        if (response.ok) {
          const values = await response.json();
          setHardcodedValues(values);
        } else {
          toast({
            title: 'Failed to Load Values',
            description: 'Could not fetch hardcoded values from server',
            variant: 'destructive'
          });
        }
      } catch (error) {
        console.error('Error fetching hardcoded values:', error);
        toast({
          title: 'Error',
          description: 'Failed to connect to server',
          variant: 'destructive'
        });
      }
    };

    fetchHardcodedValues();
    loadCustomValues();
    loadValueHistory();
  }, []);

  // Load custom values from localStorage
  const loadCustomValues = () => {
    try {
      const stored = localStorage.getItem('custom_config_values');
      if (stored) {
        const parsed = JSON.parse(stored);
        setCustomValues(parsed.map((v: any) => ({
          ...v,
          created: new Date(v.created),
          updated: new Date(v.updated)
        })));
      }
    } catch (error) {
      console.error('Failed to load custom values:', error);
    }
  };

  // Load value history from localStorage
  const loadValueHistory = () => {
    try {
      const stored = localStorage.getItem('config_value_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        setValueHistory(parsed.map((h: any) => ({
          ...h,
          changed: new Date(h.changed)
        })));
      }
    } catch (error) {
      console.error('Failed to load value history:', error);
    }
  };

  // Save custom values to localStorage
  const saveCustomValues = (values: CustomValue[]) => {
    try {
      localStorage.setItem('custom_config_values', JSON.stringify(values));
    } catch (error) {
      console.error('Failed to save custom values:', error);
    }
  };

  // Save value history to localStorage
  const saveValueHistory = (history: ValueHistory[]) => {
    try {
      localStorage.setItem('config_value_history', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save value history:', error);
    }
  };

  // Toggle sensitive value visibility
  const toggleSensitiveVisibility = (id: string) => {
    setShowSensitive(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Copy value to clipboard
  const copyToClipboard = async (value: string, title: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: 'Copied!',
        description: `${title} copied to clipboard`
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive'
      });
    }
  };

  // Update hardcoded value
  const updateHardcodedValue = async (id: string, newValue: string) => {
    const value = hardcodedValues.find(v => v.id === id);
    if (!value) return;

    try {
      // Call backend API to update the value
      const response = await fetch('/api/settings/update-value', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, newValue }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update value');
      }

      // Add to history
      const historyEntry: ValueHistory = {
        id: Date.now().toString(),
        title: value.title,
        oldValue: value.value,
        newValue: newValue,
        changed: new Date(),
        location: value.locations.join(', ')
      };

      const newHistory = [historyEntry, ...valueHistory];
      setValueHistory(newHistory);
      saveValueHistory(newHistory);

      // Update the value in frontend state
      const updatedValues = hardcodedValues.map(v => 
        v.id === id ? { ...v, value: newValue } : v
      );
      setHardcodedValues(updatedValues);

      setEditingValue(null);
      toast({
        title: 'Value Updated',
        description: `${value.title} has been updated across all locations`
      });
    } catch (error) {
      console.error('Error updating value:', error);
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update value',
        variant: 'destructive'
      });
    }
  };


  // Add custom value
  const addCustomValue = () => {
    if (!newCustomTitle.trim() || !newCustomValue.trim()) {
      toast({
        title: 'Invalid Input',
        description: 'Please provide both title and value',
        variant: 'destructive'
      });
      return;
    }

    const customValue: CustomValue = {
      id: Date.now().toString(),
      title: newCustomTitle,
      value: newCustomValue,
      created: new Date(),
      updated: new Date()
    };

    const updatedCustomValues = [...customValues, customValue];
    setCustomValues(updatedCustomValues);
    saveCustomValues(updatedCustomValues);

    setNewCustomTitle('');
    setNewCustomValue('');

    toast({
      title: 'Custom Value Added',
      description: `${newCustomTitle} has been saved`
    });
  };

  // Delete custom value
  const deleteCustomValue = (id: string) => {
    const updatedCustomValues = customValues.filter(v => v.id !== id);
    setCustomValues(updatedCustomValues);
    saveCustomValues(updatedCustomValues);

    toast({
      title: 'Custom Value Deleted',
      description: 'Custom value has been removed'
    });
  };

  // Export values as .env
  const exportAsEnv = () => {
    let envContent = '# Hardcoded Values Export\n';
    envContent += '# Generated by Telegram Manager Settings\n\n';

    hardcodedValues.forEach(value => {
      const envKey = value.id.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      envContent += `${envKey}=${value.value}\n`;
    });

    envContent += '\n# Custom Values\n';
    customValues.forEach(value => {
      const envKey = value.title.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      envContent += `CUSTOM_${envKey}=${value.value}\n`;
    });

    downloadFile(envContent, 'hardcoded-values.env', 'text/plain');
  };

  // Export values as JSON
  const exportAsJson = () => {
    const exportData = {
      hardcodedValues: hardcodedValues.map(v => ({
        id: v.id,
        title: v.title,
        value: v.value,
        category: v.category,
        type: v.type,
        locations: v.locations
      })),
      customValues: customValues,
      exportedAt: new Date().toISOString()
    };

    downloadFile(JSON.stringify(exportData, null, 2), 'hardcoded-values.json', 'application/json');
  };

  // Download file helper
  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: `Downloaded ${filename}`
    });
  };

  // Filter values based on category and search
  const filteredHardcodedValues = hardcodedValues.filter(value => {
    const matchesCategory = selectedCategory === 'all' || value.category === selectedCategory;
    const matchesSearch = value.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
                         value.description.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['all', ...Array.from(new Set(hardcodedValues.map(v => v.category)))];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Configuration Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage all hardcoded values and configuration settings
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsHistoryDialogOpen(true)}
              data-testid="button-view-history"
            >
              <History className="w-4 h-4 mr-2" />
              View History
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="button-export">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportAsEnv}>
                  Export as .env
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsJson}>
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs defaultValue="hardcoded" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hardcoded">Hardcoded Values</TabsTrigger>
            <TabsTrigger value="custom">Custom Values</TabsTrigger>
          </TabsList>

          <TabsContent value="hardcoded" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label htmlFor="search">Search Values</Label>
                    <Input
                      id="search"
                      placeholder="Search by title or description..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      data-testid="input-search-values"
                    />
                  </div>
                  <div className="sm:w-48">
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white dark:bg-gray-800"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      data-testid="select-category-filter"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category === 'all' ? 'All Categories' : category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hardcoded Values */}
            <div className="grid gap-4">
              {filteredHardcodedValues.map((value) => (
                <Card key={value.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {value.title}
                          </h3>
                          <Badge variant={value.sensitive ? 'destructive' : 'secondary'}>
                            {value.type}
                          </Badge>
                          {value.sensitive && (
                            <Badge variant="outline" className="text-orange-600">
                              Sensitive
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-gray-600 dark:text-gray-400 mb-3">
                          {value.description}
                        </p>

                        <div className="space-y-2">
                          <Label>Current Value</Label>
                          {editingValue === value.id ? (
                            <div className="flex gap-2">
                              <Input
                                defaultValue={value.value}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateHardcodedValue(value.id, e.currentTarget.value);
                                  } else if (e.key === 'Escape') {
                                    setEditingValue(null);
                                  }
                                }}
                                data-testid={`input-edit-value-${value.id}`}
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  const input = e.currentTarget.parentElement?.querySelector('input');
                                  if (input) {
                                    updateHardcodedValue(value.id, input.value);
                                  }
                                }}
                                data-testid={`button-save-value-${value.id}`}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingValue(null)}
                                data-testid={`button-cancel-edit-${value.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                                {value.sensitive && !showSensitive[value.id] 
                                  ? '•'.repeat(Math.min(value.value.length, 20))
                                  : value.value}
                              </code>
                              
                              {value.sensitive && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleSensitiveVisibility(value.id)}
                                  data-testid={`button-toggle-visibility-${value.id}`}
                                >
                                  {showSensitive[value.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-3">
                          <Label className="text-xs text-gray-500">Used in {value.locations.length} location(s)</Label>
                          <div className="mt-1 text-xs text-gray-500">
                            {value.locations.slice(0, 2).join(', ')}
                            {value.locations.length > 2 && '...'}
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${value.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => copyToClipboard(value.value, value.title)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Value
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingValue(value.id)}>
                            <Save className="w-4 h-4 mr-2" />
                            Edit Value
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsInfoDialogOpen(value.id)}>
                            <Info className="w-4 h-4 mr-2" />
                            View Info
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            {/* Add Custom Value */}
            <Card>
              <CardHeader>
                <CardTitle>Add Custom Value</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom-title">Title</Label>
                    <Input
                      id="custom-title"
                      placeholder="Enter title..."
                      value={newCustomTitle}
                      onChange={(e) => setNewCustomTitle(e.target.value)}
                      data-testid="input-custom-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom-value">Value</Label>
                    <Input
                      id="custom-value"
                      placeholder="Enter value..."
                      value={newCustomValue}
                      onChange={(e) => setNewCustomValue(e.target.value)}
                      data-testid="input-custom-value"
                    />
                  </div>
                </div>
                <Button onClick={addCustomValue} data-testid="button-add-custom-value">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom Value
                </Button>
              </CardContent>
            </Card>

            {/* Custom Values List */}
            <div className="grid gap-4">
              {customValues.map((value) => (
                <Card key={value.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {value.title}
                        </h3>
                        <code className="block p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono mb-3">
                          {value.value}
                        </code>
                        <div className="text-xs text-gray-500">
                          Created: {value.created.toLocaleString()} • 
                          Updated: {value.updated.toLocaleString()}
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-custom-actions-${value.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => copyToClipboard(value.value, value.title)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Value
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteCustomValue(value.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* History Dialog */}
        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Value Change History</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {valueHistory.length === 0 ? (
                <Alert>
                  <AlertDescription>No value changes recorded yet.</AlertDescription>
                </Alert>
              ) : (
                valueHistory.map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{entry.title}</h4>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {entry.changed.toLocaleString()} • {entry.location}
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="text-sm">
                              <span className="text-red-600">- {entry.oldValue}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-green-600">+ {entry.newValue}</span>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => copyToClipboard(entry.newValue, 'New Value')}>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy New Value
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyToClipboard(entry.oldValue, 'Old Value')}>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy Old Value
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Info Dialog */}
        {isInfoDialogOpen && (
          <Dialog open={!!isInfoDialogOpen} onOpenChange={() => setIsInfoDialogOpen(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Value Information</DialogTitle>
              </DialogHeader>
              {(() => {
                const value = hardcodedValues.find(v => v.id === isInfoDialogOpen);
                if (!value) return null;
                
                return (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Description</h4>
                      <p className="text-gray-600 dark:text-gray-400">{value.description}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Type & Category</h4>
                      <div className="flex gap-2">
                        <Badge>{value.type}</Badge>
                        <Badge variant="outline">{value.category}</Badge>
                        {value.sensitive && <Badge variant="destructive">Sensitive</Badge>}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Usage Locations</h4>
                      <div className="space-y-1">
                        {value.locations.map((location, index) => (
                          <code key={index} className="block p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                            {location}
                          </code>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Current Value</h4>
                      <code className="block p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                        {value.sensitive && !showSensitive[value.id] 
                          ? '•'.repeat(Math.min(value.value.length, 20))
                          : value.value}
                      </code>
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}