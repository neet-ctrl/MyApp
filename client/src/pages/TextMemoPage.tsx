import { useState, useEffect } from "react";
import { Plus, MoreVertical, Edit3, Copy, Download, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
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
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      hint: hint.trim() || undefined,
      description: description.trim() || undefined,
      content: content.trim() || ""
    });

    // Reset form
    setTitle("");
    setHint("");
    setDescription("");
    setContent("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTitle("");
    setHint("");
    setDescription("");
    setContent("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Memo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4">
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
              rows={2}
              data-testid="input-description"
            />
          </div>
          <div className="flex-1 flex flex-col">
            <label htmlFor="content" className="text-sm font-medium mb-2">
              Content
            </label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your memo content here..."
              className="flex-1 resize-none"
              data-testid="input-content"
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

interface MemoViewDialogProps {
  memo: TextMemo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (memo: TextMemo) => void;
  onDelete: (id: number) => void;
}

function MemoViewDialog({ memo, open, onOpenChange, onEdit, onDelete }: MemoViewDialogProps) {
  const { toast } = useToast();

  if (!memo) return null;

  const handleCopy = () => {
    const textToCopy = memo.content || "";
    navigator.clipboard.writeText(textToCopy);
    toast({ title: "Content copied to clipboard" });
  };

  const handleDownload = () => {
    const content = memo.content || "";
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

  const handleEdit = () => {
    onEdit(memo);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this memo?")) {
      onDelete(memo.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[600px] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>{memo.title}</DialogTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleEdit}
                data-testid="button-edit"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          <div className="text-sm text-muted-foreground">
            {memo.description && <p><strong>Description:</strong> {memo.description}</p>}
            {memo.hint && <p><strong>Hint:</strong> {memo.hint}</p>}
            <p><strong>Created:</strong> {memo.createdAt ? new Date(memo.createdAt).toLocaleString() : 'Unknown'}</p>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 p-3 border rounded-md bg-muted/50 overflow-auto whitespace-pre-wrap text-sm">
              {memo.content || "No content available"}
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              data-testid="button-copy"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              data-testid="button-download"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
              data-testid="button-delete"
            >
              <X className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MemoEditDialogProps {
  memo: TextMemo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: number, updates: Partial<TextMemo>) => void;
}

function MemoEditDialog({ memo, open, onOpenChange, onSave }: MemoEditDialogProps) {
  const [title, setTitle] = useState("");
  const [hint, setHint] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");

  // Update form when memo changes
  useEffect(() => {
    if (memo) {
      setTitle(memo.title || "");
      setHint(memo.hint || "");
      setDescription(memo.description || "");
      setContent(memo.content || "");
    }
  }, [memo]);

  if (!memo) return null;

  const handleSave = () => {
    if (!title.trim()) return;

    onSave(memo.id, {
      title: title.trim(),
      hint: hint.trim() || undefined,
      description: description.trim() || undefined,
      content: content || ""
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset to original values
    setTitle(memo.title || "");
    setHint(memo.hint || "");
    setDescription(memo.description || "");
    setContent(memo.content || "");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Memo</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col space-y-4">
          <div>
            <label htmlFor="edit-title" className="text-sm font-medium">
              Title *
            </label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter memo title"
              data-testid="input-edit-title"
            />
          </div>
          <div>
            <label htmlFor="edit-hint" className="text-sm font-medium">
              Hint
            </label>
            <Input
              id="edit-hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Enter a hint (optional)"
              data-testid="input-edit-hint"
            />
          </div>
          <div>
            <label htmlFor="edit-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description (optional)"
              rows={2}
              data-testid="input-edit-description"
            />
          </div>
          <div className="flex-1 flex flex-col">
            <label htmlFor="edit-content" className="text-sm font-medium mb-2">
              Content
            </label>
            <Textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your memo content here..."
              className="flex-1 resize-none"
              data-testid="input-edit-content"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              data-testid="button-edit-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim()}
              data-testid="button-edit-save"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MemoCardProps {
  memo: TextMemo;
  onView: (memo: TextMemo) => void;
  onEdit: (memo: TextMemo) => void;
  onDelete: (id: number) => void;
}

function MemoCard({ memo, onView, onEdit, onDelete }: MemoCardProps) {
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `Title: ${memo.title}\nDescription: ${memo.description || 'N/A'}\nContent: ${memo.content || 'N/A'}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const previewContent = memo.content ? 
    memo.content.substring(0, 100) + (memo.content.length > 100 ? '...' : '') : 
    'No content';

  return (
    <Card 
      className="h-48 cursor-pointer hover:shadow-lg transition-all duration-200 relative group"
      onClick={() => onView(memo)}
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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(memo); }}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
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
            <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-description-${memo.id}`}>
              {memo.description}
            </p>
          )}
          <p className="text-xs text-gray-600 line-clamp-2" data-testid={`text-content-preview-${memo.id}`}>
            {previewContent}
          </p>
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
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [memos, setMemos] = useState<TextMemo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load memos on mount
  useEffect(() => {
    loadMemos();
  }, []);

  const loadMemos = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/text-memos');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setMemos(data);
        }
      }
    } catch (error) {
      console.error('Failed to load memos:', error);
      toast({ title: "Failed to load memos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMemo = async (memo: InsertTextMemo) => {
    try {
      const response = await fetch('/api/text-memos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memo),
      });

      if (response.ok) {
        const newMemo = await response.json();
        setMemos(prev => [newMemo, ...prev]);
        toast({ title: "Memo created successfully" });
      } else {
        throw new Error('Failed to create memo');
      }
    } catch (error) {
      console.error('Error creating memo:', error);
      toast({ title: "Failed to create memo", variant: "destructive" });
    }
  };

  const handleViewMemo = async (memo: TextMemo) => {
    // Always fetch fresh data to ensure content is up to date
    try {
      const response = await fetch(`/api/text-memos/${memo.id}`);
      if (response.ok) {
        const freshMemo = await response.json();
        setSelectedMemo(freshMemo);
        setViewDialogOpen(true);
      } else {
        setSelectedMemo(memo);
        setViewDialogOpen(true);
      }
    } catch (error) {
      console.error('Error fetching memo:', error);
      setSelectedMemo(memo);
      setViewDialogOpen(true);
    }
  };

  const handleEditMemo = async (memo: TextMemo) => {
    // Always fetch fresh data before editing
    try {
      const response = await fetch(`/api/text-memos/${memo.id}`);
      if (response.ok) {
        const freshMemo = await response.json();
        setSelectedMemo(freshMemo);
        setEditDialogOpen(true);
      } else {
        setSelectedMemo(memo);
        setEditDialogOpen(true);
      }
    } catch (error) {
      console.error('Error fetching memo for edit:', error);
      setSelectedMemo(memo);
      setEditDialogOpen(true);
    }
  };

  const handleSaveMemo = async (id: number, updates: Partial<TextMemo>) => {
    try {
      const response = await fetch(`/api/text-memos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedMemo = await response.json();
        setMemos(prev => prev.map(m => m.id === id ? updatedMemo : m));
        setSelectedMemo(updatedMemo);
        toast({ title: "Memo updated successfully" });
      } else {
        throw new Error('Failed to update memo');
      }
    } catch (error) {
      console.error('Error updating memo:', error);
      toast({ title: "Failed to update memo", variant: "destructive" });
    }
  };

  const handleDeleteMemo = async (id: number) => {
    if (confirm("Are you sure you want to delete this memo?")) {
      try {
        const response = await fetch(`/api/text-memos/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setMemos(prev => prev.filter(m => m.id !== id));
          toast({ title: "Memo deleted successfully" });
        } else {
          throw new Error('Failed to delete memo');
        }
      } catch (error) {
        console.error('Error deleting memo:', error);
        toast({ title: "Failed to delete memo", variant: "destructive" });
      }
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
                onView={handleViewMemo}
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

      <MemoViewDialog
        memo={selectedMemo}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onEdit={handleEditMemo}
        onDelete={handleDeleteMemo}
      />

      <MemoEditDialog
        memo={selectedMemo}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveMemo}
      />
    </div>
  );
}