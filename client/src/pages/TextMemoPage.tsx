import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreVertical, Edit3, Copy, Download, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TextMemo, InsertTextMemo } from "@shared/schema";

interface CreateMemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (memo: InsertTextMemo) => void;
}

function CreateMemoDialog({ open, onOpenChange, onSubmit }: CreateMemoDialogProps) {
  const [title, setTitle] = useState("");
  const [hint, setHint] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      hint: hint.trim() || undefined,
      description: description.trim() || undefined,
      content: ""
    });

    // Reset form
    setTitle("");
    setHint("");
    setDescription("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTitle("");
    setHint("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Memo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="text-sm font-medium">
              Title *
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter memo title"
              data-testid="input-title"
              required
            />
          </div>
          <div>
            <label htmlFor="hint" className="text-sm font-medium">
              Hint
            </label>
            <Input
              id="hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Enter a hint (optional)"
              data-testid="input-hint"
            />
          </div>
          <div>
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description (optional)"
              rows={3}
              data-testid="input-description"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              data-testid="button-create"
            >
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface MemoEditorDialogProps {
  memo: TextMemo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: number, content: string) => void;
}

function MemoEditorDialog({ memo, open, onOpenChange, onSave }: MemoEditorDialogProps) {
  const [content, setContent] = useState(memo?.content || "");
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    if (memo) {
      onSave(memo.id, content);
      setIsEditing(false);
    }
  };

  const handleClose = () => {
    setContent(memo?.content || "");
    setIsEditing(false);
    onOpenChange(false);
  };

  if (!memo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[500px] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>{memo.title}</DialogTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                data-testid="button-edit"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              {isEditing && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col space-y-4">
          <div className="text-sm text-muted-foreground">
            {memo.description && <p><strong>Description:</strong> {memo.description}</p>}
            {memo.hint && <p><strong>Hint:</strong> {memo.hint}</p>}
            <p><strong>Created:</strong> {memo.createdAt ? new Date(memo.createdAt).toLocaleString() : 'Unknown'}</p>
          </div>
          
          <div className="flex-1">
            {isEditing ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your memo content here..."
                className="h-full resize-none"
                data-testid="textarea-content"
              />
            ) : (
              <div className="h-full p-3 border rounded-md bg-muted/50 overflow-auto whitespace-pre-wrap">
                {content || "No content yet. Click the edit button to add content."}
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(content)}
              data-testid="button-copy"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${memo.title}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              data-testid="button-download"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={handleClose} data-testid="button-close">
              Close
            </Button>
            {content !== memo.content && (
              <Button onClick={handleSave} data-testid="button-save-changes">
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MemoCardProps {
  memo: TextMemo;
  onEdit: (memo: TextMemo) => void;
  onDelete: (id: number) => void;
}

function MemoCard({ memo, onEdit, onDelete }: MemoCardProps) {
  const { toast } = useToast();

  const handleCopy = () => {
    const text = `Title: ${memo.title}\nDescription: ${memo.description || 'N/A'}\nContent: ${memo.content || 'N/A'}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleDownload = () => {
    const content = `${memo.title}\n\n${memo.description ? memo.description + '\n\n' : ''}${memo.content || ''}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${memo.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card 
      className="h-48 cursor-pointer hover:shadow-lg transition-all duration-200 relative group"
      onClick={() => onEdit(memo)}
      data-testid={`card-memo-${memo.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <h3 className="font-medium text-sm line-clamp-2" data-testid={`text-title-${memo.id}`}>
            {memo.title}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-menu-${memo.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(memo.id); }}
                className="text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {memo.description && (
            <p className="text-xs text-muted-foreground line-clamp-3" data-testid={`text-description-${memo.id}`}>
              {memo.description}
            </p>
          )}
          <div className="text-xs text-muted-foreground" data-testid={`text-date-${memo.id}`}>
            {memo.createdAt ? new Date(memo.createdAt).toLocaleDateString() : 'Unknown date'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TextMemoPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<TextMemo | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all memos
  const { data: memos = [], isLoading } = useQuery({
    queryKey: ['/api/text-memos'],
    queryFn: async () => {
      const response = await fetch('/api/text-memos');
      if (!response.ok) {
        throw new Error('Failed to fetch memos');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Create memo mutation
  const createMemoMutation = useMutation({
    mutationFn: (memo: InsertTextMemo) => apiRequest('/api/text-memos', 'POST', memo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/text-memos'] });
      toast({ title: "Memo created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create memo", variant: "destructive" });
    },
  });

  // Update memo mutation
  const updateMemoMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      apiRequest(`/api/text-memos/${id}`, 'PUT', { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/text-memos'] });
      toast({ title: "Memo updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update memo", variant: "destructive" });
    },
  });

  // Delete memo mutation
  const deleteMemoMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/text-memos/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/text-memos'] });
      toast({ title: "Memo deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete memo", variant: "destructive" });
    },
  });

  const handleCreateMemo = (memo: InsertTextMemo) => {
    createMemoMutation.mutate(memo);
  };

  const handleEditMemo = (memo: TextMemo) => {
    setSelectedMemo(memo);
    setEditorOpen(true);
  };

  const handleSaveMemo = (id: number, content: string) => {
    updateMemoMutation.mutate({ id, content });
  };

  const handleDeleteMemo = (id: number) => {
    if (confirm("Are you sure you want to delete this memo?")) {
      deleteMemoMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading memos...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Text Memos</h1>
        <p className="text-muted-foreground">Create and manage your text memos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Plus button for creating new memo */}
        {memos.length === 0 ? (
          <Card 
            className="h-48 border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-center"
            onClick={() => setCreateDialogOpen(true)}
            data-testid="button-create-first"
          >
            <div className="text-center">
              <Plus className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Create your first memo</p>
            </div>
          </Card>
        ) : (
          <>
            <Card 
              className="h-48 border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-center"
              onClick={() => setCreateDialogOpen(true)}
              data-testid="button-create-new"
            >
              <div className="text-center">
                <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Add new memo</p>
              </div>
            </Card>
            {memos.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                onEdit={handleEditMemo}
                onDelete={handleDeleteMemo}
              />
            ))}
          </>
        )}
      </div>

      <CreateMemoDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateMemo}
      />

      <MemoEditorDialog
        memo={selectedMemo}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={handleSaveMemo}
      />
    </div>
  );
}