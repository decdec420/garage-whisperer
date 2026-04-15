import { useState, useMemo } from 'react';
import { format, parse } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';


import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';
import {
  CheckCircle2, Clock, HelpCircle, Wrench, Loader2,
  Droplets, Wind, Disc, Zap, Gauge, RotateCcw, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ServiceStatus = 'done_recently' | 'never_done' | 'unknown' | null;

interface ServiceEntry {
  service_name: string;
  category: string;
  status: ServiceStatus;
  date: string;
  mileage: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleLabel: string;
  vehicleMileage: number | null;
  services: { service_name: string; category: string }[];
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  fluids: Droplets,
  filters: Wind,
  brakes: Disc,
  tires: RotateCcw,
  electrical: Zap,
  ignition: Zap,
  drivetrain: Gauge,
  general: Wrench,
  inspection: Eye,
};

const STATUS_OPTIONS: { value: ServiceStatus; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'done_recently', label: 'Done', icon: CheckCircle2, description: 'I\'ve had this done' },
  { value: 'never_done', label: 'Never', icon: Clock, description: 'Never done or not sure when' },
  { value: 'unknown', label: 'Skip', icon: HelpCircle, description: 'I\'ll figure this out later' },
];

export default function MaintenanceCatchUpWizard({ open, onOpenChange, vehicleId, vehicleLabel, vehicleMileage, services }: Props) {
  const queryClient = useQueryClient();
  const { openRatchetPanel } = useAppStore();

  const [entries, setEntries] = useState<ServiceEntry[]>(() =>
    services.map(s => ({
      service_name: s.service_name,
      category: s.category,
      status: null,
      date: '',
      mileage: '',
    }))
  );

  // Reset when services change
  useMemo(() => {
    setEntries(services.map(s => ({
      service_name: s.service_name,
      category: s.category,
      status: null,
      date: '',
      mileage: '',
    })));
  }, [services]);

  const setEntryField = (idx: number, field: keyof ServiceEntry, value: string | ServiceStatus) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const markedCount = entries.filter(e => e.status !== null).length;
  const doneEntries = entries.filter(e => e.status === 'done_recently' && e.date);
  const neverEntries = entries.filter(e => e.status === 'never_done');

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Insert "done recently" entries with user-provided dates
      const toInsert = entries
        .filter(e => e.status === 'done_recently' && e.date)
        .map(e => ({
          vehicle_id: vehicleId,
          service: e.service_name,
          date: e.date,
          mileage: e.mileage ? parseInt(e.mileage) : null,
          cost: null as number | null,
          shop: null as string | null,
          notes: 'Logged via maintenance catch-up',
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('maintenance_logs').insert(toInsert);
        if (error) throw error;
      }

      // For "never done" items — insert a backdated placeholder so they show as overdue
      // This creates a record dated far enough back that the service will flag as overdue
      const neverItems = entries
        .filter(e => e.status === 'never_done')
        .map(e => ({
          vehicle_id: vehicleId,
          service: e.service_name,
          date: '2000-01-01', // sentinel date — clearly overdue
          mileage: 0,
          cost: null as number | null,
          shop: null as string | null,
          notes: 'Never done — flagged for attention',
        }));

      if (neverItems.length > 0) {
        const { error } = await supabase.from('maintenance_logs').insert(neverItems);
        if (error) throw error;
      }

      return { done: toInsert.length, flagged: neverItems.length };
    },
    onSuccess: ({ done, flagged }) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['all-maintenance-logs-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['recent-maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['next-maintenance'] });
      const parts = [];
      if (done > 0) parts.push(`${done} logged`);
      if (flagged > 0) parts.push(`${flagged} flagged as overdue`);
      toast.success(`${parts.join(', ')} — health score will update`);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleRatchetHelp = () => {
    onOpenChange(false);
    openRatchetPanel(
      `I need help catching up on maintenance history for my ${vehicleLabel}. ` +
      `Here are the services I haven't logged yet: ${entries.filter(e => e.status !== 'done_recently').map(e => e.service_name).join(', ')}. ` +
      `Interview me about each one and log them for me based on my answers.`
    );
  };

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, { idx: number; entry: ServiceEntry }[]>();
    entries.forEach((entry, idx) => {
      if (!map.has(entry.category)) map.set(entry.category, []);
      map.get(entry.category)!.push({ idx, entry });
    });
    return Array.from(map.entries());
  }, [entries]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-lg">Catch Up on Maintenance</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {vehicleLabel} — quickly mark what's been done so Ratchet can predict what's coming up.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${entries.length > 0 ? (markedCount / entries.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">{markedCount}/{entries.length}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 min-h-0">
          <div className="space-y-5 pb-4">
            {grouped.map(([category, items]) => {
              const CatIcon = CATEGORY_ICONS[category] || Wrench;
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <CatIcon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {category}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map(({ idx, entry }) => (
                      <ServiceRow
                        key={idx}
                        entry={entry}
                        onStatusChange={(s) => setEntryField(idx, 'status', s)}
                        onDateChange={(d) => setEntryField(idx, 'date', d)}
                        onMileageChange={(m) => setEntryField(idx, 'mileage', m)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-border space-y-2 shrink-0">
          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (doneEntries.length === 0 && neverEntries.length === 0)}
          >
            {saveMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
            ) : (
              <>Save {doneEntries.length > 0 ? `${doneEntries.length} logged` : ''}{doneEntries.length > 0 && neverEntries.length > 0 ? ' + ' : ''}{neverEntries.length > 0 ? `${neverEntries.length} flagged` : ''}</>
            )}
          </Button>
          <button
            onClick={handleRatchetHelp}
            className="w-full text-center text-xs text-primary hover:underline py-1.5"
          >
            🔧 Not sure? Let Ratchet interview me instead
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ServiceRow({
  entry,
  onStatusChange,
  onDateChange,
  onMileageChange,
}: {
  entry: ServiceEntry;
  onStatusChange: (s: ServiceStatus) => void;
  onDateChange: (d: string) => void;
  onMileageChange: (m: string) => void;
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const selectedDate = entry.date ? parse(entry.date, 'yyyy-MM-dd', new Date()) : undefined;

  return (
    <div className={cn(
      "rounded-xl border p-3 transition-colors",
      entry.status === 'done_recently' ? 'border-primary/30 bg-primary/[0.03]' :
      entry.status === 'never_done' ? 'border-border bg-muted/30' :
      entry.status === 'unknown' ? 'border-border bg-muted/10 opacity-60' :
      'border-border'
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{entry.service_name}</span>
      </div>

      <div className="flex gap-1.5 mb-2">
        {STATUS_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const isActive = entry.status === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => {
                const nextStatus = isActive ? null : opt.value;
                onStatusChange(nextStatus);
                if (nextStatus !== 'done_recently') setDatePickerOpen(false);
              }}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                isActive
                  ? opt.value === 'done_recently'
                    ? 'bg-primary text-primary-foreground'
                    : opt.value === 'never_done'
                      ? 'bg-muted text-foreground'
                      : 'bg-muted text-muted-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              title={opt.description}
            >
              <Icon className="h-3 w-3" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {entry.status === 'done_recently' && (
        <div className="space-y-2 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-[10px] text-muted-foreground">Approx. Date</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDatePickerOpen(prev => !prev)}
                className={cn(
                  'w-full h-8 text-xs justify-between font-normal bg-popover',
                  !entry.date && 'text-muted-foreground'
                )}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <CalendarIcon className="h-3 w-3 shrink-0" />
                  {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Pick date'}
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', datePickerOpen && 'rotate-180')} />
              </Button>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-[10px] text-muted-foreground">Mileage (optional)</Label>
              <Input
                value={entry.mileage ? Number(entry.mileage).toLocaleString() : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  onMileageChange(raw);
                }}
                placeholder="45,000"
                inputMode="numeric"
                className="bg-popover h-8 text-xs"
              />
            </div>
          </div>

          {datePickerOpen && (
            <div className="rounded-xl border border-border bg-background/95 p-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  onDateChange(d ? format(d, 'yyyy-MM-dd') : '');
                  if (d) setDatePickerOpen(false);
                }}
                disabled={(d) => d > new Date()}
                defaultMonth={selectedDate ?? new Date()}
                initialFocus
                fixedWeeks
                captionLayout="dropdown-buttons"
                fromYear={1990}
                toYear={new Date().getFullYear()}
                className="p-3 pointer-events-auto w-full"
                classNames={{
                  months: 'flex justify-center',
                  month: 'space-y-4 w-full',
                  caption: 'flex justify-center pt-1 relative items-center gap-1',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
