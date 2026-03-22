import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus, Sparkles, Wrench, Clock, DollarSign, CheckCircle2,
  ChevronDown, PlayCircle, FolderOpen, Pause
} from 'lucide-react';
import NewProjectSheet from '@/components/vehicle/NewProjectSheet';

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-success/20 text-success',
  Intermediate: 'bg-primary/20 text-primary',
  Advanced: 'bg-warning/20 text-warning',
  Expert: 'bg-destructive/20 text-destructive',
};

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeVehicle, setAddVehicleModalOpen } = useAppStore();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, year, make, model, trim, nickname, engine, mileage');
      if (error) throw error;
      return data;
    },
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ['all-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
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

  const { data: repairStats } = useQuery({
    queryKey: ['repair-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('repair_logs').select('diy_cost, shop_quote');
      if (error) throw error;
      const totalSavings = data.reduce((acc, r) => acc + ((Number(r.shop_quote) || 0) - (Number(r.diy_cost) || 0)), 0);
      return Math.max(0, totalSavings);
    },
  });

  const active = projects?.filter(p => p.status === 'active') || [];
  const planned = projects?.filter(p => p.status === 'planning') || [];
  const paused = projects?.filter(p => p.status === 'paused') || [];
  const completed = projects?.filter(p => p.status === 'completed') || [];
  const totalMinutes = completed.reduce((s, p) => s + (p.actual_minutes || 0), 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  const vehicleMap = new Map(vehicles?.map(v => [v.id, v]) || []);

  const getStepStats = (projectId: string) => {
    const steps = allSteps?.filter(s => s.project_id === projectId) || [];
    return { total: steps.length, done: steps.filter(s => s.status === 'done').length };
  };

  const getPartsCost = (projectId: string) => {
    const parts = allParts?.filter(p => p.project_id === projectId) || [];
    return parts.reduce((s, p) => s + (Number(p.estimated_cost) || 0) * (p.quantity || 1), 0);
  };

  const handleNewProject = () => {
    if (!activeVehicle && vehicles?.length) {
      // Need vehicle selection — just open the sheet, it handles it
    }
    if (!vehicles?.length) {
      setAddVehicleModalOpen(true);
      return;
    }
    setNewProjectOpen(true);
  };

  const ProjectCard = ({ project, variant }: { project: typeof projects extends (infer T)[] | undefined ? T : never; variant: 'active' | 'planned' | 'completed' }) => {
    const v = vehicleMap.get(project.vehicle_id);
    const { total, done } = getStepStats(project.id);
    const cost = getPartsCost(project.id);
    const progress = total > 0 ? (done / total) * 100 : 0;
    const borderColor = variant === 'active' ? 'border-l-primary' : variant === 'completed' ? 'border-l-success' : 'border-l-muted-foreground';

    return (
      <Card
        className={`border-l-4 ${borderColor} cursor-pointer hover:border-primary/30 transition-all ${variant === 'completed' ? 'opacity-70' : ''}`}
        onClick={() => navigate(`/garage/${project.vehicle_id}/projects/${project.id}`)}
      >
        <CardContent className="p-4 space-y-3">
          {v && (
            <Badge variant="secondary" className="text-[11px]">
              {v.year} {v.make} {v.model}
            </Badge>
          )}
          <h3 className="text-lg font-bold leading-tight">{project.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {project.difficulty && <Badge className={`text-xs ${DIFFICULTY_COLORS[project.difficulty] || ''}`}>{project.difficulty}</Badge>}
            {total > 0 && <span className="text-xs text-muted-foreground">{done} of {total} steps</span>}
          </div>

          {variant === 'active' && total > 0 && (
            <Progress value={progress} className="h-1.5" />
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {variant === 'active' && project.actual_minutes != null && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.floor((project.actual_minutes || 0) / 60)}h {(project.actual_minutes || 0) % 60}m</span>
              )}
              {variant === 'planned' && project.estimated_minutes && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Est. {Math.round(project.estimated_minutes / 60)}h</span>
              )}
              {cost > 0 && (
                <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ${cost.toFixed(0)}</span>
              )}
              {variant === 'completed' && project.completed_at && (
                <span>{new Date(project.completed_at).toLocaleDateString()}</span>
              )}
            </div>
            {variant === 'active' && (
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs">
                Resume
              </Button>
            )}
            {variant === 'planned' && (
              <Button size="sm" variant="outline" className="h-8 text-xs">
                Start
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Empty state
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
        <Button size="lg" onClick={handleNewProject} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-[hsl(var(--card))] border-b border-border -mx-4 md:-mx-6 px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between max-w-[1200px] mx-auto">
          <div>
            <h1 className="text-2xl md:text-[28px] font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {active.length} active · {planned.length + paused.length} planned · {completed.length} completed
            </p>
          </div>
          <Button onClick={handleNewProject} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Sparkles className="h-4 w-4 mr-2" /> New Project
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-8 max-w-[1200px] mx-auto">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active repairs', sublabel: `across ${new Set(active.map(p => p.vehicle_id)).size} vehicles`, value: active.length, color: 'text-primary' },
            { label: 'Time wrenching', sublabel: 'hours in the garage', value: `${totalHours}h`, color: 'text-foreground' },
            { label: 'DIY savings', sublabel: 'saved doing it yourself', value: `$${(repairStats ?? 0).toLocaleString()}`, color: 'text-success' },
            { label: 'Completed', sublabel: 'repairs completed', value: completed.length, color: 'text-foreground' },
          ].map(stat => (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.sublabel}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Projects */}
        {active.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">In Progress</h2>
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map(p => <ProjectCard key={p.id} project={p} variant="active" />)}
            </div>
          </section>
        )}

        {/* Paused */}
        {paused.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Pause className="h-4 w-4 text-warning" /> Paused
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paused.map(p => <ProjectCard key={p.id} project={p} variant="planned" />)}
            </div>
          </section>
        )}

        {/* Planned */}
        {planned.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Up Next</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {planned.map(p => <ProjectCard key={p.id} project={p} variant="planned" />)}
            </div>
          </section>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
            <CollapsibleTrigger className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">Completed</h2>
              <Badge variant="secondary" className="text-xs">{completed.length}</Badge>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completed.slice(0, 5).map(p => <ProjectCard key={p.id} project={p} variant="completed" />)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

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
