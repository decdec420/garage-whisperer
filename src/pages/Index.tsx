import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import CircularGauge from '@/components/CircularGauge';
import {
  Car, Plus, AlertTriangle, CheckCircle2, Clock, Wrench,
  ChevronRight, Cpu, FolderOpen, DollarSign, Activity,
  Droplets, Zap, ShieldAlert, Bluetooth
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getServiceStatus } from '@/lib/service-schedules';
import { usePopulateServiceSchedules } from '@/hooks/usePopulateServiceSchedules';
import MaintenanceCatchUpWizard from '@/components/vehicle/MaintenanceCatchUpWizard';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const { activeVehicle, setAddVehicleModalOpen, openRatchetPanel } = useAppStore();
  const navigate = useNavigate();
  const [catchUpVehicle, setCatchUpVehicle] = useState<{
    id: string;
    label: string;
    mileage: number | null;
    services: { service_name: string; category: string }[];
  } | null>(null);

  const profileName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greetEmoji = hour < 12 ? '🌅' : hour < 18 ? '☀️' : '🌙';
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // ── Data queries ──────────────────────────────────────────────
  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, year, make, model, mileage, nickname, engine, trim, drivetrain')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Auto-populate service schedules for new vehicles
  usePopulateServiceSchedules(vehicles ?? undefined);

  const { data: serviceSchedules } = useQuery({
    queryKey: ['all-service-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_service_schedules')
        .select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!vehicles && vehicles.length > 0,
  });

  const { data: maintenanceLogs } = useQuery({
    queryKey: ['all-maintenance-logs-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('vehicle_id, service, date, mileage, status')
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!vehicles && vehicles.length > 0,
  });

  const { data: activeProjects } = useQuery({
    queryKey: ['dashboard-active-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, vehicle_id, status, updated_at, estimated_minutes, actual_minutes')
        .in('status', ['active', 'planning'])
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: projectStepCounts } = useQuery({
    queryKey: ['dashboard-project-step-counts'],
    queryFn: async () => {
      if (!activeProjects?.length) return {};
      const ids = activeProjects.map(p => p.id);
      const { data, error } = await supabase
        .from('project_steps')
        .select('project_id, status');
      if (error) throw error;
      const counts: Record<string, { total: number; done: number; nextStep?: string }> = {};
      for (const s of data ?? []) {
        if (!ids.includes(s.project_id)) continue;
        if (!counts[s.project_id]) counts[s.project_id] = { total: 0, done: 0 };
        counts[s.project_id].total++;
        if (s.status === 'done') counts[s.project_id].done++;
      }
      return counts;
    },
    enabled: !!activeProjects && activeProjects.length > 0,
  });

  const { data: activeDTCs } = useQuery({
    queryKey: ['dashboard-active-dtcs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dtc_records')
        .select('id, vehicle_id, code, description, severity')
        .eq('status', 'active');
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicleExpenses } = useQuery({
    queryKey: ['dashboard-vehicle-expenses'],
    queryFn: async () => {
      // Aggregate from repair_logs + maintenance_logs
      const [repairRes, maintRes] = await Promise.all([
        supabase.from('repair_logs').select('vehicle_id, diy_cost, total_cost'),
        supabase.from('maintenance_logs').select('vehicle_id, cost'),
      ]);
      const expenses: Record<string, number> = {};
      for (const r of repairRes.data ?? []) {
        const cost = Math.max(0, Number(r.total_cost) || Number(r.diy_cost) || 0);
        expenses[r.vehicle_id] = (expenses[r.vehicle_id] || 0) + cost;
      }
      for (const m of maintRes.data ?? []) {
        const cost = Math.max(0, Number(m.cost) || 0);
        expenses[m.vehicle_id] = (expenses[m.vehicle_id] || 0) + cost;
      }
      return expenses;
    },
    enabled: !!vehicles && vehicles.length > 0,
  });

  // ── Derived data ──────────────────────────────────────────────

  // Predictive maintenance status per vehicle
  const vehicleHealth = (vehicles ?? []).map(v => {
    const schedules = (serviceSchedules ?? []).filter(s => s.vehicle_id === v.id);
    const logs = (maintenanceLogs ?? []).filter(l => l.vehicle_id === v.id && l.date !== '2000-01-01' && l.status !== 'needs_attention');

    let overdue = 0;
    let dueSoon = 0;
    let ok = 0;
    let unknown = 0;

    const serviceStatuses = schedules.map(sched => {
      // Find the most recent log matching this service (excluding sentinel entries)
      const lastLog = logs.find(l =>
        l.service.toLowerCase().includes(sched.service_name.toLowerCase()) ||
        sched.service_name.toLowerCase().includes(l.service.toLowerCase())
      );
      const status = getServiceStatus(
        sched,
        lastLog ? { date: lastLog.date, mileage: lastLog.mileage } : null,
        v.mileage,
      );
      if (status === 'overdue') overdue++;
      else if (status === 'due_soon') dueSoon++;
      else if (status === 'ok') ok++;
      else unknown++;

      return { ...sched, status, lastLog };
    });

    const totalChecked = overdue + dueSoon + ok;
    const healthScore = totalChecked > 0 ? Math.round(((ok + dueSoon * 0.5) / totalChecked) * 100) : null;

    return {
      vehicle: v,
      overdue,
      dueSoon,
      ok,
      unknown,
      healthScore,
      serviceStatuses,
      expenses: vehicleExpenses?.[v.id] ?? 0,
      dtcs: (activeDTCs ?? []).filter(d => d.vehicle_id === v.id),
    };
  });

  const totalOverdue = vehicleHealth.reduce((a, v) => a + v.overdue, 0);
  const totalDueSoon = vehicleHealth.reduce((a, v) => a + v.dueSoon, 0);
  const totalDTCs = activeDTCs?.length ?? 0;

  // Needs attention items
  const attentionItems: { type: string; label: string; sublabel: string; icon: React.ElementType; color: string; action: () => void; actionLabel: string }[] = [];

  for (const vh of vehicleHealth) {
    if (vh.overdue > 0) {
      const overdueServices = vh.serviceStatuses.filter(s => s.status === 'overdue').map(s => s.service_name);
      attentionItems.push({
        type: 'overdue',
        label: `${vh.overdue} overdue service${vh.overdue > 1 ? 's' : ''}`,
        sublabel: `${vh.vehicle.nickname || `${vh.vehicle.year} ${vh.vehicle.make} ${vh.vehicle.model}`} — ${overdueServices.slice(0, 2).join(', ')}${overdueServices.length > 2 ? '...' : ''}`,
        icon: AlertTriangle,
        color: 'text-destructive',
        action: () => navigate(`/garage/${vh.vehicle.id}?tab=maintenance`),
        actionLabel: 'Log service to clear',
      });
    }
    if (vh.dtcs.length > 0) {
      attentionItems.push({
        type: 'dtc',
        label: `${vh.dtcs.length} active DTC${vh.dtcs.length > 1 ? 's' : ''}: ${vh.dtcs.map(d => d.code).join(', ')}`,
        sublabel: vh.vehicle.nickname || `${vh.vehicle.year} ${vh.vehicle.make} ${vh.vehicle.model}`,
        icon: Cpu,
        color: 'text-warning',
        action: () => navigate(`/garage/${vh.vehicle.id}?tab=diagnose`),
        actionLabel: 'Diagnose',
      });
    }
    if (vh.unknown > 3) {
      const unknownServices = vh.serviceStatuses
        .filter(s => s.status === 'unknown')
        .map(s => ({ service_name: s.service_name, category: s.category }));
      attentionItems.push({
        type: 'no-history',
        label: `${vh.unknown} services with no history`,
        sublabel: `${vh.vehicle.nickname || `${vh.vehicle.year} ${vh.vehicle.make} ${vh.vehicle.model}`} — Quick catch-up takes ~60 seconds`,
        icon: Clock,
        color: 'text-muted-foreground',
        action: () => setCatchUpVehicle({
          id: vh.vehicle.id,
          label: vh.vehicle.nickname || `${vh.vehicle.year} ${vh.vehicle.make} ${vh.vehicle.model}`,
          mileage: vh.vehicle.mileage,
          services: unknownServices,
        }),
        actionLabel: 'Catch up',
      });
    }
  }

  // Sort: overdue first, then DTCs, then no-history
  const priorityOrder: Record<string, number> = { overdue: 0, dtc: 1, 'no-history': 2 };
  attentionItems.sort((a, b) => (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99));

  // ── Empty state ───────────────────────────────────────────────
  if (!vehiclesLoading && (!vehicles || vehicles.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Car className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Your garage is empty</h1>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Add your first ride and Ratchet will start tracking maintenance, diagnostics, and expenses automatically.
        </p>
        <Button size="lg" onClick={() => setAddVehicleModalOpen(true)}>
          <Plus className="h-5 w-5 mr-2" /> Add your first vehicle
        </Button>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────
  if (vehiclesLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold">{greetEmoji} {greeting}, {profileName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalOverdue > 0
            ? `${totalOverdue} service${totalOverdue > 1 ? 's' : ''} overdue across your vehicles`
            : totalDueSoon > 0
              ? `${totalDueSoon} service${totalDueSoon > 1 ? 's' : ''} coming up soon`
              : 'All systems looking good'}
        </p>
      </div>

      {/* ── Needs Attention ─────────────────────────────────────── */}
      {attentionItems.length > 0 && (
        <div>
          <h2 className="section-heading text-muted-foreground mb-3">Needs Attention</h2>
          <div className="space-y-2">
            {attentionItems.slice(0, 5).map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="attention-card w-full flex items-center gap-3 rounded-xl border border-border p-3 pl-4 hover:border-primary/30 hover:bg-accent/50 transition-colors text-left animate-stagger-in"
                data-severity={item.type === 'overdue' ? 'overdue' : item.type === 'dtc' ? 'dtc' : 'info'}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', item.type === 'overdue' ? 'bg-destructive/10' : item.type === 'dtc' ? 'bg-warning/10' : 'bg-muted')}>
                  <item.icon className={cn('h-4 w-4', item.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                </div>
                <span className="text-[10px] font-medium text-primary shrink-0 px-2 py-1 rounded-md bg-primary/10">{item.actionLabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Vehicle Health Cards ────────────────────────────────── */}
      <div>
        <h2 className="section-heading text-muted-foreground mb-3">Vehicle Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicleHealth.map(vh => {
            const gaugeColor = vh.healthScore !== null
              ? vh.healthScore >= 80 ? 'shadow-[0_0_12px_hsl(var(--success)/0.25)]'
              : vh.healthScore >= 50 ? 'shadow-[0_0_12px_hsl(var(--warning)/0.25)]'
              : 'shadow-[0_0_12px_hsl(var(--destructive)/0.25)]'
              : '';
            return (
            <Card
              key={vh.vehicle.id}
              className="cursor-pointer card-hover"
              onClick={() => navigate(`/garage/${vh.vehicle.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">
                      {vh.vehicle.nickname || `${vh.vehicle.year} ${vh.vehicle.make} ${vh.vehicle.model}`}
                    </p>
                    {vh.vehicle.mileage && (
                      <p className="text-xs text-muted-foreground">{vh.vehicle.mileage.toLocaleString()} mi</p>
                    )}
                  </div>
                  {vh.healthScore !== null ? (
                    <div className={cn('rounded-full', gaugeColor)}>
                      <CircularGauge value={vh.healthScore} size={48} strokeWidth={3.5} />
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">No data</Badge>
                  )}
                </div>

                {vh.healthScore !== null && (
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${vh.healthScore}%`,
                        background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--warning)))`,
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs">
                  {vh.overdue > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" /> {vh.overdue} overdue
                    </span>
                  )}
                  {vh.dueSoon > 0 && (
                    <span className="flex items-center gap-1 text-warning">
                      <Clock className="h-3 w-3" /> {vh.dueSoon} due soon
                    </span>
                  )}
                  {vh.overdue === 0 && vh.dueSoon === 0 && vh.ok > 0 && (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3 w-3" /> All up to date
                    </span>
                  )}
                  {vh.dtcs.length > 0 && (
                    <span className="flex items-center gap-1 text-warning">
                      <Cpu className="h-3 w-3" /> {vh.dtcs.length} DTC{vh.dtcs.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {vh.expenses > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground ml-auto">
                      <DollarSign className="h-3 w-3" /> ${vh.expenses.toLocaleString()} spent
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </div>

      {/* ── Active Projects ─────────────────────────────────────── */}
      {activeProjects && activeProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-heading text-muted-foreground">Active Projects</h2>
            <button onClick={() => navigate('/active-work')} className="text-xs text-primary hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {activeProjects.slice(0, 3).map(p => {
              const v = vehicles?.find(veh => veh.id === p.vehicle_id);
              const steps = projectStepCounts?.[p.id];
              const progress = steps && steps.total > 0 ? Math.round((steps.done / steps.total) * 100) : 0;
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/garage/${p.vehicle_id}/projects/${p.id}`)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/30 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {v ? `${v.year} ${v.make} ${v.model}` : ''} {steps ? `• ${steps.done}/${steps.total} steps` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {steps && steps.total > 0 && (
                      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                    <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Vehicle Expenses Summary ───────────────────────────── */}
      {vehicleExpenses && Object.keys(vehicleExpenses).length > 0 && (
        <div>
          <h2 className="section-heading text-muted-foreground mb-3">Vehicle Expenses</h2>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {vehicleHealth.filter(vh => vh.expenses > 0).map(vh => (
                  <div key={vh.vehicle.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {vh.vehicle.nickname || `${vh.vehicle.year} ${vh.vehicle.make} ${vh.vehicle.model}`}
                      </span>
                    </div>
                    <span className="text-sm font-semibold">${vh.expenses.toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-sm font-bold">
                    ${Object.values(vehicleExpenses).reduce((a, b) => a + b, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* ── OBD2 Future Teaser ─────────────────────────────────── */}
      <Card className="border-dashed border-primary/20 bg-primary/[0.02]">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary shrink-0">
            <Bluetooth className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">OBD2 Live Monitoring</p>
            <p className="text-xs text-muted-foreground">
              Connect a Bluetooth OBD2 adapter to let Ratchet read live data, fault codes, and oil life directly from your car.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">Coming Soon</Badge>
        </CardContent>
      </Card>

      {/* Maintenance Catch-Up Wizard */}
      {catchUpVehicle && (
        <MaintenanceCatchUpWizard
          open={!!catchUpVehicle}
          onOpenChange={(open) => { if (!open) setCatchUpVehicle(null); }}
          vehicleId={catchUpVehicle.id}
          vehicleLabel={catchUpVehicle.label}
          vehicleMileage={catchUpVehicle.mileage}
          services={catchUpVehicle.services}
        />
      )}
    </div>
  );
}
