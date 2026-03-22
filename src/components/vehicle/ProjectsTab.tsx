import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  Plus, ChevronDown, ChevronRight, Trash2,
  Circle, PlayCircle, CheckCircle2, Pause, FolderOpen,
  Wrench, Clock, Sparkles, AlertTriangle, Package
} from 'lucide-react';
import NewProjectSheet from './NewProjectSheet';

interface ProjectsTabProps {
  vehicleId: string;
  vehicleName?: string;
}

const STATUS_CONFIG = {
  planning: { label: 'Planning', icon: Circle, color: 'text-muted-foreground' },
  active: { label: 'Active', icon: PlayCircle, color: 'text-success' },
  paused: { label: 'Paused', icon: Pause, color: 'text-warning' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-muted-foreground' },
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
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch steps counts for each project
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

  const updateProjectStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'active' && !projects?.find(p => p.id === id)?.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('projects').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', vehicleId] }),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', vehicleId] });
      toast.success('Project deleted');
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
        const isExpanded = expandedProjects.has(project.id);
        const cfg = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
        const StatusIcon = cfg.icon;
        const diffClass = DIFFICULTY_COLORS[project.difficulty || ''] || '';

        return (
          <Card key={project.id} className={`border-border ${project.status === 'completed' ? 'opacity-60' : ''}`}>
            <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(project.id)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{project.title}</CardTitle>
                        {project.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{project.description}</p>
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
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  {steps.length > 0 && (
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="bg-success h-1.5 rounded-full transition-all" style={{ width: `${(doneSteps / steps.length) * 100}%` }} />
                    </div>
                  )}

                  {/* Summary */}
                  <div className="flex flex-wrap gap-3 text-sm">
                    {parts.length > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                        <span>{parts.length} parts · ${totalCost.toFixed(0)}</span>
                      </div>
                    )}
                    {project.safety_warnings && (project.safety_warnings as string[]).length > 0 && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{(project.safety_warnings as string[]).length} safety warnings</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1" />
                    <Select
                      value={project.status}
                      onValueChange={(v) => updateProjectStatus.mutate({ id: project.id, status: v })}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => { if (confirm('Delete this project and all its data?')) deleteProject.mutate(project.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
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
