import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const updateProfile = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { name } });
    if (error) toast.error(error.message);
    else {
      await supabase.from('profiles').update({ name }).eq('id', user!.id);
      toast.success('Profile updated');
    }
    setSaving(false);
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const [vehicles, maintenance, repairs, projects, diagnoses, memories] = await Promise.all([
        supabase.from('vehicles').select('*').limit(10000),
        supabase.from('maintenance_logs').select('*').limit(10000),
        supabase.from('repair_logs').select('*').limit(10000),
        supabase.from('projects').select('*, project_steps(*), project_parts(*), project_tools(*)').limit(10000),
        supabase.from('diagnosis_sessions').select('*').limit(10000),
        supabase.from('ratchet_memory').select('*').limit(10000),
      ]);

      const payload = {
        exported_at: new Date().toISOString(),
        user_id: user?.id,
        email: user?.email,
        vehicles: vehicles.data ?? [],
        maintenance_logs: maintenance.data ?? [],
        repair_logs: repairs.data ?? [],
        projects: projects.data ?? [],
        diagnosis_sessions: diagnoses.data ?? [],
        ai_memories: memories.data ?? [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ratchet-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete account');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">Email</Label><Input disabled value={user?.email || ''} className="bg-popover" /></div>
          <div><Label className="text-xs">Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="bg-popover" /></div>
          <Button onClick={updateProfile} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Your Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Download all your vehicles, maintenance logs, repair history, projects, diagnoses, and AI memories as a JSON file.</p>
          <Button variant="outline" onClick={exportData} disabled={exporting} className="gap-2">
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export my data'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader><CardTitle className="text-lg text-destructive">Danger Zone</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Permanently delete your account and all associated data. This cannot be undone.</p>
          <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirm(''); }}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <span className="block">This will permanently delete your account and all your data — vehicles, diagnoses, projects, and repair history. There is no recovery.</span>
                  <span className="block">Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                  onClick={deleteAccount}
                >
                  {deleting ? 'Deleting...' : 'Delete My Account'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground pt-2">
        <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
        {' · '}
        <Link to="/terms" className="hover:text-primary">Terms of Service</Link>
      </div>
    </div>
  );
}
