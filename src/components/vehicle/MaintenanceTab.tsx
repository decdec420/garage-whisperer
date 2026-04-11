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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus, Wrench, Calendar, DollarSign, Trash2, ChevronDown, ChevronRight,
  Droplets, RotateCcw, Disc, Wind, Thermometer, Zap, Eye, Fuel, Shield, Gauge, Car,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  vehicleId: string;
  vehicleMileage?: number | null;
}

// ── Common maintenance services with smart defaults ──
const SERVICE_PRESETS: {
  label: string;
  category: string;
  intervalMiles?: number;
  intervalMonths?: number;
  avgCost?: number;
  icon: any;
}[] = [
  // Fluids
  { label: 'Oil Change', category: 'fluids', intervalMiles: 5000, intervalMonths: 6, avgCost: 45, icon: Droplets },
  { label: 'Transmission Fluid Change', category: 'fluids', intervalMiles: 60000, intervalMonths: 48, avgCost: 150, icon: Droplets },
  { label: 'Brake Fluid Flush', category: 'fluids', intervalMiles: 30000, intervalMonths: 24, avgCost: 100, icon: Droplets },
  { label: 'Coolant Flush', category: 'fluids', intervalMiles: 30000, intervalMonths: 24, avgCost: 120, icon: Thermometer },
  { label: 'Power Steering Fluid Flush', category: 'fluids', intervalMiles: 50000, intervalMonths: 36, avgCost: 90, icon: Droplets },
  { label: 'Differential Fluid Change', category: 'fluids', intervalMiles: 50000, intervalMonths: 48, avgCost: 80, icon: Droplets },
  // Filters
  { label: 'Air Filter Replacement', category: 'filters', intervalMiles: 15000, intervalMonths: 12, avgCost: 25, icon: Wind },
  { label: 'Cabin Air Filter Replacement', category: 'filters', intervalMiles: 15000, intervalMonths: 12, avgCost: 20, icon: Wind },
  { label: 'Fuel Filter Replacement', category: 'filters', intervalMiles: 30000, intervalMonths: 24, avgCost: 60, icon: Fuel },
  { label: 'Oil Filter Replacement', category: 'filters', intervalMiles: 5000, intervalMonths: 6, avgCost: 10, icon: Wind },
  // Brakes
  { label: 'Front Brake Pads', category: 'brakes', intervalMiles: 40000, intervalMonths: 36, avgCost: 150, icon: Disc },
  { label: 'Rear Brake Pads', category: 'brakes', intervalMiles: 50000, intervalMonths: 48, avgCost: 130, icon: Disc },
  { label: 'Front Rotors', category: 'brakes', intervalMiles: 70000, intervalMonths: 60, avgCost: 300, icon: Disc },
  { label: 'Rear Rotors', category: 'brakes', intervalMiles: 80000, intervalMonths: 60, avgCost: 250, icon: Disc },
  // Tires & Wheels
  { label: 'Tire Rotation', category: 'tires', intervalMiles: 7500, intervalMonths: 6, avgCost: 30, icon: RotateCcw },
  { label: 'Wheel Alignment', category: 'tires', intervalMiles: 25000, intervalMonths: 24, avgCost: 100, icon: Car },
  { label: 'Tire Replacement', category: 'tires', intervalMiles: 50000, intervalMonths: 48, avgCost: 600, icon: RotateCcw },
  { label: 'Tire Balance', category: 'tires', intervalMiles: 12000, intervalMonths: 12, avgCost: 50, icon: RotateCcw },
  // Electrical
  { label: 'Battery Replacement', category: 'electrical', intervalMiles: 50000, intervalMonths: 48, avgCost: 180, icon: Zap },
  { label: 'Spark Plug Replacement', category: 'electrical', intervalMiles: 60000, intervalMonths: 48, avgCost: 80, icon: Zap },
  // Belts & Hoses
  { label: 'Serpentine Belt Replacement', category: 'belts', intervalMiles: 60000, intervalMonths: 60, avgCost: 100, icon: Gauge },
  { label: 'Timing Belt/Chain', category: 'belts', intervalMiles: 90000, intervalMonths: 84, avgCost: 500, icon: Gauge },
  // Inspection
  { label: 'State Inspection', category: 'inspection', intervalMonths: 12, avgCost: 30, icon: Eye },
  { label: 'Emissions Test', category: 'inspection', intervalMonths: 24, avgCost: 25, icon: Eye },
  { label: 'Multi-Point Inspection', category: 'inspection', intervalMonths: 12, avgCost: 0, icon: Shield },
  // Wipers
  { label: 'Wiper Blade Replacement', category: 'other', intervalMonths: 12, avgCost: 25, icon: Eye },
];

const CATEGORY_META: Record<string, { label: string; icon: any }> = {
  fluids: { label: 'Fluids & Oils', icon: Droplets },
  filters: { label: 'Filters', icon: Wind },
  brakes: { label: 'Brakes', icon: Disc },
  tires: { label: 'Tires & Wheels', icon: RotateCcw },
  electrical: { label: 'Electrical', icon: Zap },
  belts: { label: 'Belts & Hoses', icon: Gauge },
  inspection: { label: 'Inspections', icon: Eye },
  other: { label: 'Other', icon: Wrench },
};

function categorizeService(service: string): string {
  const text = service.toLowerCase();
  for (const preset of SERVICE_PRESETS) {
    if (text.includes(preset.label.toLowerCase()) || preset.label.toLowerCase().includes(text)) {
      return preset.category;
    }
  }
  if (/oil|fluid|coolant|flush/i.test(text)) return 'fluids';
  if (/filter/i.test(text)) return 'filters';
  if (/brake|rotor|pad|caliper/i.test(text)) return 'brakes';
  if (/tire|wheel|rotation|alignment/i.test(text)) return 'tires';
  if (/battery|spark|electrical/i.test(text)) return 'electrical';
  if (/belt|chain|hose/i.test(text)) return 'belts';
  if (/inspection|emission|smog/i.test(text)) return 'inspection';
  return 'other';
}

export default function MaintenanceTab({ vehicleId, vehicleMileage }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useState<'category' | 'timeline'>('category');
  const queryClient = useQueryClient();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['maintenance', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('maintenance_logs')
        .select('id, service, date, mileage, cost, shop, notes, next_due_date, next_due_mileage')
        .eq('vehicle_id', vehicleId)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['recent-maintenance', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['next-maintenance'] });
      toast.success('Deleted');
    },
  });

  const totalSpend = logs?.reduce((a, l) => a + (Number(l.cost) || 0), 0) ?? 0;

  // Group by category
  const grouped = (() => {
    if (!logs?.length) return [];
    const map = new Map<string, typeof logs>();
    logs.forEach(l => {
      const cat = categorizeService(l.service);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(l);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: CATEGORY_META[key]?.label || 'Other',
      icon: CATEGORY_META[key]?.icon || Wrench,
      items,
      totalCost: items.reduce((a, l) => a + (Number(l.cost) || 0), 0),
    })).sort((a, b) => {
      const aDate = new Date(a.items[0].date).getTime();
      const bDate = new Date(b.items[0].date).getTime();
      return bDate - aDate;
    });
  })();

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Maintenance History</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Log Service
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Spend</p>
          <p className="text-lg font-bold">${totalSpend.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Services Logged</p>
          <p className="text-lg font-bold">{logs?.length ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Categories</p>
          <p className="text-lg font-bold">{grouped.length}</p>
        </CardContent></Card>
      </div>

      {/* View toggle */}
      {(logs?.length ?? 0) > 0 && (
        <div className="flex gap-1 bg-muted rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setView('category')}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              view === 'category' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >By Category</button>
          <button
            onClick={() => setView('timeline')}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              view === 'timeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >Timeline</button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !logs?.length ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Wrench className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">No service history yet</p>
          <p className="text-sm text-muted-foreground mb-4">Start tracking your maintenance to get reminders</p>
          <Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4 mr-1" /> Log your first service</Button>
        </div>
      ) : view === 'category' ? (
        <div className="space-y-3">
          {grouped.map(group => {
            const Icon = group.icon;
            return (
              <Collapsible key={group.key} defaultOpen>
                <CollapsibleTrigger className="w-full">
                  <Card className="border-border hover:border-primary/20 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-sm">{group.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.items.length} service{group.items.length !== 1 ? 's' : ''} · ${group.totalCost.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-5 border-l-2 border-primary/20 pl-4 mt-2 space-y-2">
                    {group.items.map(log => (
                      <MaintenanceCard
                        key={log.id}
                        log={log}
                        isExpanded={expandedId === log.id}
                        onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        onDelete={() => deleteMutation.mutate(log.id)}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <MaintenanceCard
              key={log.id}
              log={log}
              isExpanded={expandedId === log.id}
              onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
              onDelete={() => deleteMutation.mutate(log.id)}
            />
          ))}
        </div>
      )}

      <AddMaintenanceModal open={modalOpen} onOpenChange={setModalOpen} vehicleId={vehicleId} vehicleMileage={vehicleMileage} />
    </div>
  );
}

// ── Clickable / Expandable Card ──
function MaintenanceCard({
  log,
  isExpanded,
  onToggle,
  onDelete,
}: {
  log: any;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const cat = categorizeService(log.service);
  const meta = CATEGORY_META[cat];
  const Icon = meta?.icon || Wrench;

  return (
    <Card
      className={cn(
        "border-border transition-colors cursor-pointer",
        isExpanded ? "border-primary/30 bg-primary/5" : "hover:border-primary/20"
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{log.service}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(log.date), 'MMM d, yyyy')}
                </span>
                {log.mileage && <span>{log.mileage.toLocaleString()} mi</span>}
                {log.cost != null && Number(log.cost) > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />{Number(log.cost).toFixed(0)}
                  </span>
                )}
                {log.shop && (
                  <Badge variant="secondary" className="text-[10px] py-0">{log.shop}</Badge>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-90")} />
        </div>

        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-border space-y-2 text-sm" onClick={e => e.stopPropagation()}>
            {log.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Notes</p>
                <p className="text-sm">{log.notes}</p>
              </div>
            )}
            {(log.next_due_date || log.next_due_mileage) && (
              <div className="rounded-lg bg-accent/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Next Due</p>
                <div className="flex gap-4 text-xs">
                  {log.next_due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(log.next_due_date), 'MMM d, yyyy')}
                    </span>
                  )}
                  {log.next_due_mileage && (
                    <span>{log.next_due_mileage.toLocaleString()} mi</span>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Add Service Modal with Presets ──
function AddMaintenanceModal({
  open,
  onOpenChange,
  vehicleId,
  vehicleMileage,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vehicleId: string;
  vehicleMileage?: number | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    service: '', date: '', mileage: '', cost: '', shop: '', notes: '',
    nextDueDate: '', nextDueMileage: '',
  });
  const [showPresets, setShowPresets] = useState(true);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const selectPreset = (preset: typeof SERVICE_PRESETS[0]) => {
    const today = new Date().toISOString().split('T')[0];
    const nextDate = preset.intervalMonths
      ? (() => { const d = new Date(); d.setMonth(d.getMonth() + preset.intervalMonths); return d.toISOString().split('T')[0]; })()
      : '';
    const nextMi = preset.intervalMiles && vehicleMileage
      ? String(vehicleMileage + preset.intervalMiles)
      : '';
    setForm({
      service: preset.label,
      date: today,
      mileage: vehicleMileage ? String(vehicleMileage) : '',
      cost: preset.avgCost ? String(preset.avgCost) : '',
      shop: '',
      notes: '',
      nextDueDate: nextDate,
      nextDueMileage: nextMi,
    });
    setShowPresets(false);
  };

  const resetForm = () => {
    setForm({ service: '', date: '', mileage: '', cost: '', shop: '', notes: '', nextDueDate: '', nextDueMileage: '' });
    setShowPresets(true);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.service || !form.date) throw new Error('Service and date required');
      const mileage = form.mileage ? parseInt(form.mileage) : null;
      const cost = form.cost ? parseFloat(form.cost) : null;
      const nextDueMileage = form.nextDueMileage ? parseInt(form.nextDueMileage) : null;
      if (mileage !== null && mileage < 0) throw new Error('Mileage cannot be negative');
      if (cost !== null && cost < 0) throw new Error('Cost cannot be negative');
      if (nextDueMileage !== null && nextDueMileage < 0) throw new Error('Next due mileage cannot be negative');

      const { error } = await supabase.from('maintenance_logs').insert({
        vehicle_id: vehicleId,
        service: form.service,
        date: form.date,
        mileage,
        cost,
        shop: form.shop || null,
        notes: form.notes || null,
        next_due_date: form.nextDueDate || null,
        next_due_mileage: nextDueMileage,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['recent-maintenance', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['next-maintenance'] });
      toast.success('Service logged');
      onOpenChange(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  // Group presets by category for the picker
  const presetCategories = (() => {
    const map = new Map<string, typeof SERVICE_PRESETS>();
    SERVICE_PRESETS.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: CATEGORY_META[key]?.label || key,
      icon: CATEGORY_META[key]?.icon || Wrench,
      items,
    }));
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Log Service</DialogTitle></DialogHeader>

        {showPresets ? (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Choose a service or enter custom:</p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {presetCategories.map(cat => {
                const CatIcon = cat.icon;
                return (
                  <div key={cat.key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.label}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {cat.items.map(preset => (
                        <button
                          key={preset.label}
                          onClick={() => selectPreset(preset)}
                          className="text-left px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-sm"
                        >
                          <p className="font-medium text-xs">{preset.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {preset.intervalMiles ? `Every ${(preset.intervalMiles/1000).toFixed(0)}k mi` : ''}
                            {preset.intervalMiles && preset.intervalMonths ? ' / ' : ''}
                            {preset.intervalMonths ? `${preset.intervalMonths} mo` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setShowPresets(false)}>
              Custom Service
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <Button variant="ghost" size="sm" className="text-xs -ml-2" onClick={() => setShowPresets(true)}>
              ← Pick from common services
            </Button>
            <div>
              <Label className="text-xs">Service *</Label>
              <Input value={form.service} onChange={e => set('service', e.target.value)} placeholder="Oil Change" className="bg-popover" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="bg-popover" />
              </div>
              <div>
                <Label className="text-xs">Mileage</Label>
                <Input type="number" min="0" value={form.mileage} onChange={e => set('mileage', e.target.value)} placeholder="45000" className="bg-popover" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cost ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="65" className="bg-popover" />
              </div>
              <div>
                <Label className="text-xs">Shop / DIY</Label>
                <Input value={form.shop} onChange={e => set('shop', e.target.value)} placeholder="DIY" className="bg-popover" />
              </div>
            </div>

            {/* Next Due Section */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Next Service Due (for reminders)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Next Due Date</Label>
                  <Input type="date" value={form.nextDueDate} onChange={e => set('nextDueDate', e.target.value)} className="bg-popover" />
                </div>
                <div>
                  <Label className="text-xs">Next Due Mileage</Label>
                  <Input type="number" min="0" value={form.nextDueMileage} onChange={e => set('nextDueMileage', e.target.value)} placeholder="50000" className="bg-popover" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="bg-popover" rows={2} />
            </div>
            <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Log Service'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
