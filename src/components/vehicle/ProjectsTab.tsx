import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Plus, ChevronDown, ChevronRight, Trash2, GripVertical,
  Circle, PlayCircle, CheckCircle2, Pause, FolderOpen, Wrench
} from 'lucide-react';

interface ProjectsTabProps {
  vehicleId: string;
}

const STATUS_CONFIG = {
  active: { label: 'Active', icon: PlayCircle, color: 'text-success' },
  paused: { label: 'Paused', icon: Pause, color: 'text-warning' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-muted-foreground' },
} as const;

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', variant: 'destructive' as const },
  high: { label: 'High', variant: 'default' as const },
  medium: { label: 'Medium', variant: 'secondary' as const },
  low: { label: 'Low', variant: 'outline' as const },
};

const TASK_STATUS = {
  todo: { label: 'To Do', icon: Circle },
  in_progress: { label: 'In Progress', icon: PlayCircle },
  done: { label: 'Done', icon: CheckCircle2 },
};

export default function ProjectsTab({ vehicleId }: ProjectsTabProps) {
  const queryClient = useQueryClient();
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addTaskProjectId, setAddTaskProjectId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [newProject, setNewProject] = useState({ title: '', description: '', priority: 'medium' });
  const [newTask, setNewTask] = useState({ title: '', description: '', estimated_cost: '' });

  const { data: projects, isLoading } = useQuery({
    queryKey: ['vehicle-projects', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_projects')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allTasks } = useQuery({
    queryKey: ['vehicle-project-tasks', vehicleId],
    queryFn: async () => {
      if (!projects?.length) return [];
      const projectIds = projects.map(p => p.id);
      const { data, error } = await supabase
        .from('vehicle_project_tasks')
        .select('*')
        .in('project_id', projectIds)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projects?.length,
  });

  const addProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('vehicle_projects').insert({
        vehicle_id: vehicleId,
        title: newProject.title,
        description: newProject.description || null,
        priority: newProject.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-projects', vehicleId] });
      setAddProjectOpen(false);
      setNewProject({ title: '', description: '', priority: 'medium' });
      toast.success('Project created');
    },
    onError: () => toast.error('Failed to create project'),
  });

  const updateProjectStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('vehicle_projects').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicle-projects', vehicleId] }),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicle_projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-projects', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-project-tasks', vehicleId] });
      toast.success('Project deleted');
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('vehicle_project_tasks').insert({
        project_id: addTaskProjectId!,
        title: newTask.title,
        description: newTask.description || null,
        estimated_cost: newTask.estimated_cost ? parseFloat(newTask.estimated_cost) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-project-tasks', vehicleId] });
      setAddTaskProjectId(null);
      setNewTask({ title: '', description: '', estimated_cost: '' });
      toast.success('Task added');
    },
    onError: () => toast.error('Failed to add task'),
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('vehicle_project_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicle-project-tasks', vehicleId] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicle_project_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-project-tasks', vehicleId] });
      toast.success('Task removed');
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getTasksForProject = (projectId: string) => allTasks?.filter(t => t.project_id === projectId) || [];

  if (isLoading) {
    return <div className="space-y-3 mt-4">{[1,2].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  if (!projects?.length) {
    return (
      <div className="mt-6 text-center py-16">
        <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Track separate jobs like ABS repair, sensor replacements, or upgrades — all in one place.
        </p>
        <Button onClick={() => setAddProjectOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Start a Project
        </Button>

        {/* Add Project Dialog */}
        <AddProjectDialog
          open={addProjectOpen}
          onOpenChange={setAddProjectOpen}
          newProject={newProject}
          setNewProject={setNewProject}
          onSubmit={() => addProject.mutate()}
          isPending={addProject.isPending}
        />
      </div>
    );
  }

  const activeProjects = projects.filter(p => p.status === 'active');
  const pausedProjects = projects.filter(p => p.status === 'paused');
  const completedProjects = projects.filter(p => p.status === 'completed');

  return (
    <div className="mt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-muted-foreground">
            {activeProjects.length} active · {completedProjects.length} completed
          </span>
        </div>
        <Button onClick={() => setAddProjectOpen(true)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> New Project
        </Button>
      </div>

      {/* Project Cards */}
      {[...activeProjects, ...pausedProjects, ...completedProjects].map(project => {
        const tasks = getTasksForProject(project.id);
        const doneTasks = tasks.filter(t => t.status === 'done').length;
        const isExpanded = expandedProjects.has(project.id);
        const StatusIcon = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG]?.icon || Circle;
        const statusColor = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG]?.color || '';
        const priorityCfg = PRIORITY_CONFIG[project.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;

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
                      <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${statusColor}`} />
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{project.title}</CardTitle>
                        {project.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{project.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={priorityCfg.variant} className="text-xs">{priorityCfg.label}</Badge>
                          {tasks.length > 0 && (
                            <span className="text-xs text-muted-foreground">{doneTasks}/{tasks.length} tasks done</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  {/* Progress bar */}
                  {tasks.length > 0 && (
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-success h-1.5 rounded-full transition-all"
                        style={{ width: `${(doneTasks / tasks.length) * 100}%` }}
                      />
                    </div>
                  )}

                  {/* Tasks */}
                  <div className="space-y-1">
                    {tasks.map(task => {
                      const TaskIcon = TASK_STATUS[task.status as keyof typeof TASK_STATUS]?.icon || Circle;
                      return (
                        <div key={task.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-accent/5 group">
                          <Checkbox
                            checked={task.status === 'done'}
                            onCheckedChange={(checked) => {
                              updateTaskStatus.mutate({ id: task.id, status: checked ? 'done' : 'todo' });
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </span>
                            {task.estimated_cost && (
                              <span className="text-xs text-muted-foreground ml-2">~${Number(task.estimated_cost).toFixed(0)}</span>
                            )}
                          </div>
                          {task.status !== 'done' && task.status !== 'in_progress' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 h-7 text-xs"
                              onClick={() => updateTaskStatus.mutate({ id: task.id, status: 'in_progress' })}
                            >
                              Start
                            </Button>
                          )}
                          {task.status === 'in_progress' && (
                            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">In Progress</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTask.mutate(task.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add task + actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => setAddTaskProjectId(project.id)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
                    </Button>
                    <div className="flex-1" />
                    <Select
                      value={project.status}
                      onValueChange={(v) => updateProjectStatus.mutate({ id: project.id, status: v })}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => { if (confirm('Delete this project and all its tasks?')) deleteProject.mutate(project.id); }}
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

      {/* Add Project Dialog */}
      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        newProject={newProject}
        setNewProject={setNewProject}
        onSubmit={() => addProject.mutate()}
        isPending={addProject.isPending}
      />

      {/* Add Task Dialog */}
      <Dialog open={!!addTaskProjectId} onOpenChange={() => setAddTaskProjectId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Add a task to this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="e.g. Order O2 sensor from RockAuto"
              value={newTask.title}
              onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
            />
            <Textarea
              placeholder="Notes or details (optional)"
              value={newTask.description}
              onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
              rows={2}
            />
            <Input
              type="number"
              placeholder="Estimated cost (optional)"
              value={newTask.estimated_cost}
              onChange={e => setNewTask(p => ({ ...p, estimated_cost: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddTaskProjectId(null)}>Cancel</Button>
            <Button
              onClick={() => addTask.mutate()}
              disabled={!newTask.title.trim() || addTask.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddProjectDialog({
  open, onOpenChange, newProject, setNewProject, onSubmit, isPending
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  newProject: { title: string; description: string; priority: string };
  setNewProject: React.Dispatch<React.SetStateAction<{ title: string; description: string; priority: string }>>;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a project to group related tasks for this vehicle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="e.g. ABS System Repair"
            value={newProject.title}
            onChange={e => setNewProject(p => ({ ...p, title: e.target.value }))}
          />
          <Textarea
            placeholder="What's the plan? (optional)"
            value={newProject.description}
            onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))}
            rows={2}
          />
          <Select value={newProject.priority} onValueChange={v => setNewProject(p => ({ ...p, priority: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={!newProject.title.trim() || isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
