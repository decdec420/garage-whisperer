import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Wrench, Calendar, DollarSign, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  vehicleId: string;
  vehicleMileage?: number | null;
}

export default function MaintenanceTab({ vehicleId, vehicleMileage }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['maintenance', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('maintenance_logs').select('*').eq('vehicle_id', vehicleId).order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['maintenance', vehicleId] }); toast.success('Deleted'); },
  });

  const totalSpend = logs?.reduce((a, l) => a + (Number(l.cost) || 0), 0) ?? 0;

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Maintenance History</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4 mr-1" /> Log Service</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Spend</p><p className="text-lg font-bold">${totalSpend.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Services Logged</p><p className="text-lg font-bold">{logs?.length ?? 0}</p></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !logs?.length ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Wrench className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">No service history yet</p>
          <p className="text-sm text-muted-foreground mb-4">Start tracking your maintenance to get reminders</p>
          <Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4 mr-1" /> Log your first service</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <Card key={log.id} className="border-border hover:border-primary/20 transition-colors group">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Wrench className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{log.service}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(log.date), 'MMM d, yyyy')}</span>
                      {log.mileage && <span>{log.mileage.toLocaleString()} mi</span>}
                      {log.cost && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{Number(log.cost).toFixed(0)}</span>}
                      {log.shop && <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">{log.shop}</span>}
                    </div>
                    {log.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{log.notes}</p>}
                  </div>
                </div>
                <button onClick={() => deleteMutation.mutate(log.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddMaintenanceModal open={modalOpen} onOpenChange={setModalOpen} vehicleId={vehicleId} />
    </div>
  );
}

function AddMaintenanceModal({ open, onOpenChange, vehicleId }: { open: boolean; onOpenChange: (o: boolean) => void; vehicleId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ service: '', date: '', mileage: '', cost: '', shop: '', notes: '' });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.service || !form.date) throw new Error('Service and date required');
      const { error } = await supabase.from('maintenance_logs').insert({
        vehicle_id: vehicleId,
        service: form.service,
        date: form.date,
        mileage: form.mileage ? parseInt(form.mileage) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        shop: form.shop || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', vehicleId] });
      toast.success('Service logged');
      onOpenChange(false);
      setForm({ service: '', date: '', mileage: '', cost: '', shop: '', notes: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Service</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div><Label className="text-xs">Service *</Label><Input value={form.service} onChange={e => set('service', e.target.value)} placeholder="Oil Change" className="bg-popover" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Date *</Label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="bg-popover" /></div>
            <div><Label className="text-xs">Mileage</Label><Input type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} placeholder="45000" className="bg-popover" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Cost ($)</Label><Input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="65" className="bg-popover" /></div>
            <div><Label className="text-xs">Shop / DIY</Label><Input value={form.shop} onChange={e => set('shop', e.target.value)} placeholder="DIY" className="bg-popover" /></div>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="bg-popover" rows={2} /></div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Log Service'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
