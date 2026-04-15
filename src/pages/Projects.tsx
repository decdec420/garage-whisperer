import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Sparkles, Wrench, Clock, DollarSign, CheckCircle2,
  Pause, Play, Circle, ArrowRight, Car, ChevronRight
} from 'lucide-react';
import NewProjectSheet from '@/components/vehicle/NewProjectSheet';
import { cn } from '@/lib/utils';

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-success/20 text-success',
  Intermediate: 'bg-primary/20 text-primary',
  Advanced: 'bg-warning/20 text-warning',
  Expert: 'bg-destructive/20 text-destructive',
};

const STATUS_CONFIG = {
  active: { label: 'In Progress', icon: Play, color: 'text-primary', dotColor: 'bg-primary', borderColor: 'border-l-primary' },
  planning: { label: 'Planned', icon: Circle, color: 'text-muted-foreground', dotColor: 'bg-muted-foreground', borderColor: 'border-l-muted-foreground' },
  paused: { label: 'Paused', icon: Pause, color: 'text-warning', dotColor: 'bg-warning', borderColor: 'border-l-warning' },
  completed: { label: 'Done', icon: CheckCircle2, color: 'text-success', dotColor: 'bg-success', borderColor: 'border-l-success' },
} as const;

export default function ActiveWork() {
  const navigate = useNavigate();
  const { activeVehicle, setAddVehicleModalOpen } = useAppStore();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'vehicle' | 'status'>('vehicle');

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, year, make, model, trim, nickname, engine, mileage, color');
      if (error) throw error;
      return data;
    },
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ['all-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, status, difficulty, vehicle_id, estimated_minutes, actual_minutes, created_at, updated_at, completed_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const projectIds = projects?.map(p => p.id) || [];

  const { data: allSteps } = useQuery({
    queryKey: ['all-project-steps-summary'],
    queryFn: async () => {
      if (!projectIds.length) return [];
      const { data, error } = await supabase
        .from('project_steps')
        .select('id, project_id, status')
        .in('project_id', projectIds);
      if (error) throw error;
      return data;
    },
    enabled: projectIds.length > 0,
  });

  const { data: allParts } = useQuery({
    queryKey: ['all-project-parts-summary'],
    queryFn: async () => {
      if (!projectIds.length) return [];
      const { data, error } = await supabase
        .from('project_parts')
        .select('id, project_id, estimated_cost, quantity')
        .in('project_id', projectIds);
      if (error) throw error;
      return data;
    },
    enabled: projectIds.length > 0,
  });

  const vehicleMap = new Map(vehicles?.map(v => [v.id, v]) || []);

  const getStepStats = (projectId: string) => {
    const steps = allSteps?.filter(s => s.project_id === projectId) || [];
    return { total: steps.length, done: steps.filter(s => s.status === 'done').length };
  };

  const getPartsCost = (projectId: string) => {
    const parts = allParts?.filter(p => p.project_id === projectId) || [];
    return parts.reduce((s, p) => s + (Number(p.estimated_cost) || 0) * (p.quantity || 1), 0);
  };

  // Group projects by vehicle
  const vehicleGroups = useMemo(() => {
    if (!projects || !vehicles) return [];
    const groups = new Map<string, typeof projects>();
    for (const p of projects) {
      if (!groups.has(p.vehicle_id)) groups.set(p.vehicle_id, []);
      groups.get(p.vehicle_id)!.push(p);
    }
    // Sort vehicles: those with active projects first
    return Array.from(groups.entries())
      .map(([vehicleId, vehicleProjects]) => ({
        vehicle: vehicleMap.get(vehicleId),
        vehicleId,
        projects: vehicleProjects,
        activeCount: vehicleProjects.filter(p => p.status === 'active').length,
        totalProgress: (() => {
          const nonCompleted = vehicleProjects.filter(p => p.status !== 'completed');
          if (!nonCompleted.length) return 100;
          const stats = nonCompleted.map(p => getStepStats(p.id));
          const totalSteps = stats.reduce((a, s) => a + s.total, 0);
          const doneSteps = stats.reduce((a, s) => a + s.done, 0);
          return totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
        })(),
      }))
      .sort((a, b) => b.activeCount - a.activeCount);
  }, [projects, vehicles, allSteps]);

  // Group projects by status
  const statusGroups = useMemo(() => {
    if (!projects) return {};
    return {
      active: projects.filter(p => p.status === 'active'),
      planning: projects.filter(p => p.status === 'planning'),
      paused: projects.filter(p => p.status === 'paused'),
      completed: projects.filter(p => p.status === 'completed').slice(0, 5),
    };
  }, [projects]);

  const handleNewProject = () => {
    if (!vehicles?.length) {
      setAddVehicleModalOpen(true);
      return;
    }
    setNewProjectOpen(true);
  };

  // Summary stats
  const totalActive = projects?.filter(p => p.status === 'active').length ?? 0;
  const totalPlanned = projects?.filter(p => p.status === 'planning').length ?? 0;
  const totalPaused = projects?.filter(p => p.status === 'paused').length ?? 0;

  const ProjectRow = ({ project }: { project: any }) => {
    const { total, done } = getStepStats(project.id);
    const cost = getPartsCost(project.id);
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const config = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
    const v = vehicleMap.get(project.vehicle_id);

    return (
      <button
        onClick={() => navigate(`/garage/${project.vehicle_id}/projects/${project.id}`)}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl border border-border p-3 pl-4 text-left transition-all card-hover',
          'border-l-[3px]', config.borderColor,
          project.status === 'completed' && 'opacity-60'
        )}
      >
        <config.icon className={cn('h-4 w-4 shrink-0', config.color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{project.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {project.difficulty && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', DIFFICULTY_COLORS[project.difficulty])}>{project.difficulty}</span>
            )}
            {total > 0 && <span className="text-[11px] text-muted-foreground">{done}/{total} steps</span>}
            {cost > 0 && <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><DollarSign className="h-2.5 w-2.5" />{cost.toFixed(0)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {project.status === 'active' && total > 0 && (
            <div className="w-14 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          )}
          {total > 0 && <span className="text-xs font-medium text-muted-foreground w-8 text-right">{progress}%</span>}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
    );
  };

  if (!isLoading && (!projects || projects.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Wrench className="h-10 w-10 text-primary animate-bounce" />
        </div>
        <h1 className="text-2xl font-bold mb-2">No projects yet</h1>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Start your first repair project and Ratchet will guide you through every step.
        </p>
        <Button size="lg" onClick={handleNewProject}>
          <Sparkles className="h-5 w-5 mr-2" /> Start a Project
        </Button>
        {activeVehicle && (
          <NewProjectSheet
            open={newProjectOpen}
            onClose={() => setNewProjectOpen(false)}
            vehicleId={activeVehicle.id}
            vehicleName={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Active Work</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalActive > 0 && <span className="text-primary font-medium">{totalActive} in progress</span>}
            {totalActive > 0 && (totalPlanned + totalPaused > 0) && ' · '}
            {totalPlanned > 0 && `${totalPlanned} planned`}
            {totalPaused > 0 && ` · ${totalPaused} paused`}
            {totalActive === 0 && totalPlanned === 0 && totalPaused === 0 && 'All caught up 🎉'}
          </p>
        </div>
        <Button onClick={handleNewProject} size="sm">
          <Sparkles className="h-4 w-4 mr-2" /> New Project
        </Button>
      </div>

      {/* View toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'vehicle' | 'status')} className="w-full">
        <TabsList className="w-fit">
          <TabsTrigger value="vehicle" className="text-xs gap-1.5">
            <Car className="h-3.5 w-3.5" /> By Vehicle
          </TabsTrigger>
          <TabsTrigger value="status" className="text-xs gap-1.5">
            <Play className="h-3.5 w-3.5" /> By Status
          </TabsTrigger>
        </TabsList>

        {/* ── By Vehicle ──────────────────────────────────────── */}
        <TabsContent value="vehicle" className="space-y-6 mt-4">
          {vehicleGroups.map(({ vehicle, vehicleId, projects: vProjects, activeCount, totalProgress }) => {
            const active = vProjects.filter(p => p.status === 'active');
            const other = vProjects.filter(p => p.status !== 'active' && p.status !== 'completed');
            const completed = vProjects.filter(p => p.status === 'completed').slice(0, 2);
            const vName = vehicle
              ? (vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`)
              : 'Unknown Vehicle';

            return (
              <section key={vehicleId} className="rounded-xl border border-border overflow-hidden">
                {/* Vehicle header */}
                <button
                  onClick={() => navigate(`/garage/${vehicleId}`)}
                  className="w-full flex items-center gap-3 p-4 bg-card hover:bg-accent/30 transition-colors text-left"
                  style={{ borderLeftWidth: '4px', borderLeftColor: vehicle?.color || 'hsl(var(--primary))' }}
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Car className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{vName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {vProjects.length} project{vProjects.length !== 1 ? 's' : ''}
                      {activeCount > 0 && <span className="text-primary"> · {activeCount} active</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {totalProgress > 0 && totalProgress < 100 && (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${totalProgress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{totalProgress}%</span>
                      </div>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>

                {/* Projects under this vehicle */}
                <div className="p-3 space-y-2 bg-background">
                  {active.map(p => <ProjectRow key={p.id} project={p} />)}
                  {other.map(p => <ProjectRow key={p.id} project={p} />)}
                  {completed.map(p => <ProjectRow key={p.id} project={p} />)}
                </div>
              </section>
            );
          })}
        </TabsContent>

        {/* ── By Status ───────────────────────────────────────── */}
        <TabsContent value="status" className="space-y-6 mt-4">
          {(['active', 'planning', 'paused', 'completed'] as const).map(status => {
            const items = statusGroups[status] || [];
            if (!items.length) return null;
            const config = STATUS_CONFIG[status];
            return (
              <section key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <config.icon className={cn('h-4 w-4', config.color)} />
                  <h2 className="text-sm font-semibold uppercase tracking-wide">{config.label}</h2>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                  {status === 'active' && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </div>
                <div className="space-y-2">
                  {items.map(p => {
                    const v = vehicleMap.get(p.vehicle_id);
                    return (
                      <div key={p.id} className="relative">
                        {v && (
                          <span className="absolute -top-1 right-2 text-[9px] bg-secondary px-1.5 py-0.5 rounded-b-md text-muted-foreground z-10">
                            {v.nickname || `${v.year} ${v.make} ${v.model}`}
                          </span>
                        )}
                        <ProjectRow project={p} />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </TabsContent>
      </Tabs>

      {activeVehicle && (
        <NewProjectSheet
          open={newProjectOpen}
          onClose={() => setNewProjectOpen(false)}
          vehicleId={activeVehicle.id}
          vehicleName={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`}
        />
      )}
    </div>
  );
}
