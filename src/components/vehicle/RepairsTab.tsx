import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Wrench, DollarSign, TrendingDown, ChevronDown, Clock,
  Zap, Cog, Thermometer, Gauge, Shield, Car, Fuel, Eye,
  Calendar,
} from 'lucide-react';
import { format, getYear } from 'date-fns';
import { cn } from '@/lib/utils';

// Categorize repairs by vehicle system
const SYSTEM_CATEGORIES: { key: string; label: string; icon: any; keywords: string[] }[] = [
  { key: 'engine', label: 'Engine & Drivetrain', icon: Cog, keywords: ['engine', 'motor', 'timing', 'head gasket', 'valve', 'piston', 'crankshaft', 'camshaft', 'oil pump', 'intake', 'exhaust', 'turbo', 'supercharger', 'throttle'] },
  { key: 'transmission', label: 'Transmission & Clutch', icon: Gauge, keywords: ['transmission', 'clutch', 'gear', 'torque converter', 'differential', 'driveshaft', 'cv joint', 'cv axle', 'transfer case'] },
  { key: 'cooling', label: 'Cooling & A/C', icon: Thermometer, keywords: ['coolant', 'radiator', 'thermostat', 'water pump', 'heater', 'a/c', 'ac ', 'condenser', 'compressor', 'evaporator', 'refrigerant', 'fan', 'cooling'] },
  { key: 'electrical', label: 'Electrical & Lighting', icon: Zap, keywords: ['battery', 'alternator', 'starter', 'wiring', 'fuse', 'relay', 'sensor', 'light', 'headlight', 'taillight', 'signal', 'electrical', 'module', 'ecu', 'pcm'] },
  { key: 'brakes', label: 'Brakes & Safety', icon: Shield, keywords: ['brake', 'rotor', 'pad', 'caliper', 'abs', 'master cylinder', 'brake line', 'parking brake', 'drum'] },
  { key: 'suspension', label: 'Suspension & Steering', icon: Car, keywords: ['suspension', 'strut', 'shock', 'spring', 'control arm', 'ball joint', 'tie rod', 'wheel bearing', 'hub', 'alignment', 'steering', 'rack', 'sway bar', 'bushing'] },
  { key: 'fuel', label: 'Fuel System', icon: Fuel, keywords: ['fuel', 'injector', 'fuel pump', 'fuel filter', 'fuel line', 'gas', 'carburetor'] },
  { key: 'body', label: 'Body & Interior', icon: Eye, keywords: ['body', 'paint', 'dent', 'bumper', 'fender', 'door', 'window', 'mirror', 'seat', 'dash', 'carpet', 'trim', 'weather strip', 'windshield', 'wiper'] },
];

function categorizeRepair(title: string, description: string | null): string {
  const text = `${title} ${description || ''}`.toLowerCase();
  for (const cat of SYSTEM_CATEGORIES) {
    if (cat.keywords.some(kw => text.includes(kw))) return cat.key;
  }
  return 'other';
}

interface Repair {
  id: string;
  title: string;
  date: string;
  mileage: number | null;
  diy_cost: number | null;
  shop_quote: number | null;
  total_cost: number | null;
  difficulty: number | null;
  labor_hours: number | null;
  description: string | null;
  notes: string | null;
}

export default function RepairsTab({ vehicleId }: { vehicleId: string }) {
  const { data: repairs, isLoading } = useQuery({
    queryKey: ['repairs', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('repair_logs')
        .select('id, title, date, mileage, diy_cost, shop_quote, total_cost, difficulty, labor_hours, description, notes')
        .eq('vehicle_id', vehicleId)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Repair[];
    },
  });

  const totalCost = repairs?.reduce((a, r) => a + (Number(r.diy_cost) || Number(r.total_cost) || 0), 0) ?? 0;
  const totalSavings = repairs?.reduce((a, r) => a + Math.max(0, (Number(r.shop_quote) || 0) - (Number(r.diy_cost) || 0)), 0) ?? 0;
  const totalHours = repairs?.reduce((a, r) => a + (Number(r.labor_hours) || 0), 0) ?? 0;

  // Group repairs by system category
  const grouped = useMemo(() => {
    if (!repairs?.length) return [];
    const map = new Map<string, Repair[]>();
    repairs.forEach(r => {
      const cat = categorizeRepair(r.title, r.description);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    });

    // Build result with category metadata, sorted by most recent repair
    const result: { key: string; label: string; icon: any; repairs: Repair[]; totalCost: number }[] = [];
    for (const [key, reps] of map) {
      const cat = SYSTEM_CATEGORIES.find(c => c.key === key);
      result.push({
        key,
        label: cat?.label || 'Other Repairs',
        icon: cat?.icon || Wrench,
        repairs: reps,
        totalCost: reps.reduce((a, r) => a + (Number(r.diy_cost) || Number(r.total_cost) || 0), 0),
      });
    }
    return result.sort((a, b) => {
      const aDate = new Date(a.repairs[0].date).getTime();
      const bDate = new Date(b.repairs[0].date).getTime();
      return bDate - aDate;
    });
  }, [repairs]);

  // Group by year for timeline
  const years = useMemo(() => {
    if (!repairs?.length) return [];
    const ySet = new Set(repairs.map(r => getYear(new Date(r.date))));
    return Array.from(ySet).sort((a, b) => b - a);
  }, [repairs]);

  const [view, setView] = useState<'system' | 'timeline'>('system');

  return (
    <div className="space-y-6 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Repair History</h2>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setView('system')}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              view === 'system' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            By System
          </button>
          <button
            onClick={() => setView('timeline')}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              view === 'timeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Invested</p>
          <p className="text-lg font-bold">${totalCost.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">DIY Savings</p>
          <p className="text-lg font-bold text-success">${totalSavings.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Repairs Done</p>
          <p className="text-lg font-bold">{repairs?.length ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Wrench Time</p>
          <p className="text-lg font-bold">{totalHours.toFixed(1)}h</p>
        </CardContent></Card>
      </div>

      {totalSavings > 0 && (
        <div className="rounded-xl bg-success/10 border border-success/20 p-4 flex items-center gap-3">
          <TrendingDown className="h-5 w-5 text-success" />
          <span className="text-sm font-medium">You've saved <span className="text-success font-bold">${totalSavings.toLocaleString()}</span> by doing it yourself!</span>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !repairs?.length ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-semibold text-lg">No repairs yet</p>
          <p className="text-sm text-muted-foreground max-w-xs mt-1">
            Complete a project and click "Log this repair" to start tracking your repair history automatically.
          </p>
        </div>
      ) : view === 'system' ? (
        <SystemView groups={grouped} />
      ) : (
        <TimelineView repairs={repairs} years={years} />
      )}
    </div>
  );
}

function SystemView({ groups }: { groups: { key: string; label: string; icon: any; repairs: Repair[]; totalCost: number }[] }) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(groups.map(g => g.key)));

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const Icon = group.icon;
        const isOpen = openGroups.has(group.key);
        return (
          <Collapsible key={group.key} open={isOpen} onOpenChange={() => toggleGroup(group.key)}>
            <CollapsibleTrigger className="w-full">
              <Card className={cn("border-border transition-colors", isOpen && "border-primary/30")}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">{group.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.repairs.length} repair{group.repairs.length !== 1 ? 's' : ''} · ${group.totalCost.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{group.repairs.length}</Badge>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </div>
                </CardContent>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-5 border-l-2 border-primary/20 pl-4 mt-2 space-y-2">
                {group.repairs.map(r => (
                  <RepairCard key={r.id} repair={r} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function TimelineView({ repairs, years }: { repairs: Repair[]; years: number[] }) {
  return (
    <div className="space-y-6">
      {years.map(year => {
        const yearRepairs = repairs.filter(r => getYear(new Date(r.date)) === year);
        const yearCost = yearRepairs.reduce((a, r) => a + (Number(r.diy_cost) || Number(r.total_cost) || 0), 0);
        return (
          <div key={year}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-base font-bold">{year}</h3>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">
                {yearRepairs.length} repair{yearRepairs.length !== 1 ? 's' : ''} · ${yearCost.toLocaleString()}
              </span>
            </div>
            <div className="border-l-2 border-border pl-4 ml-2 space-y-2">
              {yearRepairs.map(r => (
                <RepairCard key={r.id} repair={r} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RepairCard({ repair: r }: { repair: Repair }) {
  const savings = r.shop_quote != null && r.diy_cost != null ? Math.max(0, Number(r.shop_quote) - Number(r.diy_cost)) : 0;
  const category = categorizeRepair(r.title, r.description);
  const cat = SYSTEM_CATEGORIES.find(c => c.key === category);
  const Icon = cat?.icon || Wrench;

  return (
    <Card className="border-border hover:border-primary/20 transition-colors">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{r.title}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(r.date), 'MMM d, yyyy')}
              </span>
              {r.mileage && <span>{r.mileage.toLocaleString()} mi</span>}
              {r.labor_hours && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />{r.labor_hours}h
                </span>
              )}
              {r.difficulty && (
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Wrench key={i} className={cn("h-2.5 w-2.5", i < r.difficulty! ? 'text-primary' : 'text-muted')} />
                  ))}
                </span>
              )}
            </div>
            {/* Cost row */}
            <div className="flex items-center gap-3 text-xs mt-1.5">
              {r.diy_cost != null && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  DIY: ${Number(r.diy_cost).toFixed(0)}
                </span>
              )}
              {r.shop_quote != null && (
                <span className="text-muted-foreground">Shop: ${Number(r.shop_quote).toFixed(0)}</span>
              )}
              {savings > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-success/20">
                  Saved ${savings.toFixed(0)}
                </Badge>
              )}
            </div>
            {r.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{r.description}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
