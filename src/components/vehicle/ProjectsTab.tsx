import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Plus, Trash2,
  Circle, Play, CheckCircle2, Pause, FolderOpen,
  Clock, Sparkles, AlertTriangle, Package, ArrowRight
} from 'lucide-react';
import NewProjectSheet from './NewProjectSheet';

interface ProjectsTabProps {
  vehicleId: string;
  vehicleName?: string;
}

const STATUS_CONFIG = {
  planning: { label: 'Planning', icon: Circle, color: 'text-muted-foreground', border: 'border-l-muted-foreground' },
  active: { label: 'Active', icon: Play, color: 'text-primary', border: 'border-l-primary' },
  paused: { label: 'Paused', icon: Pause, color: 'text-warning', border: 'border-l-warning' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-success', border: 'border-l-success' },
} as const;

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-success/20 text-success',
  Intermediate: 'bg-primary/20 text-primary',
  Advanced: 'bg-warning/20 text-warning',
  Expert: 'bg-destructive/20 text-destructive',
};

export default function ProjectsTab({ vehicleId, vehicleName }: ProjectsTabProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, status, difficulty, vehicle_id, estimated_minutes, created_at, updated_at, ai_generated, safety_warnings')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const projectIds = projects?.map(p => p.id) || [];
  const { data: allSteps } = useQuery({
    queryKey: ['project-steps-summary', vehicleId],
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
    queryKey: ['project-parts-summary', vehicleId],
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

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      // Delete child records first to avoid FK constraint errors
      await Promise.all([
        supabase.from('project_steps').delete().eq('project_id', id),
        supabase.from('project_parts').delete().eq('project_id', id),
        supabase.from('project_tools').delete().eq('project_id', id),
        supabase.from('project_notes').delete().eq('project_id', id),
      ]);
      // Unlink any diagnosis/chat sessions (set project_id to null)
      await Promise.all([
        supabase.from('diagnosis_sessions').update({ project_id: null }).eq('project_id', id),
        supabase.from('chat_sessions').update({ project_id: null }).eq('project_id', id),
        supabase.from('diagnosis_feedback').update({ project_id: null }).eq('project_id', id),
      ]);
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', vehicleId] });
      toast.success('Project deleted');
    },
  });

  if (isLoading) {
    return <div className="space-y-3 mt-4">{[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  if (!projects?.length) {
    return (
      <div className="mt-6 text-center py-16">
        <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Tell Ratchet what you're working on and get a complete repair plan — parts, tools, and step-by-step instructions for your exact car.
        </p>
        <Button onClick={() => setNewProjectOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Start a Project
        </Button>
        <NewProjectSheet
          open={newProjectOpen}
          onClose={() => setNewProjectOpen(false)}
          vehicleId={vehicleId}
          vehicleName={vehicleName || 'your vehicle'}
        />
      </div>
    );
  }

  const statusOrder = ['active', 'planning', 'paused', 'completed'];
  const sorted = [...projects].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {projects.filter(p => p.status === 'active').length} active · {projects.filter(p => p.status === 'completed').length} completed
        </span>
        <Button onClick={() => setNewProjectOpen(true)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> New Project
        </Button>
      </div>

      {sorted.map(project => {
        const steps = allSteps?.filter(s => s.project_id === project.id) || [];
        const doneSteps = steps.filter(s => s.status === 'done').length;
        const parts = allParts?.filter(p => p.project_id === project.id) || [];
        const totalCost = parts.reduce((s, p) => s + (Number(p.estimated_cost) || 0) * (p.quantity || 1), 0);
        const cfg = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
        const StatusIcon = cfg.icon;
        const diffClass = DIFFICULTY_COLORS[project.difficulty || ''] || '';
        const progressPct = steps.length > 0 ? (doneSteps / steps.length) * 100 : 0;

        return (
          <Card
            key={project.id}
            className={`border-l-4 ${cfg.border} ${project.status === 'completed' ? 'opacity-60' : ''} cursor-pointer hover:border-primary/40 hover:scale-[1.01] transition-all duration-150 group`}
            onClick={() => navigate(`/garage/${vehicleId}/projects/${project.id}`)}
          >
            <CardContent className="p-4 space-y-3">
              {/* Title row */}
              <div className="flex items-start gap-3">
                <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.color}`} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold truncate">{project.title}</h3>
                  {project.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {project.difficulty && <Badge className={`text-xs ${diffClass}`}>{project.difficulty}</Badge>}
                    {project.ai_generated && (
                      <Badge variant="secondary" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> AI</Badge>
                    )}
                    {project.estimated_minutes && (
                      <Badge variant="outline" className="text-xs gap-1"><Clock className="h-3 w-3" /> ~{project.estimated_minutes}m</Badge>
                    )}
                    {steps.length > 0 && (
                      <span className="text-xs text-muted-foreground">{doneSteps}/{steps.length} steps</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {steps.length > 0 && (
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all duration-400" style={{ width: `${progressPct}%` }} />
                </div>
              )}

              {/* Bottom row */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  {parts.length > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <Package className="h-3.5 w-3.5" />
                      {parts.length} parts · ${totalCost.toFixed(0)}
                    </span>
                  )}
                  {project.safety_warnings && (project.safety_warnings as string[]).length > 0 && (
                    <span className="flex items-center gap-1 text-destructive text-xs">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {(project.safety_warnings as string[]).length} warnings
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this project and all its data?')) deleteProject.mutate(project.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant={project.status === 'active' ? 'default' : 'ghost'} className="text-xs gap-1">
                    {project.status === 'active' ? 'Resume' : project.status === 'completed' ? 'View' : 'Start'}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <NewProjectSheet
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        vehicleId={vehicleId}
        vehicleName={vehicleName || 'your vehicle'}
      />
    </div>
  );
}
