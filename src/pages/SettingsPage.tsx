import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [saving, setSaving] = useState(false);

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

      <Card className="border-destructive/30">
        <CardHeader><CardTitle className="text-lg text-destructive">Danger Zone</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Permanently delete your account and all data.</p>
          <Button variant="destructive" onClick={() => toast.error('Please contact support to delete your account.')}>Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
