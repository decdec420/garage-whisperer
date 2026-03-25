import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, Check, ChevronDown, ChevronUp, Clock,
  Camera, Wrench, Pause, Play, Zap, AlertTriangle, Lightbulb,
  ShieldAlert, ExternalLink, Package, MessageCircle, X, Mic, BookOpen, Search
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MechanicMode from '@/components/vehicle/MechanicMode';
import FactoryPhotoLightbox from '@/components/vehicle/FactoryPhotoLightbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type ProjectRow = {
  id: string; vehicle_id: string; user_id: string; title: string; description: string | null;
  status: string; difficulty: string | null; estimated_minutes: number | null;
  actual_minutes: number | null; safety_warnings: string[] | null; ai_generated: boolean | null;
  started_at: string | null; completed_at: string | null; timer_running: boolean | null;
  timer_started_at: string | null; created_at: string | null; updated_at: string | null;
};
type StepRow = {
  id: string; project_id: string; step_number: number; title: string; description: string;
  torque_specs: any; sub_steps: string[] | null; tip: string | null; safety_note: string | null;
  estimated_minutes: number | null; status: string | null; photo_urls: string[] | null;
  completed_at: string | null; notes: string | null; sort_order: number | null;
  charm_image_url: string | null; charm_source_url: string | null; is_factory_verified: boolean | null;
};
type PartRow = {
  id: string; project_id: string; name: string; part_number: string | null; brand: string | null;
  quantity: number | null; estimated_cost: number | null; actual_cost: number | null;
  notes: string | null; have_it: boolean | null; buy_url_rockauto: string | null;
  buy_url_amazon: string | null; sort_order: number | null;
};
type ToolRow = {
  id: string; project_id: string; name: string; spec: string | null;
  required: boolean | null; have_it: boolean | null; sort_order: number | null;
};
type NoteRow = {
  id: string; project_id: string; step_id: string | null; content: string; created_at: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-secondary text-secondary-foreground',
  active: 'bg-primary/20 text-primary',
  paused: 'bg-warning/20 text-warning',
  completed: 'bg-success/20 text-success',
};

const DIFF_COLORS: Record<string, string> = {
  Beginner: 'bg-success/20 text-success',
  Intermediate: 'bg-primary/20 text-primary',
  Advanced: 'bg-warning/20 text-warning',
  Expert: 'bg-destructive/20 text-destructive',
};

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ProgressRing({ completed, total, size = 64 }: { completed: number; total: number; size?: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={4}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground">{completed}/{total}</span>
      </div>
    </div>
  );
}

function DiagnosisLinkCard({ diagnosis, vehicleId }: { diagnosis: any; vehicleId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const diagDate = diagnosis.created_at ? new Date(diagnosis.created_at) : null;
  const relativeTime = diagDate ? (() => {
    const diff = Date.now() - diagDate.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  })() : '';

  const testsSummary = Array.isArray(diagnosis.tests_summary) ? diagnosis.tests_summary : [];
  const ruledOut = testsSummary.filter((t: any) => t.result === 'healthy').map((t: any) => t.step_title);
  const failed = testsSummary.filter((t: any) => t.result === 'faulty').map((t: any) => t.step_title);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border overflow-hidden" style={{ background: '#111111', borderColor: 'rgba(249,115,22,0.3)', borderLeftWidth: 4, borderLeftColor: '#f97316' }}>
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2 min-w-0">
            <Search className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">
              🔍 Diagnosed {relativeTime}
            </span>
            {diagnosis.confirmed_cause && (
              <span className="text-xs text-primary font-medium truncate">· Confirmed: {diagnosis.confirmed_cause}</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
            <div>
              <p className="text-xs text-muted-foreground">Symptom</p>
              <p className="text-sm text-foreground">{diagnosis.symptom}</p>
            </div>
            {testsSummary.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Steps performed</p>
                <div className="space-y-0.5">
                  {testsSummary.map((t: any, i: number) => (
                    <p key={i} className={`text-xs ${t.result === 'faulty' ? 'text-destructive' : 'text-green-500'}`}>
                      {t.result === 'faulty' ? '❌' : '✅'} {t.step_title}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {ruledOut.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Ruled out</p>
                <p className="text-xs text-muted-foreground/70">{ruledOut.join(', ')}</p>
              </div>
            )}
            {diagnosis.confirmed_cause && (
              <p className="text-base font-bold text-primary">{diagnosis.confirmed_cause}</p>
            )}
            <button onClick={() => navigate(`/garage/${vehicleId}/diagnose/${diagnosis.id}`)}
              className="text-xs text-primary hover:underline">
              View full diagnosis →
            </button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function ProjectDetail() {
  const { vehicleId, projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { openRatchetPanel, setRatchetProjectContext } = useAppStore();
  const [mechanicMode, setMechanicMode] = useState(false);
  const [safetyCollapsed, setSafetyCollapsed] = useState(false);
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [noteText, setNoteText] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lightboxState, setLightboxState] = useState<{ images: { url: string; title?: string; sourceUrl?: string }[]; index: number } | null>(null);
  const stepRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Queries
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId!).single();
      if (error) throw error;
      return data as ProjectRow;
    },
    enabled: !!projectId,
  });

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', vehicleId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!vehicleId,
  });

  const { data: steps = [] } = useQuery({
    queryKey: ['project-steps', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_steps').select('*').eq('project_id', projectId!)
        .order('step_number', { ascending: true });
      if (error) throw error;
      return data as StepRow[];
    },
    enabled: !!projectId,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['project-parts', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_parts').select('*').eq('project_id', projectId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as PartRow[];
    },
    enabled: !!projectId,
  });

  const { data: tools = [] } = useQuery({
    queryKey: ['project-tools', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_tools').select('*').eq('project_id', projectId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as ToolRow[];
    },
    enabled: !!projectId,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['project-notes', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_notes').select('*').eq('project_id', projectId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NoteRow[];
    },
    enabled: !!projectId,
  });

  const { data: linkedDiagnosis } = useQuery({
    queryKey: ['linked-diagnosis', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('diagnosis_sessions').select('*')
        .eq('project_id', projectId!).limit(1).single();
      if (error) return null;
      return data as any;
    },
    enabled: !!projectId,
  });

  // Timer
  useEffect(() => {
    if (!project) return;
    const base = project.actual_minutes ? project.actual_minutes * 60 : 0;
    if (project.timer_running && project.timer_started_at) {
      const start = new Date(project.timer_started_at).getTime();
      const tick = () => {
        const now = Date.now();
        setElapsedSeconds(base + Math.floor((now - start) / 1000));
      };
      tick();
      const iv = setInterval(tick, 1000);
      return () => clearInterval(iv);
    } else {
      setElapsedSeconds(base);
    }
  }, [project?.timer_running, project?.timer_started_at, project?.actual_minutes]);

  // Set project context for Ratchet panel
  useEffect(() => {
    if (project && vehicleId) {
      setRatchetProjectContext({ id: project.id, title: project.title, vehicleId });
    }
    return () => { setRatchetProjectContext(null); };
  }, [project?.id, vehicleId, setRatchetProjectContext]);

  // Auto-set active step to first non-done step
  useEffect(() => {
    if (steps.length) {
      const firstActive = steps.findIndex(s => s.status !== 'done');
      if (firstActive >= 0) {
        setActiveStepIdx(firstActive);
        setExpandedSteps(new Set([firstActive]));
      }
    }
  }, [steps.length]);

  // Mutations
  const toggleTimer = useMutation({
    mutationFn: async () => {
      if (!project) return;
      if (project.timer_running) {
        const elapsed = project.timer_started_at
          ? Math.floor((Date.now() - new Date(project.timer_started_at).getTime()) / 1000 / 60)
          : 0;
        await supabase.from('projects').update({
          timer_running: false, timer_started_at: null,
          actual_minutes: (project.actual_minutes || 0) + elapsed,
        }).eq('id', project.id);
      } else {
        await supabase.from('projects').update({
          timer_running: true, timer_started_at: new Date().toISOString(),
          status: project.status === 'planning' ? 'active' : project.status,
          started_at: project.started_at || new Date().toISOString(),
        }).eq('id', project.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'active') updates.started_at = project?.started_at || new Date().toISOString();
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      await supabase.from('projects').update(updates).eq('id', projectId!);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const completeStep = useMutation({
    mutationFn: async (stepId: string) => {
      await supabase.from('project_steps').update({
        status: 'done', completed_at: new Date().toISOString(),
      }).eq('id', stepId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-steps', projectId] });
      const nextIdx = activeStepIdx + 1;
      if (nextIdx < steps.length) {
        setActiveStepIdx(nextIdx);
        setExpandedSteps(new Set([nextIdx]));
        setTimeout(() => {
          stepRefs.current.get(nextIdx)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      } else {
        setShowCompletion(true);
      }
    },
  });

  const togglePartHave = useMutation({
    mutationFn: async ({ id, have }: { id: string; have: boolean }) => {
      await supabase.from('project_parts').update({ have_it: have }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-parts', projectId] }),
  });

  const toggleToolHave = useMutation({
    mutationFn: async ({ id, have }: { id: string; have: boolean }) => {
      await supabase.from('project_tools').update({ have_it: have }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-tools', projectId] }),
  });

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      await supabase.from('project_notes').insert({ project_id: projectId!, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
      setNoteText('');
      toast.success('Note saved');
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('project_notes').delete().eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] }),
  });

  const completedSteps = steps.filter(s => s.status === 'done').length;
  const pctDone = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;
  const totalPartsCost = parts.reduce((s, p) => s + (Number(p.estimated_cost) || 0) * (p.quantity || 1), 0);
  const partsReady = parts.filter(p => p.have_it).length;
  const requiredTools = tools.filter(t => t.required !== false);
  const optionalTools = tools.filter(t => t.required === false);
  const toolsReady = tools.filter(t => t.have_it).length;
  const allReady = parts.every(p => p.have_it) && requiredTools.every(t => t.have_it);
  const elapsedH = Math.floor(elapsedSeconds / 3600);
  const elapsedM = Math.floor((elapsedSeconds % 3600) / 60);
  const elapsedStr = elapsedH > 0 ? `${elapsedH}h ${String(elapsedM).padStart(2, '0')}m` : `${elapsedM}m`;
  const remainingMin = project?.estimated_minutes ? Math.max(0, project.estimated_minutes - Math.floor(elapsedSeconds / 60)) : null;
  const vehicleLabel = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '';

  // Collect all factory images from steps
  const factoryImages = steps
    .filter(s => s.charm_image_url)
    .map(s => ({ url: s.charm_image_url!, title: s.title, sourceUrl: s.charm_source_url || undefined }));
  const hasFactoryData = steps.some(s => s.is_factory_verified);

  if (!project || !vehicle) {
    return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (mechanicMode) {
    return (
      <MechanicMode
        project={project}
        vehicle={vehicle}
        steps={steps}
        activeStepIdx={activeStepIdx}
        onStepComplete={(stepId) => completeStep.mutate(stepId)}
        onStepChange={setActiveStepIdx}
        onExit={() => setMechanicMode(false)}
        onFinishJob={() => { setMechanicMode(false); setShowCompletion(true); }}
        openRatchetPanel={openRatchetPanel}
        elapsedStr={elapsedStr}
      />
    );
  }

  if (showCompletion) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in">
        <div className="text-center space-y-6 p-8">
          <Wrench className="h-16 w-16 text-primary mx-auto animate-scale-in" />
          <h1 className="text-3xl font-bold text-foreground">Job done.</h1>
          <p className="text-lg text-primary">{vehicleLabel}</p>
          <p className="text-muted-foreground">You spent {elapsedStr} on this repair</p>
          <div className="space-y-3 pt-4">
            <Button size="lg" className="w-full bg-primary text-primary-foreground h-14 text-lg"
              onClick={() => { navigate(`/garage/${vehicleId}`); }}>
              Log this repair
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground"
              onClick={() => navigate(`/garage/${vehicleId}`)}>
              Back to garage
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Thin sticky progress bar at top */}
      <div className="sticky top-0 z-10 h-[3px] w-full bg-border">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pctDone}%` }}
        />
      </div>
      {/* Hero Header */}
      <div className="bg-card p-4 md:p-6 border-b border-border">
        <button onClick={() => navigate(`/garage/${vehicleId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight line-clamp-2">{project.title}</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">{vehicleLabel}{vehicle.engine ? ` · ${vehicle.engine}` : ''}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={() => {
                const statuses = ['planning', 'active', 'paused', 'completed'];
                const next = statuses[(statuses.indexOf(project.status) + 1) % statuses.length];
                updateStatus.mutate(next);
              }}>
                <Badge className={`${STATUS_COLORS[project.status] || ''} capitalize cursor-pointer`}>
                  {project.status}
                </Badge>
              </button>
              {project.difficulty && <Badge className={DIFF_COLORS[project.difficulty] || ''}>{project.difficulty}</Badge>}
              {hasFactoryData && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button>
                      <Badge className="bg-primary/20 text-primary border border-primary/40 gap-1 cursor-pointer">
                        <BookOpen className="h-3 w-3" /> Factory Verified
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 text-sm">
                    <p className="font-semibold text-foreground mb-1">📖 Factory Service Manual</p>
                    <p className="text-muted-foreground text-xs">Steps, torque specs, and procedures verified against the official {vehicle?.make} factory service manual via Operation CHARM (charm.li).</p>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ProgressRing completed={completedSteps} total={steps.length} />
            {remainingMin !== null && (
              <span className="text-xs text-muted-foreground">~{formatTime(remainingMin)} left</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <Progress value={pctDone} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">Step {completedSteps} of {steps.length} complete</p>
        </div>

        {/* Timer row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="font-mono">{elapsedStr}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => toggleTimer.mutate()}>
            {project.timer_running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground gap-1.5"
            onClick={() => setMechanicMode(true)}>
            <Zap className="h-4 w-4" /> Mechanic Mode
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        {/* How we found this — diagnosis link */}
        {linkedDiagnosis && (
          <DiagnosisLinkCard diagnosis={linkedDiagnosis} vehicleId={vehicleId!} />
        )}

        {/* Factory Photo Gallery */}
        {factoryImages.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Factory Diagrams</span>
              <span className="text-xs text-muted-foreground">({factoryImages.length})</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
              {factoryImages.map((img, i) => (
                <button key={i} className="shrink-0 rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors"
                  style={{ width: 140, height: 110, background: '#0f0f0f' }}
                  onClick={() => setLightboxState({ images: factoryImages, index: i })}>
                  <img src={img.url} alt={img.title || `Diagram ${i + 1}`}
                    className="w-full h-full object-contain p-1.5" loading="lazy" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[11px] text-muted-foreground">Honda FSM · charm.li</span>
            </div>
          </div>
        )}
        {/* Safety Warnings */}
        {project.safety_warnings && (project.safety_warnings as string[]).length > 0 && (
          <Collapsible open={!safetyCollapsed} onOpenChange={(o) => setSafetyCollapsed(!o)}>
            <div className="rounded-lg border border-destructive/30 bg-[#1f0000] overflow-hidden"
              style={{ borderLeftWidth: 4, borderLeftColor: 'hsl(var(--destructive))' }}>
              <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  <span className="font-semibold text-destructive text-sm">⚠ Safety — Read Before Starting</span>
                </div>
                {safetyCollapsed ? <ChevronDown className="h-4 w-4 text-destructive" /> : <ChevronUp className="h-4 w-4 text-destructive" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="px-4 pb-4 space-y-2">
                  {(project.safety_warnings as string[]).map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-destructive shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Parts & Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Parts */}
          <Collapsible open={partsExpanded} onOpenChange={setPartsExpanded}>
            <div className="rounded-lg border border-border bg-card">
              <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Parts</span>
                  <Badge variant="secondary" className="text-xs">{parts.length}</Badge>
                  <Badge className="bg-primary/20 text-primary text-xs">${totalPartsCost.toFixed(0)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{partsReady} of {parts.length} ready</span>
                  {partsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-2">
                  {parts.map(part => (
                    <div key={part.id} className="flex items-start gap-3 py-2 border-t border-border">
                      <Checkbox checked={!!part.have_it}
                        onCheckedChange={(c) => togglePartHave.mutate({ id: part.id, have: !!c })}
                        className="mt-0.5 h-6 w-6 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        style={{ minHeight: 44, minWidth: 44, height: 44, width: 44 }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{part.name} {part.quantity && part.quantity > 1 ? `(×${part.quantity})` : ''}</p>
                        <p className="text-xs text-muted-foreground">{[part.brand, part.part_number].filter(Boolean).join(' · ')}</p>
                        {part.notes && <p className="text-xs text-muted-foreground mt-1 italic">{part.notes}</p>}
                        <div className="flex gap-2 mt-1">
                          {part.buy_url_rockauto && (
                            <a href={part.buy_url_rockauto} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary flex items-center gap-1">RockAuto <ExternalLink className="h-3 w-3" /></a>
                          )}
                          {part.buy_url_amazon && (
                            <a href={part.buy_url_amazon} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary flex items-center gap-1">Amazon <ExternalLink className="h-3 w-3" /></a>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground shrink-0">${Number(part.estimated_cost || 0).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Tools */}
          <Collapsible open={toolsExpanded} onOpenChange={setToolsExpanded}>
            <div className="rounded-lg border border-border bg-card">
              <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Tools</span>
                  <Badge variant="secondary" className="text-xs">{tools.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{toolsReady} of {tools.length} ready</span>
                  {toolsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-2">
                  {requiredTools.map(tool => (
                    <div key={tool.id} className="flex items-center gap-3 py-2 border-t border-border">
                      <Checkbox checked={!!tool.have_it}
                        onCheckedChange={(c) => toggleToolHave.mutate({ id: tool.id, have: !!c })}
                        className="h-6 w-6" style={{ minHeight: 44, minWidth: 44, height: 44, width: 44 }} />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{tool.name} <span className="text-destructive">*</span></p>
                        {tool.spec && <p className="text-xs text-muted-foreground">{tool.spec}</p>}
                      </div>
                    </div>
                  ))}
                  {optionalTools.length > 0 && (
                    <>
                      <div className="border-t border-border pt-2 mt-2">
                        <span className="text-xs text-muted-foreground">Optional</span>
                      </div>
                      {optionalTools.map(tool => (
                        <div key={tool.id} className="flex items-center gap-3 py-2">
                          <Checkbox checked={!!tool.have_it}
                            onCheckedChange={(c) => toggleToolHave.mutate({ id: tool.id, have: !!c })}
                            className="h-6 w-6" style={{ minHeight: 44, minWidth: 44, height: 44, width: 44 }} />
                          <div className="flex-1">
                            <p className="text-foreground">{tool.name}</p>
                            {tool.spec && <p className="text-xs text-muted-foreground">{tool.spec}</p>}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        {/* All ready banner */}
        {allReady && parts.length > 0 && (
          <div className="rounded-lg border border-primary/40 p-4 bg-gradient-to-r from-[#1a0a00] to-card">
            <p className="text-foreground font-medium">Everything's ready. Time to get your hands dirty.</p>
            <Button size="sm" className="mt-2 bg-primary text-primary-foreground"
              onClick={() => {
                const idx = steps.findIndex(s => s.status !== 'done');
                if (idx >= 0) {
                  setActiveStepIdx(idx);
                  setExpandedSteps(new Set([idx]));
                  stepRefs.current.get(idx)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}>
              Jump to Step {steps.findIndex(s => s.status !== 'done') + 1}
            </Button>
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Steps</h2>
          {steps.map((step, idx) => {
            const isDone = step.status === 'done';
            const isActive = idx === activeStepIdx && !isDone;
            const isExpanded = expandedSteps.has(idx) || isActive;
            const torqueSpecs = Array.isArray(step.torque_specs) ? step.torque_specs : [];

            return (
              <div key={step.id}
                ref={(el) => { if (el) stepRefs.current.set(idx, el); }}
                className={`rounded-lg overflow-hidden transition-all ${
                  isDone ? 'bg-[#0d1a0d] border border-success/20' :
                  isActive ? 'bg-[#1a0f00] border border-primary/30 shadow-[0_0_20px_rgba(249,115,22,0.08)]' :
                  'bg-card border border-border'
                }`}
                style={{ borderLeftWidth: 4, borderLeftColor: isDone ? '#22c55e' : isActive ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
              >
                {/* Step header */}
                <button className="w-full p-4 flex items-center gap-3 text-left min-h-[56px]"
                  onClick={() => {
                    if (isActive) return; // Active step stays expanded
                    const next = new Set(expandedSteps);
                    next.has(idx) ? next.delete(idx) : next.add(idx);
                    setExpandedSteps(next);
                  }}>
                  <div className={`shrink-0 flex items-center justify-center rounded-full font-bold text-sm ${
                    isDone ? 'bg-success text-success-foreground h-9 w-9' :
                    isActive ? 'bg-primary text-primary-foreground h-10 w-10' :
                    'border-2 border-border text-muted-foreground h-9 w-9'
                  }`}>
                    {isDone ? <Check className="h-5 w-5" /> : step.step_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold leading-tight ${
                      isDone ? 'text-muted-foreground line-through decoration-success/40' :
                      isActive ? 'text-xl text-foreground' : 'text-foreground'
                    }`}>
                      {step.title}
                    </p>
                    {step.estimated_minutes && !isExpanded && (
                      <span className="text-xs text-muted-foreground">~{step.estimated_minutes}m</span>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {step.estimated_minutes && (
                      <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" /> ~{step.estimated_minutes}m</Badge>
                    )}

                    {/* Factory source attribution (no photo) */}
                    {step.is_factory_verified && step.charm_source_url && (
                      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                        <BookOpen className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs text-muted-foreground">Source: Operation CHARM (charm.li) — Factory Service Manual</span>
                        <a href={step.charm_source_url} target="_blank" rel="noopener noreferrer"
                          className="ml-auto text-primary flex items-center gap-1 hover:underline text-xs">
                          View <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}

                    <div className="text-[15px] md:text-base leading-relaxed text-foreground/90 prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{step.description}</ReactMarkdown>
                    </div>

                    {/* Torque specs */}
                    <TooltipProvider>
                    {torqueSpecs.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {torqueSpecs.map((ts: any, i: number) => (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-sm text-primary ${
                                step.is_factory_verified
                                  ? 'border-2 border-primary/60 bg-primary/20'
                                  : 'border border-primary/40 bg-primary/15'
                              }`}>
                                {step.is_factory_verified ? (
                                  <BookOpen className="h-4 w-4" />
                                ) : (
                                  <Wrench className="h-4 w-4" />
                                )}
                                {!step.is_factory_verified && '~'}{ts.bolt}: {ts.spec} {ts.unit}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {step.is_factory_verified
                                ? `Confirmed — ${vehicle?.make} Factory Service Manual`
                                : 'AI estimate — verify with your service manual'}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                    </TooltipProvider>

                    {/* Sub-steps */}
                    {step.sub_steps && step.sub_steps.length > 0 && (
                      <div className="space-y-2 pl-2">
                        {step.sub_steps.map((ss, i) => (
                          <label key={i} className="flex items-start gap-3 min-h-[44px] cursor-pointer">
                            <Checkbox className="mt-0.5" style={{ minHeight: 28, minWidth: 28, height: 28, width: 28 }} />
                            <span className="text-[15px] text-foreground/90">{ss}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Tip */}
                    {step.tip && (
                      <div className="rounded-lg border border-warning/30 bg-[#1a1500] p-3" style={{ borderLeftWidth: 4, borderLeftColor: '#eab308' }}>
                        <p className="text-sm font-bold text-warning flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Pro Tip</p>
                        <p className="text-sm text-foreground mt-1">{step.tip}</p>
                      </div>
                    )}

                    {/* Safety note */}
                    {step.safety_note && (
                      <div className="rounded-lg border border-destructive/30 bg-[#1f0000] p-3" style={{ borderLeftWidth: 4, borderLeftColor: 'hsl(var(--destructive))' }}>
                        <p className="text-sm font-bold text-destructive flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Safety</p>
                        <p className="text-sm text-foreground mt-1">{step.safety_note}</p>
                      </div>
                    )}
                    {/* Ask Ratchet */}
                    <Button variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => openRatchetPanel(
                        `I'm currently on Step ${step.step_number}: "${step.title}" of the project "${project.title}". IMPORTANT: Focus ONLY on this specific step — do NOT cover other steps, the full process, or parts/tools for the overall job. Just help me with this one step: ${step.description}${step.tip ? ` (Tip noted: ${step.tip})` : ''}${step.safety_note ? ` (Safety note: ${step.safety_note})` : ''}${step.torque_specs ? ` (Torque specs: ${JSON.stringify(step.torque_specs)})` : ''}. What should I know to do THIS step correctly?`
                      )}>
                      <Wrench className="h-4 w-4 mr-2" /> Ask Ratchet about this step
                    </Button>

                    {/* Mark complete */}
                    {!isDone && (
                      <Button className="w-full h-[60px] text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => completeStep.mutate(step.id)}>
                        <Check className="h-5 w-5 mr-2" /> Done — Next Step
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Notes */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Notes</h2>
          <div className="flex gap-2">
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..." className="min-h-[48px] bg-card" />
            {noteText.trim() && (
              <Button className="bg-primary text-primary-foreground shrink-0"
                onClick={() => addNote.mutate(noteText.trim())}>Save</Button>
            )}
          </div>
          {notes.map(note => (
            <div key={note.id} className="bg-card rounded-lg p-3 border border-border">
              <div className="flex justify-between items-start">
                <p className="text-sm text-foreground">{note.content}</p>
                <button onClick={() => deleteNote.mutate(note.id)} className="text-muted-foreground hover:text-destructive shrink-0 ml-2">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {note.created_at ? new Date(note.created_at).toLocaleString() : ''}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxState && (
        <FactoryPhotoLightbox
          images={lightboxState.images}
          initialIndex={lightboxState.index}
          onClose={() => setLightboxState(null)}
        />
      )}
    </div>
  );
}
