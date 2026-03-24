import { useState, useRef, useEffect, useCallback } from 'react';
import { getSignedUrl } from '@/lib/storage-helpers';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, FileText, Image, Link2, Trash2, ExternalLink, Plus, BookOpen, Loader2, Search } from 'lucide-react';

interface Props {
  vehicleId: string;
  vehicle: any;
}

const DOC_TYPES = [
  { value: 'manual', label: 'Manual', icon: BookOpen },
  { value: 'photo', label: 'Photo', icon: Image },
  { value: 'reference', label: 'Reference Link', icon: Link2 },
  { value: 'wiring', label: 'Wiring Diagram', icon: FileText },
  { value: 'tsb', label: 'TSB / Bulletin', icon: FileText },
  { value: 'receipt', label: 'Receipt', icon: FileText },
];

export default function DocsTab({ vehicleId, vehicle }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchingManuals, setSearchingManuals] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: '', description: '', doc_type: 'manual', external_url: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const { data: docs, isLoading } = useQuery({
    queryKey: ['vehicle-documents', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_documents')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const doc = docs?.find((d: any) => d.id === docId);
      if (doc?.file_url) {
        const path = doc.file_url.split('/vehicle-documents/')[1];
        if (path) await supabase.storage.from('vehicle-documents').remove([path]);
      }
      const { error } = await supabase.from('vehicle_documents').delete().eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-documents', vehicleId] });
      toast.success('Document removed');
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    }
    if (!newDoc.title) {
      setNewDoc(prev => ({ ...prev, title: file.name.replace(/\.[^/.]+$/, '') }));
    }
    if (file.type.startsWith('image/')) {
      setNewDoc(prev => ({ ...prev, doc_type: 'photo' }));
    } else if (file.type === 'application/pdf') {
      setNewDoc(prev => ({ ...prev, doc_type: 'manual' }));
    }
  };

  const handleUpload = async () => {
    if (!user) return;
    if (!newDoc.title) { toast.error('Title is required'); return; }
    if (!selectedFile && !newDoc.external_url) { toast.error('Upload a file or provide a link'); return; }

    setUploading(true);
    try {
      let fileUrl = null;
      let mimeType = null;
      let fileSize = null;

      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop();
        const path = `${user.id}/${vehicleId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('vehicle-documents')
          .upload(path, selectedFile);
        if (uploadError) throw uploadError;

        // Store the path, not a public URL — bucket is private
        fileUrl = path;
        mimeType = selectedFile.type;
        fileSize = selectedFile.size;
      }

      const { error } = await supabase.from('vehicle_documents').insert({
        vehicle_id: vehicleId,
        user_id: user.id,
        title: newDoc.title,
        description: newDoc.description || null,
        doc_type: newDoc.doc_type,
        file_url: fileUrl,
        external_url: newDoc.external_url || null,
        file_size: fileSize,
        mime_type: mimeType,
        source: 'user',
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['vehicle-documents', vehicleId] });
      toast.success('Document added');
      setUploadModalOpen(false);
      setNewDoc({ title: '', description: '', doc_type: 'manual', external_url: '' });
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    }
    setUploading(false);
  };

  const searchForManuals = async () => {
    if (!user) return;
    setSearchingManuals(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-manuals', {
        body: { vehicleId, year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, userId: user.id },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['vehicle-documents', vehicleId] });
      toast.success(`Found ${data?.count || 0} manual references`);
    } catch (e: any) {
      toast.error('Manual search failed');
      console.error(e);
    }
    setSearchingManuals(false);
  };

  const filteredDocs = docs?.filter((d: any) => filterType === 'all' || d.doc_type === filterType) || [];
  const hasAutoSearched = docs?.some((d: any) => d.source === 'auto_search');

  const getDocIcon = (type: string) => {
    const t = DOC_TYPES.find(dt => dt.value === type);
    return t ? t.icon : FileText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Manuals & Documents</h2>
          <p className="text-sm text-muted-foreground">Owner's manuals, photos, wiring diagrams, and reference materials</p>
        </div>
        <div className="flex gap-2">
          {!hasAutoSearched && (
            <Button variant="outline" onClick={searchForManuals} disabled={searchingManuals} className="border-primary/40 text-primary">
              {searchingManuals ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Find Manuals
            </Button>
          )}
          <Button onClick={() => setUploadModalOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Add Document
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={filterType === 'all' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setFilterType('all')}
        >
          All ({docs?.length || 0})
        </Badge>
        {DOC_TYPES.map(dt => {
          const count = docs?.filter((d: any) => d.doc_type === dt.value).length || 0;
          if (count === 0 && filterType !== dt.value) return null;
          return (
            <Badge
              key={dt.value}
              variant={filterType === dt.value ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterType(dt.value)}
            >
              {dt.label} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Documents grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">No documents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your owner's manual, photos, wiring diagrams, or any reference material for your {vehicle.year} {vehicle.make} {vehicle.model}.
            </p>
            <div className="flex gap-2 justify-center">
              {!hasAutoSearched && (
                <Button variant="outline" onClick={searchForManuals} disabled={searchingManuals}>
                  {searchingManuals ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Search for Manuals
                </Button>
              )}
              <Button onClick={() => setUploadModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc: any) => (
            <DocCard key={doc.id} doc={doc} onDelete={(id: string) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={newDoc.doc_type} onValueChange={v => setNewDoc(p => ({ ...p, doc_type: v }))}>
                <SelectTrigger className="bg-popover"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(dt => (
                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input
                value={newDoc.title}
                onChange={e => setNewDoc(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Owner's Manual, Engine Bay Photo"
                className="bg-popover"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={newDoc.description}
                onChange={e => setNewDoc(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional notes..."
                className="bg-popover"
              />
            </div>

            {/* File upload area */}
            <div>
              <Label className="text-xs">Upload File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.heic,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              {selectedFile ? (
                <div className="mt-2 border border-border rounded-lg p-3 flex items-center gap-3">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload (max 10MB)</p>
                  <p className="text-xs text-muted-foreground mt-1">Images, PDFs</p>
                </div>
              )}
            </div>

            {/* OR external link */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">or add a link</span></div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">External URL</Label>
              <Input
                value={newDoc.external_url}
                onChange={e => setNewDoc(p => ({ ...p, external_url: e.target.value }))}
                placeholder="https://..."
                className="bg-popover"
              />
            </div>

            <Button className="w-full" onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {uploading ? 'Uploading...' : 'Add Document'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
