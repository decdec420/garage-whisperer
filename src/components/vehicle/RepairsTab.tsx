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
import { Plus, Wrench, DollarSign, Trash2, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function RepairsTab({ vehicleId }: { vehicleId: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: repairs, isLoading } = useQuery({
    queryKey: ['repairs', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('repair_logs').select('id, title, date, mileage, diy_cost, shop_quote, total_cost, difficulty, labor_hours, description, notes').eq('vehicle_id', vehicleId).order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('repair_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['repairs', vehicleId] }); toast.success('Deleted'); },
  });

  const totalCost = repairs?.reduce((a, r) => a + (Number(r.diy_cost) || Number(r.total_cost) || 0), 0) ?? 0;
  const totalSavings = repairs?.reduce((a, r) => a + Math.max(0, (Number(r.shop_quote) || 0) - (Number(r.diy_cost) || 0)), 0) ?? 0;

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Repair History</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4 mr-1" /> Log Repair</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Cost</p><p className="text-lg font-bold">${totalCost.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">DIY Savings</p><p className="text-lg font-bold text-success">${totalSavings.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Repairs</p><p className="text-lg font-bold">{repairs?.length ?? 0}</p></CardContent></Card>
      </div>

      {totalSavings > 0 && (
        <div className="rounded-xl bg-success/10 border border-success/20 p-4 flex items-center gap-3">
          <TrendingDown className="h-5 w-5 text-success" />
          <span className="text-sm font-medium">You've saved <span className="text-success font-bold">${totalSavings.toLocaleString()}</span> by doing it yourself!</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !repairs?.length ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Wrench className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">No repairs recorded</p>
          <p className="text-sm text-muted-foreground mb-4">Log a repair to track your costs and DIY savings</p>
          <Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add first repair</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {repairs.map(r => (
            <Card key={r.id} className="border-border hover:border-primary/20 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{format(new Date(r.date), 'MMM d, yyyy')}</span>
                      {r.mileage && <span>{r.mileage.toLocaleString()} mi</span>}
                      {r.difficulty && (
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Wrench key={i} className={`h-3 w-3 ${i < r.difficulty! ? 'text-primary' : 'text-muted'}`} />
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-2">
                      {r.diy_cost != null && <span>DIY: ${Number(r.diy_cost).toFixed(0)}</span>}
                      {r.shop_quote != null && <span className="text-muted-foreground">Shop: ${Number(r.shop_quote).toFixed(0)}</span>}
                      {r.shop_quote != null && r.diy_cost != null && Number(r.shop_quote) > Number(r.diy_cost) && (
                        <span className="text-success font-medium">Saved ${(Number(r.shop_quote) - Number(r.diy_cost)).toFixed(0)}</span>
                      )}
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.description}</p>}
                  </div>
                  <button onClick={() => deleteMutation.mutate(r.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddRepairModal open={modalOpen} onOpenChange={setModalOpen} vehicleId={vehicleId} />
    </div>
  );
}

function AddRepairModal({ open, onOpenChange, vehicleId }: { open: boolean; onOpenChange: (o: boolean) => void; vehicleId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', date: '', mileage: '', description: '', diy_cost: '', shop_quote: '', difficulty: '', notes: '' });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const savings = Math.max(0, (parseFloat(form.shop_quote) || 0) - (parseFloat(form.diy_cost) || 0));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.date) throw new Error('Title and date required');
      const { error } = await supabase.from('repair_logs').insert({
        vehicle_id: vehicleId,
        title: form.title,
        date: form.date,
        mileage: form.mileage ? parseInt(form.mileage) : null,
        description: form.description || null,
        diy_cost: form.diy_cost ? parseFloat(form.diy_cost) : null,
        shop_quote: form.shop_quote ? parseFloat(form.shop_quote) : null,
        difficulty: form.difficulty ? parseInt(form.difficulty) : null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs', vehicleId] });
      toast.success('Repair logged');
      onOpenChange(false);
      setForm({ title: '', date: '', mileage: '', description: '', diy_cost: '', shop_quote: '', difficulty: '', notes: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Log Repair</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div><Label className="text-xs">Title *</Label><Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Replaced starter motor" className="bg-popover" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Date *</Label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="bg-popover" /></div>
            <div><Label className="text-xs">Mileage</Label><Input type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} className="bg-popover" /></div>
          </div>
          <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => set('description', e.target.value)} className="bg-popover" rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">DIY Cost ($)</Label><Input type="number" value={form.diy_cost} onChange={e => set('diy_cost', e.target.value)} className="bg-popover" /></div>
            <div><Label className="text-xs">Shop Quote ($)</Label><Input type="number" value={form.shop_quote} onChange={e => set('shop_quote', e.target.value)} className="bg-popover" /></div>
          </div>
          {savings > 0 && <p className="text-sm text-success font-medium">You'd save ${savings.toFixed(0)} doing it yourself!</p>}
          <div><Label className="text-xs">Difficulty (1-5)</Label><Input type="number" min={1} max={5} value={form.difficulty} onChange={e => set('difficulty', e.target.value)} className="bg-popover" /></div>
          <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="bg-popover" rows={2} /></div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Log Repair'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
