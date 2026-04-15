import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
import { Download, Trash2, User, Settings, Shield, Brain, Check, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import PasswordInput from '@/components/PasswordInput';

function getInitials(name?: string | null, email?: string | null) {
  if (name) return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  if (email) return email[0].toUpperCase();
  return '?';
}

function hashColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 45%)`;
}

type Prefs = {
  maintenanceReminders: boolean;
  projectUpdates: boolean;
  units: 'miles' | 'km';
  ratchetPersonality: 'concise' | 'detailed';
};

const DEFAULT_PREFS: Prefs = {
  maintenanceReminders: true,
  projectUpdates: true,
  units: 'miles',
  ratchetPersonality: 'detailed',
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem('ratchet_prefs');
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_PREFS;
}

function savePrefs(p: Prefs) {
  localStorage.setItem('ratchet_prefs', JSON.stringify(p));
}

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'account';
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [saving, setSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);
  const [recordCount, setRecordCount] = useState<number | null>(null);

  // Clear memories
  const [clearingMemories, setClearingMemories] = useState(false);
  const [clearMemoryDialogOpen, setClearMemoryDialogOpen] = useState(false);

  // Preferences
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  const updatePref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  };

  // Fetch record count on mount
  useEffect(() => {
    async function countRecords() {
      const counts = await Promise.all([
        supabase.from('vehicles').select('id', { count: 'exact', head: true }),
        supabase.from('maintenance_logs').select('id', { count: 'exact', head: true }),
        supabase.from('repair_logs').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('diagnosis_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('ratchet_memory').select('id', { count: 'exact', head: true }),
      ]);
      setRecordCount(counts.reduce((s, r) => s + (r.count ?? 0), 0));
    }
    countRecords();
  }, []);

  const initials = useMemo(() => getInitials(name, user?.email), [name, user?.email]);
  const avatarColor = useMemo(() => hashColor(user?.email || 'default'), [user?.email]);
  const memberSinceRaw = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  const memberSince = memberSinceRaw ? `Wrenching since ${memberSinceRaw}` : '';
  const isGoogleUser = user?.app_metadata?.provider === 'google';

  const updateProfile = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { name } });
    if (error) toast.error(error.message);
    else {
      await supabase.from('profiles').update({ name }).eq('id', user!.id);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
      toast.success('Profile updated');
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success('Password updated');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
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

  const clearMemories = async () => {
    setClearingMemories(true);
    const { error } = await supabase.from('ratchet_memory').delete().eq('user_id', user!.id);
    if (error) toast.error(error.message);
    else toast.success('AI memories cleared');
    setClearingMemories(false);
    setClearMemoryDialogOpen(false);
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
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="account" className="gap-1.5 text-xs sm:text-sm">
            <User className="h-3.5 w-3.5 hidden sm:block" /> Account
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5 text-xs sm:text-sm">
            <Settings className="h-3.5 w-3.5 hidden sm:block" /> Preferences
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5 text-xs sm:text-sm">
            <Shield className="h-3.5 w-3.5 hidden sm:block" /> Data & Privacy
          </TabsTrigger>
        </TabsList>

        {/* ─── Account Tab ─── */}
        <TabsContent value="account" className="space-y-4 mt-4">
          {/* Profile card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 avatar-glow hover:scale-105 transition-transform cursor-default"
                  style={{ background: `linear-gradient(135deg, ${avatarColor}, hsl(var(--primary)))`, color: '#fff' }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-lg truncate">{name || user?.email}</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                  {memberSince && <p className="text-xs text-muted-foreground mt-0.5">🔧 {memberSince}</p>}
                  {isGoogleUser && (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                      <svg className="h-3 w-3" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Connected via Google
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit name */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Display Name</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="bg-popover" />
              <Button onClick={updateProfile} disabled={saving} size="sm" className="gap-1.5">
                {nameSaved ? <><Check className="h-3.5 w-3.5" /> Saved</> : saving ? 'Saving...' : 'Save'}
              </Button>
            </CardContent>
          </Card>

          {/* Change password (only for email users) */}
          {!isGoogleUser && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Change Password</CardTitle>
                <CardDescription>Must be at least 8 characters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">New Password</Label>
                  <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="bg-popover" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirm New Password</Label>
                  <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="bg-popover" />
                </div>
                <Button onClick={changePassword} disabled={changingPassword || !newPassword} size="sm">
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Preferences Tab ─── */}
        <TabsContent value="preferences" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>Control which alerts you receive.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Maintenance Reminders</p>
                  <p className="text-xs text-muted-foreground">Get alerted when services are due</p>
                </div>
                <Switch checked={prefs.maintenanceReminders} onCheckedChange={v => updatePref('maintenanceReminders', v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Project Updates</p>
                  <p className="text-xs text-muted-foreground">Notifications about active projects</p>
                </div>
                <Switch checked={prefs.projectUpdates} onCheckedChange={v => updatePref('projectUpdates', v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4" /> Units</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {(['miles', 'km'] as const).map(u => (
                  <Button
                    key={u}
                    variant={prefs.units === u ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updatePref('units', u)}
                  >
                    {u === 'miles' ? 'Miles' : 'Kilometers'}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> Ratchet Personality</CardTitle>
              <CardDescription>How detailed should Ratchet's responses be?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {(['concise', 'detailed'] as const).map(p => (
                  <Button
                    key={p}
                    variant={prefs.ratchetPersonality === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updatePref('ratchetPersonality', p)}
                    className="capitalize"
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Data & Privacy Tab ─── */}
        <TabsContent value="data" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Export Your Data</CardTitle>
              <CardDescription>
                Download everything as a JSON file.
                {recordCount !== null && ` ~${recordCount} records across all tables.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={exportData} disabled={exporting} className="gap-2">
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting...' : 'Export my data'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> AI Memories</CardTitle>
              <CardDescription>Ratchet remembers details about your vehicles and preferences. You can clear this anytime.</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog open={clearMemoryDialogOpen} onOpenChange={setClearMemoryDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">Clear AI Memories</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all AI memories?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will erase everything Ratchet has learned about you and your vehicles. It won't delete your actual vehicle data, projects, or logs.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={clearingMemories}>Cancel</AlertDialogCancel>
                    <Button variant="destructive" onClick={clearMemories} disabled={clearingMemories}>
                      {clearingMemories ? 'Clearing...' : 'Clear Memories'}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          <div className="danger-zone">
          <Card className="border-none bg-transparent shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete Account</CardTitle>
              <CardDescription>Permanently delete your account and all data. This cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirm(''); }}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">Delete Account</Button>
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
          </div>

          <div className="text-center text-xs text-muted-foreground pt-2">
            <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
            {' · '}
            <Link to="/terms" className="hover:text-primary">Terms of Service</Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
