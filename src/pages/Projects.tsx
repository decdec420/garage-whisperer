import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus, Sparkles, Wrench, Clock, DollarSign, CheckCircle2,
  ChevronDown, Pause, Play, Circle, ArrowRight
} from 'lucide-react';
import NewProjectSheet from '@/components/vehicle/NewProjectSheet';

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-success/20 text-success',
  Intermediate: 'bg-primary/20 text-primary',
  Advanced: 'bg-warning/20 text-warning',
  Expert: 'bg-destructive/20 text-destructive',
};

export default function ActiveWork() {
  const navigate = useNavigate();
  const { activeVehicle, setAddVehicleModalOpen } = useAppStore();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

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

  const active = projects?.filter(p => p.status === 'active') || [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const readyToStart = projects?.filter(p => p.status === 'planning' && p.updated_at && p.updated_at < sevenDaysAgo) || [];
  const planned = projects?.filter(p => p.status === 'planning' && !readyToStart.some(r => r.id === p.id)) || [];
  const paused = projects?.filter(p => p.status === 'paused') || [];
  const completed = projects?.filter(p => p.status === 'completed').slice(0, 3) || [];

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
    if (!vehicles?.length) {
      setAddVehicleModalOpen(true);
      return;
    }
    setNewProjectOpen(true);
  };

  const ProjectCard = ({ project, variant }: { project: any; variant: 'active' | 'planned' | 'completed' }) => {
    const v = vehicleMap.get(project.vehicle_id);
    const { total, done } = getStepStats(project.id);
    const cost = getPartsCost(project.id);
    const progress = total > 0 ? (done / total) * 100 : 0;
    const StatusIcon = variant === 'active' ? Play : variant === 'completed' ? CheckCircle2 : Circle;
    const borderColor = variant === 'active' ? 'border-l-primary' : variant === 'completed' ? 'border-l-success' : 'border-l-muted-foreground';

    return (
      <Card
        className={`border-l-4 ${borderColor} cursor-pointer hover:border-primary/40 hover:scale-[1.01] transition-all duration-150 ${variant === 'completed' ? 'opacity-70' : ''}`}
        onClick={() => navigate(`/garage/${project.vehicle_id}/projects/${project.id}`)}
      >
        <CardContent className="p-4 space-y-3">
          {v && (
            <Badge variant="secondary" className="text-[11px]">
              {v.year} {v.make} {v.model}
            </Badge>
          )}
          <div className="flex items-start gap-3">
            <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${variant === 'active' ? 'text-primary' : variant === 'completed' ? 'text-success' : 'text-muted-foreground'}`} />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-tight">{project.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {project.difficulty && <Badge className={`text-xs ${DIFFICULTY_COLORS[project.difficulty] || ''}`}>{project.difficulty}</Badge>}
                {total > 0 && <span className="text-xs text-muted-foreground">{done}/{total} steps</span>}
              </div>
            </div>
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
            <Button size="sm" variant={variant === 'active' ? 'default' : 'ghost'} className="text-xs gap-1 h-8">
              {variant === 'active' ? 'Resume' : variant === 'completed' ? 'View' : 'Open'}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
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
            <h1 className="text-2xl md:text-[28px] font-bold">Active Work</h1>
            <p className="text-sm text-muted-foreground mt-1">
              What's happening across your garage
            </p>
          </div>
          <Button onClick={handleNewProject} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Sparkles className="h-4 w-4 mr-2" /> New Project
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-8 max-w-[1200px] mx-auto">
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

        {/* Ready to start */}
        {readyToStart.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Ready to Start</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {readyToStart.map(p => <ProjectCard key={p.id} project={p} variant="planned" />)}
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
              <h2 className="text-lg font-semibold">Recently Completed</h2>
              <Badge variant="secondary" className="text-xs">{completed.length}</Badge>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completed.map(p => <ProjectCard key={p.id} project={p} variant="completed" />)}
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
