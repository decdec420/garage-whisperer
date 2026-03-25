import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getAccessToken } from '@/lib/auth-helpers';
import { useAppStore } from '@/stores/app-store';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ArrowLeft, Search, Send, CheckCircle2, AlertCircle, Clock, Wrench,
  ChevronRight, ChevronDown, Zap, AlertTriangle, ShieldAlert, Package,
  MessageCircle, X, BookOpen, Image as ImageIcon, Camera, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import FactoryPhotoLightbox from '@/components/vehicle/FactoryPhotoLightbox';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface Message { role: 'user' | 'assistant'; content: string; }
interface TreeNode { cause: string; status: 'testing' | 'healthy' | 'faulty' | 'untested'; probability?: number; }

type StepRow = {
  id: string; project_id: string; step_number: number; title: string; description: string;
  torque_specs: any; sub_steps: string[] | null; tip: string | null; safety_note: string | null;
  estimated_minutes: number | null; status: string | null; notes: string | null;
  completed_at: string | null; sort_order: number | null; photo_urls: string[] | null;
  charm_image_url: string | null; charm_source_url: string | null; is_factory_verified: boolean | null;
};

type ToolRow = {
  id: string; project_id: string; name: string; spec: string | null;
  required: boolean | null; have_it: boolean | null; sort_order: number | null;
};

// ─── Cause Card (horizontal scroll) ───
function CauseCard({ node, onClick }: { node: TreeNode; onClick: () => void }) {
  const styles = {
    untested: { border: 'border-border', dot: 'bg-muted-foreground/30', textCls: 'text-muted-foreground' },
    testing: { border: 'border-yellow-500/40', dot: 'bg-yellow-500 animate-pulse', textCls: 'text-yellow-500' },
    healthy: { border: 'border-green-500/40', dot: 'bg-green-500', textCls: 'text-muted-foreground line-through' },
    faulty: { border: 'border-primary/60', dot: 'bg-destructive', textCls: 'text-primary font-bold' },
  };
  const s = styles[node.status];
  return (
    <button onClick={onClick}
      className={cn("shrink-0 rounded-xl border-2 p-3 min-w-[140px] max-w-[180px] text-left transition-all", s.border,
        node.status === 'faulty' && 'bg-primary/5',
        node.status === 'healthy' && 'opacity-60'
      )}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", s.dot)} />
        <span className={cn("text-xs font-semibold truncate", s.textCls)}>{node.cause}</span>
      </div>
      {node.probability !== undefined && (
        <span className="text-[11px] text-muted-foreground">{Math.round(node.probability)}% likely</span>
      )}
    </button>
  );
}

// ─── Diagnostic Step Card ───
function DiagStepCard({
  step, isActive, isCompleted, stepTools, vehicle, diagSession, treeNodes,
  onMarkResult, onImageClick, onAskRatchet, onCapturePhoto,
}: {
  step: StepRow; isActive: boolean; isCompleted: boolean; stepTools?: ToolRow[];
  vehicle: any; diagSession: any; treeNodes: TreeNode[];
  onMarkResult: (stepId: string, result: 'healthy' | 'faulty', note?: string) => void;
  onImageClick?: (url: string) => void;
  onAskRatchet: (prefill: string) => void;
  onCapturePhoto: (stepId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(isActive);
  const [resultNote, setResultNote] = useState('');
  const [checkedSubs, setCheckedSubs] = useState<Set<number>>(new Set());
  const [hasMarkedResult, setHasMarkedResult] = useState(false);
  const torqueSpecs = step.torque_specs as any[] | null;

  // Parse diagnostic metadata
  let diagMeta: any = null;
  try { if (step.notes) diagMeta = JSON.parse(step.notes); } catch {}

  const accessPath = diagMeta?.accessPath;
  const componentHW = diagMeta?.componentHardware;
  const accessHW = diagMeta?.accessHardware;
  const systemTesting = diagMeta?.systemTesting;
  const expectedResult = diagMeta?.expectedResult;
  const failureIndicator = diagMeta?.failureIndicator;
  const eliminates = diagMeta?.eliminates || [];
  const confirms = diagMeta?.confirms || [];

  // Auto-expand active step
  useEffect(() => { if (isActive) setIsOpen(true); }, [isActive]);

  const vehicleName = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '';

  if (isCompleted && !isOpen) {
    // Collapsed completed step
    const resultLabel = step.status === 'faulty'
      ? `❌ ${step.title} — problem found`
      : `✅ ${step.title} — healthy`;
    return (
      <button onClick={() => setIsOpen(true)}
        className={cn(
          "w-full text-left rounded-xl border border-border border-l-4 p-4 transition-all",
          step.status === 'faulty' ? 'border-l-destructive bg-destructive/5' : 'border-l-green-500 bg-green-500/5',
        )}>
        <div className="flex items-center gap-3">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
            step.status === 'faulty' ? 'bg-destructive/20 text-destructive' : 'bg-green-500/20 text-green-500'
          )}>
            {step.status === 'faulty' ? '✗' : '✓'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{resultLabel}</p>
            {step.status === 'healthy' && eliminates.length > 0 && (
              <p className="text-[11px] text-green-500 mt-0.5">🔍 Ruled out: {eliminates.join(', ')}</p>
            )}
            {step.status === 'faulty' && confirms.length > 0 && (
              <p className="text-[11px] text-destructive mt-0.5">🎯 Confirmed: {confirms.join(', ')}</p>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </button>
    );
  }

  if (!isActive && !isCompleted && !isOpen) {
    // Collapsed upcoming step
    return (
      <button onClick={() => setIsOpen(true)}
        className="w-full text-left rounded-xl border border-border border-l-4 border-l-muted-foreground/20 p-4 bg-card hover:border-primary/30 transition-all">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
            {step.step_number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{step.title}</p>
            {systemTesting && (
              <Badge variant="outline" className="text-[10px] h-4 mt-0.5">{systemTesting}</Badge>
            )}
            {stepTools && stepTools.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                You'll need: {stepTools.map(t => t.name).join(', ')}
              </p>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </button>
    );
  }

  // Expanded step (active, completed expanded, or upcoming expanded)
  const borderColor = isCompleted
    ? (step.status === 'faulty' ? 'border-l-destructive' : 'border-l-green-500')
    : isActive ? 'border-l-primary' : 'border-l-muted-foreground/20';
  const bgColor = isCompleted
    ? (step.status === 'faulty' ? 'bg-destructive/5' : 'bg-green-500/5')
    : isActive ? 'bg-primary/[0.03]' : 'bg-card';

  return (
    <div className={cn("rounded-xl border border-border border-l-4 overflow-hidden transition-all", borderColor,
      isActive && !isCompleted && 'shadow-[0_0_15px_-3px_hsl(var(--primary)/0.15)]'
    )}>
      {/* Header — always clickable to collapse */}
      <button onClick={() => setIsOpen(!isOpen)} className={cn("w-full text-left p-4", bgColor)}>
        <div className="flex items-center gap-3">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
            isCompleted
              ? (step.status === 'faulty' ? 'bg-destructive/20 text-destructive' : 'bg-green-500/20 text-green-500')
              : isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            {isCompleted ? (step.status === 'faulty' ? '✗' : '✓') : step.step_number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground">{step.title}</p>
            {systemTesting && (
              <Badge className="text-[10px] h-4 mt-0.5 bg-primary/10 text-primary border-primary/30">{systemTesting}</Badge>
            )}
          </div>
          {step.estimated_minutes && (
            <span className="text-xs text-muted-foreground shrink-0">{step.estimated_minutes}m</span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div className={cn("px-4 pb-4 space-y-4", bgColor)}>
          {/* Access Path */}
          {accessPath?.required && accessPath.steps?.length > 0 && (
            <Collapsible>
              <div className="rounded-xl p-3 border-l-4" style={{ background: 'hsl(48 96% 53% / 0.06)', borderColor: '#eab308' }}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                  <span className="text-sm font-bold" style={{ color: '#eab308' }}>🔍 How to reach this component</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto transition-transform" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ol className="mt-2 space-y-1.5 ml-1">
                    {accessPath.steps.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="font-bold text-muted-foreground shrink-0">{i + 1}.</span>
                        <span className="text-foreground">{s}</span>
                      </li>
                    ))}
                  </ol>
                  {accessPath.note && (
                    <p className="text-xs text-muted-foreground italic mt-2">{accessPath.note}</p>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Component Hardware */}
          {componentHW && componentHW.fasteners?.length > 0 && (
            <div className="rounded-xl p-3 border-l-4" style={{ background: 'hsl(142 71% 45% / 0.06)', borderColor: '#22c55e' }}>
              <p className="text-sm font-bold mb-2" style={{ color: '#22c55e' }}>
                🔩 {componentHW.component || 'Component'} mounting hardware
              </p>
              <div className="space-y-1">
                {componentHW.fasteners.map((f: any, i: number) => (
                  <div key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{typeof f === 'string' ? f : `${f.qty || 1}× ${f.size || ''} ${f.type || ''} ${f.note || ''}`.trim()}</span>
                  </div>
                ))}
              </div>
              {componentHW.totalCount && (
                <p className="text-xs font-bold text-foreground mt-2">Total: {componentHW.totalCount}</p>
              )}
              {componentHW.note && (
                <p className="text-xs text-muted-foreground mt-1">{componentHW.note}</p>
              )}
            </div>
          )}

          {/* Access Hardware */}
          {accessHW && accessHW.components?.length > 0 && (
            <div className="rounded-xl p-3 border-l-4" style={{ background: 'hsl(48 96% 53% / 0.06)', borderColor: '#eab308' }}>
              <p className="text-sm font-bold mb-2" style={{ color: '#eab308' }}>
                ⚠️ Access path hardware — move these FIRST
              </p>
              <div className="space-y-2">
                {accessHW.components.map((comp: any, i: number) => (
                  <div key={i}>
                    <p className="text-xs font-semibold text-foreground">{comp.name || comp.component}</p>
                    {comp.fasteners?.map((f: any, j: number) => (
                      <div key={j} className="text-sm text-foreground flex items-start gap-2 ml-3">
                        <span className="text-muted-foreground">•</span>
                        <span>{typeof f === 'string' ? f : `${f.qty || 1}× ${f.size || ''} ${f.type || ''} ${f.note || ''}`.trim()}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {accessHW.note && (
                <p className="text-xs text-muted-foreground italic mt-2">{accessHW.note}</p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="text-sm text-foreground leading-relaxed">
            <ReactMarkdown>{step.description}</ReactMarkdown>
          </div>

          {/* Step diagram */}
          {step.charm_image_url && (
            <button onClick={() => onImageClick?.(step.charm_image_url!)}
              className="w-full rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors">
              <img src={step.charm_image_url} alt={`Diagram: ${step.title}`}
                className="w-full max-h-[200px] object-contain bg-white" loading="lazy" />
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 text-[10px] text-muted-foreground">
                <BookOpen className="h-2.5 w-2.5" /> Factory Diagram · Tap to enlarge
              </div>
            </button>
          )}

          {/* Expected result */}
          {expectedResult && (
            <div className="rounded-xl p-3 border-l-[3px]" style={{ background: 'hsl(142 71% 45% / 0.06)', borderColor: '#22c55e' }}>
              <p className="text-sm text-foreground">✅ <span className="font-semibold">Healthy:</span> {expectedResult}</p>
            </div>
          )}

          {/* Failure indicator */}
          {failureIndicator && (
            <div className="rounded-xl p-3 border-l-[3px]" style={{ background: 'hsl(0 84% 60% / 0.06)', borderColor: '#ef4444' }}>
              <p className="text-sm text-foreground">❌ <span className="font-semibold">Problem:</span> {failureIndicator}</p>
            </div>
          )}

          {/* Sub-steps checklist */}
          {step.sub_steps && step.sub_steps.length > 0 && (
            <div className="space-y-2">
              {step.sub_steps.map((sub, i) => (
                <label key={i} className="flex items-start gap-3 cursor-pointer min-h-[44px] py-1">
                  <Checkbox checked={checkedSubs.has(i)}
                    onCheckedChange={() => setCheckedSubs(prev => {
                      const n = new Set(prev);
                      n.has(i) ? n.delete(i) : n.add(i);
                      return n;
                    })}
                    className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                  <span className={cn("text-sm", checkedSubs.has(i) && "text-muted-foreground line-through")}>{sub}</span>
                </label>
              ))}
            </div>
          )}

          {/* Torque Specs */}
          {torqueSpecs && torqueSpecs.length > 0 && (
            <div className="space-y-2">
              {torqueSpecs.map((ts: any, i: number) => (
                <div key={i} className="rounded-lg p-3 border-2" style={{ background: 'hsl(var(--primary) / 0.08)', borderColor: 'hsl(var(--primary) / 0.3)' }}>
                  <div className="text-xs text-muted-foreground">🔩 {ts.bolt}</div>
                  <div className="text-xl font-bold font-mono text-primary">{ts.spec} {ts.unit}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pro Tip */}
          {step.tip && (
            <div className="rounded-xl p-3 border-l-4" style={{ background: 'hsl(48 96% 53% / 0.06)', borderColor: '#eab308' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#eab308' }}>
                <Zap className="h-3 w-3 inline mr-1" />Pro Tip
              </div>
              <p className="text-sm text-foreground">{step.tip}</p>
            </div>
          )}

          {/* Safety Note */}
          {step.safety_note && (
            <div className="rounded-xl p-3 border-l-4" style={{ background: 'hsl(0 84% 60% / 0.06)', borderColor: '#ef4444' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#ef4444' }}>
                <ShieldAlert className="h-3 w-3 inline mr-1" />Safety
              </div>
              <p className="text-sm text-foreground">{step.safety_note}</p>
            </div>
          )}

          {/* Media capture + Ask Ratchet (active only) */}
          {isActive && !isCompleted && (
            <>
              <button onClick={() => onCapturePhoto(step.id)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
                <Camera className="h-4 w-4" /> 📷 Show Ratchet what you see
              </button>

              {/* Note input */}
              <input value={resultNote} onChange={e => setResultNote(e.target.value)}
                placeholder="What did you find? (optional)"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />

              {/* Result buttons */}
              <div className="flex flex-col gap-2 pt-1">
                <Button onClick={() => onMarkResult(step.id, 'healthy', resultNote)}
                  className="w-full h-14 text-base font-semibold bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="h-5 w-5 mr-2" /> Looks good — Test passed
                </Button>
                <Button onClick={() => onMarkResult(step.id, 'faulty', resultNote)}
                  variant="destructive" className="w-full h-14 text-base font-semibold">
                  <AlertCircle className="h-5 w-5 mr-2" /> Found the problem
                </Button>
              </div>

              <button onClick={() => {
                const prefill = `I'm on Step ${step.step_number} of my "${diagSession?.symptom}" diagnosis on my ${vehicleName}.\nTesting: ${step.title}.${expectedResult ? ` Expected: ${expectedResult}.` : ''}${resultNote ? ` ${resultNote}.` : ''} Help me understand what I'm seeing.`;
                onAskRatchet(prefill);
              }}
                className="text-xs text-primary hover:underline w-full text-center py-1">
                Ask Ratchet about this step
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function DiagnosisSession() {
  const { vehicleId, diagnosisId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openRatchetPanel } = useAppStore();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCreatingRepair, setIsCreatingRepair] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [lightboxState, setLightboxState] = useState<{ images: { url: string; title?: string; sourceUrl?: string }[]; index: number } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [captureStepId, setCaptureStepId] = useState<string | null>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', vehicleId!).single();
      if (error) throw error; return data;
    },
    enabled: !!vehicleId,
  });

  const { data: diagSession, isLoading: diagLoading } = useQuery({
    queryKey: ['diagnosis-session', diagnosisId],
    queryFn: async () => {
      const { data, error } = await supabase.from('diagnosis_sessions').select('*').eq('id', diagnosisId!).single();
      if (error) throw error; return data as any;
    },
    enabled: !!diagnosisId,
  });

  const { data: steps, isLoading: stepsLoading } = useQuery({
    queryKey: ['diagnosis-steps', diagSession?.project_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_steps').select('*')
        .eq('project_id', diagSession!.project_id).order('step_number');
      if (error) throw error; return data as StepRow[];
    },
    enabled: !!diagSession?.project_id,
  });

  const { data: tools } = useQuery({
    queryKey: ['diagnosis-tools', diagSession?.project_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_tools').select('*')
        .eq('project_id', diagSession!.project_id).order('sort_order');
      if (error) throw error; return data as ToolRow[];
    },
    enabled: !!diagSession?.project_id,
  });

  const { data: project } = useQuery({
    queryKey: ['diagnosis-project', diagSession?.project_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*')
        .eq('id', diagSession!.project_id).single();
      if (error) throw error; return data;
    },
    enabled: !!diagSession?.project_id,
  });

  // Load tree from session data
  useEffect(() => {
    if (!diagSession) return;
    if (diagSession.tree_data && Array.isArray(diagSession.tree_data)) {
      const nodes = (diagSession.tree_data as any[]).map((n: any, i: number) => ({
        cause: n.cause || n.name || 'Unknown',
        status: n.status || 'untested',
        probability: n.probability,
      }));
      // Calculate initial probabilities if not set
      if (!nodes.some(n => n.probability !== undefined)) {
        nodes.forEach((n, i) => {
          if (i === 0) n.probability = 50;
          else if (i === 1) n.probability = 25;
          else if (i === 2) n.probability = 15;
          else n.probability = Math.max(1, Math.round(10 / Math.max(1, nodes.length - 3)));
        });
      }
      setTreeNodes(nodes);
    }
    if (diagSession.chat_session_id) {
      supabase.from('chat_messages').select('*').eq('session_id', diagSession.chat_session_id).order('created_at')
        .then(({ data }) => {
          if (data?.length) setChatMessages(data.map(m => ({ role: m.role as any, content: m.content })));
        });
    }
  }, [diagSession]);

  useEffect(() => {
    if (!steps) return;
    const firstIncomplete = steps.findIndex(s => s.status !== 'healthy' && s.status !== 'faulty');
    setCurrentStepIndex(firstIncomplete >= 0 ? firstIncomplete : steps.length);
  }, [steps]);

  // Confidence calculation
  const calculateConfidence = (possibleCauses: string[], completedSteps: { result: 'healthy' | 'faulty'; eliminates?: string[]; confirms?: string[] }[]) => {
    if (completedSteps.length < 2) return { score: null, confirmedCause: null };
    const probs: Record<string, number> = {};
    possibleCauses.forEach((cause, i) => {
      if (i === 0) probs[cause] = 50;
      else if (i === 1) probs[cause] = 25;
      else if (i === 2) probs[cause] = 15;
      else probs[cause] = Math.max(1, 10 / Math.max(1, possibleCauses.length - 3));
    });
    let confirmedCause: string | null = null;
    for (const step of completedSteps) {
      if (step.result === 'healthy' && step.eliminates) {
        for (const elim of step.eliminates) {
          const match = possibleCauses.find(c => c.toLowerCase().includes(elim.toLowerCase()) || elim.toLowerCase().includes(c.toLowerCase()));
          if (match && probs[match] > 0) {
            const freed = probs[match]; probs[match] = 0;
            const active = Object.entries(probs).filter(([, v]) => v > 0);
            const total = active.reduce((s, [, v]) => s + v, 0);
            if (total > 0) for (const [k, v] of active) probs[k] = v + (freed * (v / total));
          }
        }
      }
      if (step.result === 'faulty' && step.confirms) {
        for (const conf of step.confirms) {
          const match = possibleCauses.find(c => c.toLowerCase().includes(conf.toLowerCase()) || conf.toLowerCase().includes(c.toLowerCase()));
          if (match) {
            confirmedCause = match;
            for (const k of Object.keys(probs)) probs[k] = 0;
            probs[match] = 95;
            possibleCauses.filter(c => c !== match).forEach(c => probs[c] = 5 / (possibleCauses.length - 1));
          }
        }
      }
    }
    return { score: confirmedCause ? 95 : Math.round(Math.max(...Object.values(probs))), confirmedCause, probs };
  };

  const markStepResult = async (stepId: string, result: 'healthy' | 'faulty', note?: string) => {
    const step = steps?.find(s => s.id === stepId);
    if (!step) return;

    await supabase.from('project_steps').update({ status: result, completed_at: new Date().toISOString() }).eq('id', stepId);

    let diagMeta: any = null;
    try { if (step.notes) diagMeta = JSON.parse(step.notes); } catch {}

    const updatedTree = treeNodes.map(n => {
      if (result === 'healthy') {
        if (diagMeta?.eliminates?.some((e: string) => n.cause.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(n.cause.toLowerCase())))
          return { ...n, status: 'healthy' as const };
        if (diagMeta?.systemTesting && (n.cause.toLowerCase().includes(diagMeta.systemTesting.toLowerCase()) || diagMeta.systemTesting.toLowerCase().includes(n.cause.toLowerCase())))
          return { ...n, status: 'healthy' as const };
      }
      if (result === 'faulty') {
        if (diagMeta?.confirms?.some((c: string) => n.cause.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(n.cause.toLowerCase())))
          return { ...n, status: 'faulty' as const };
        if (diagMeta?.systemTesting && (n.cause.toLowerCase().includes(diagMeta.systemTesting.toLowerCase()) || diagMeta.systemTesting.toLowerCase().includes(n.cause.toLowerCase())))
          return { ...n, status: 'faulty' as const };
      }
      return n;
    });

    let hasAnyTesting = updatedTree.some(n => n.status === 'testing');
    if (!hasAnyTesting && result === 'healthy') {
      const firstUntested = updatedTree.findIndex(n => n.status === 'untested');
      if (firstUntested >= 0) updatedTree[firstUntested].status = 'testing';
    }

    // Recalculate probabilities
    const allSteps = steps || [];
    const completedForConfidence: any[] = [];
    const testsSummary: any[] = [];
    for (const s of allSteps) {
      const stepResult = s.id === stepId ? result : s.status;
      if (stepResult === 'healthy' || stepResult === 'faulty') {
        let meta: any = null;
        try { if (s.notes) meta = JSON.parse(s.notes); } catch {}
        completedForConfidence.push({ result: stepResult, eliminates: meta?.eliminates, confirms: meta?.confirms });
        testsSummary.push({ step_number: s.step_number, step_title: s.title, result: stepResult, eliminated: stepResult === 'healthy' ? (meta?.eliminates || []) : [], confirmed: stepResult === 'faulty' ? (meta?.confirms || []) : [] });
      }
    }

    const possibleCauses = updatedTree.map(n => n.cause);
    const { score: confidenceScore, confirmedCause, probs } = calculateConfidence(possibleCauses, completedForConfidence) as any;

    // Update probabilities on tree nodes
    if (probs) {
      updatedTree.forEach(n => { if (probs[n.cause] !== undefined) n.probability = probs[n.cause]; });
    }

    setTreeNodes(updatedTree);

    const accessPaths: string[] = diagMeta?.accessPath?.steps || [];
    const hwNotes: string[] = [];
    if (diagMeta?.componentHardware?.note) hwNotes.push(diagMeta.componentHardware.note);
    if (diagMeta?.accessHardware?.note) hwNotes.push(diagMeta.accessHardware.note);

    await supabase.from('diagnosis_sessions').update({
      tree_data: updatedTree, updated_at: new Date().toISOString(),
      confidence_score: confidenceScore,
      confirmed_cause: confirmedCause || (result === 'faulty' ? (diagMeta?.systemTesting || step.title) : null),
      tests_summary: testsSummary, access_paths_used: accessPaths, hardware_notes: hwNotes,
      ...(result === 'faulty' ? { conclusion: diagMeta?.systemTesting || step.title, conclusion_confidence: confidenceScore || 90, status: 'resolved' } : {}),
    } as any).eq('id', diagnosisId!);

    queryClient.invalidateQueries({ queryKey: ['diagnosis-steps'] });
    queryClient.invalidateQueries({ queryKey: ['diagnosis-session'] });

    if (result === 'faulty') {
      toast.success(`Found the problem: ${diagMeta?.systemTesting || step.title}`, { description: 'Ready to create a repair project' });
    } else {
      toast.success(`${diagMeta?.systemTesting || step.title} — ruled out`);
    }
  };

  const createRepairProject = async () => {
    if (!vehicle || !diagSession || !user) return;
    setIsCreatingRepair(true);
    const faultyNode = treeNodes.find(n => n.status === 'faulty');
    const conclusion = diagSession.conclusion || faultyNode?.cause || diagSession.symptom;
    try {
      const jobDescription = `Replace/repair ${conclusion} on ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.engine ? ` ${vehicle.engine}` : ''}. Diagnosed from symptom: "${diagSession.symptom}". Diagnostic testing confirmed ${conclusion} as the root cause.`;
      const { data, error } = await supabase.functions.invoke('generate-project', { body: { vehicleId, jobDescription, userId: user.id } });
      if (error) throw error;
      const projectId = data?.project?.id || data?.projectId;
      if (!projectId) throw new Error('No project ID returned');
      await supabase.from('diagnosis_sessions').update({ diagnosis_summary: `Repair project created: ${projectId}`, status: 'resolved', updated_at: new Date().toISOString() } as any).eq('id', diagnosisId!);
      toast.success(`Repair project created for ${conclusion}`);
      navigate(`/garage/${vehicleId}/projects/${projectId}`);
    } catch (e) { console.error(e); toast.error('Failed to create repair project'); }
    setIsCreatingRepair(false);
  };

  const sendChatMessage = async (text: string) => {
    if (!text.trim() || isChatStreaming) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages); setChatInput(''); setIsChatStreaming(true);
    try {
      if (diagSession?.chat_session_id) {
        await supabase.from('chat_messages').insert({ session_id: diagSession.chat_session_id, role: 'user', content: text.trim() });
      }
      const vehicleContext = vehicle
        ? `Active vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}${vehicle.engine ? ` · ${vehicle.engine}` : ''}${vehicle.mileage ? ` · ${vehicle.mileage.toLocaleString()} mi` : ''}\n\nDIAGNOSIS IN PROGRESS for symptom: "${diagSession?.symptom}". Systems tested so far: ${treeNodes.map(n => `${n.cause} (${n.status})`).join(', ')}. Help the user with this specific diagnostic test.`
        : '';
      const accessToken = await getAccessToken();
      if (!accessToken) { toast.error('Please log in to chat'); setIsChatStreaming(false); return; }
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), vehicleContext, vehicleId: vehicleId || null }),
      });
      if (!resp.ok || !resp.body) throw new Error('Stream failed');
      const reader = resp.body.getReader(); const decoder = new TextDecoder();
      let buffer = ''; let assistantContent = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              assistantContent += c;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {}
        }
      }
      if (assistantContent && diagSession?.chat_session_id) {
        await supabase.from('chat_messages').insert({ session_id: diagSession.chat_session_id, role: 'assistant', content: assistantContent });
      }
    } catch { setChatMessages(prev => [...prev, { role: 'assistant', content: "Having trouble connecting. Try again." }]); }
    setIsChatStreaming(false);
  };

  const openAskRatchet = (prefill: string) => {
    setChatInput(prefill);
    setShowChat(true);
  };

  const handleCapturePhoto = (stepId: string) => {
    setCaptureStepId(stepId);
    photoInputRef.current?.click();
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !captureStepId) return;
    const step = steps?.find(s => s.id === captureStepId);
    if (!step) return;
    // Convert to base64 and send to chat
    const reader = new FileReader();
    reader.onload = () => {
      const vehicleName = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'my vehicle';
      const diagMeta = (() => { try { return step.notes ? JSON.parse(step.notes) : null; } catch { return null; } })();
      const prefill = `I'm on Step ${step.step_number} diagnosing "${diagSession?.symptom}" on my ${vehicleName}.\nTesting: ${step.title}. Expected: ${diagMeta?.expectedResult || 'N/A'}.\nHere's what I see. Is this healthy or the problem?`;
      setChatInput(prefill);
      setShowChat(true);
    };
    reader.readAsDataURL(file);
    setCaptureStepId(null);
  };

  if (diagLoading) return <div className="p-6"><Skeleton className="h-96 rounded-xl" /></div>;
  if (!diagSession) return <div className="p-6 text-center text-muted-foreground">Diagnosis not found</div>;

  const completedSteps = steps?.filter(s => s.status === 'healthy' || s.status === 'faulty').length || 0;
  const totalSteps = steps?.length || 0;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const hasFault = treeNodes.some(n => n.status === 'faulty');
  const faultName = treeNodes.find(n => n.status === 'faulty')?.cause || diagSession.conclusion;
  const confidenceScore = diagSession.confidence_score;
  const leadingCause = diagSession.confirmed_cause || treeNodes.reduce((best, n) => (n.probability || 0) > (best.probability || 0) ? n : best, treeNodes[0])?.cause;

  const factoryImages = (steps || []).filter(s => s.charm_image_url).map(s => ({ url: s.charm_image_url!, title: s.title, sourceUrl: s.charm_source_url || undefined }));
  const openImageInLightbox = (imageUrl: string) => {
    const idx = factoryImages.findIndex(img => img.url === imageUrl);
    setLightboxState({ images: idx >= 0 ? factoryImages : [{ url: imageUrl }], index: Math.max(0, idx) });
  };

  const scrollToCause = (causeName: string) => {
    // Find step that tests this cause
    if (!steps) return;
    for (const step of steps) {
      let meta: any = null;
      try { if (step.notes) meta = JSON.parse(step.notes); } catch {}
      const related = [...(meta?.eliminates || []), ...(meta?.confirms || [])];
      if (related.some((r: string) => r.toLowerCase().includes(causeName.toLowerCase()) || causeName.toLowerCase().includes(r.toLowerCase()))) {
        stepRefs.current[step.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden photo input */}
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />

      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: '#111111' }}>
        {/* Progress bar */}
        <div className="h-[3px]" style={{ background: '#27272a' }}>
          <div className="h-full transition-all duration-500" style={{ width: `${progressPct}%`, background: hasFault ? '#ef4444' : '#f97316' }} />
        </div>

        <div className="px-4 md:px-6 py-3">
          <div className="flex items-start gap-3">
            {/* Left column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => navigate(`/garage/${vehicleId}?tab=diagnose`)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-lg font-bold text-white truncate leading-tight">
                  {diagSession.symptom}
                </h1>
              </div>
              <div className="flex items-center gap-2 ml-7">
                {vehicle && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </span>
                )}
                <Badge className={cn("text-[10px] h-5",
                  hasFault ? 'bg-destructive/20 text-destructive' : diagSession.status === 'resolved' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'
                )}>
                  {hasFault ? 'Cause Found' : diagSession.status === 'resolved' ? 'Diagnosed' : 'In Progress'}
                </Badge>
              </div>
            </div>

            {/* Right column — progress ring + confidence */}
            <div className="flex flex-col items-center shrink-0">
              {/* Simple progress ring */}
              <div className="relative h-12 w-12">
                <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#27272a" strokeWidth="3" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke={hasFault ? '#ef4444' : '#f97316'}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${progressPct * 1.257} 125.7`} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {completedSteps}/{totalSteps}
                </span>
              </div>
              {completedSteps >= 2 && confidenceScore && (
                <div className="text-center mt-1">
                  <span className="text-[10px] text-white font-bold">{confidenceScore}%</span>
                  <p className="text-[9px] text-primary truncate max-w-[80px]">{leadingCause || 'Testing...'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Possible Causes — horizontal scroll */}
      {treeNodes.length > 0 && (
        <div className="px-4 py-3 border-b border-border bg-card/50">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {treeNodes.map((node, i) => (
              <CauseCard key={i} node={node} onClick={() => scrollToCause(node.cause)} />
            ))}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Main content */}
        <div className={cn("flex-1 p-4 md:p-6 space-y-4 min-w-0", showChat && !isMobile && "mr-[380px]")}>

          {/* Conclusion card */}
          {(hasFault || diagSession.status === 'resolved' || (confidenceScore && confidenceScore >= 90)) && (
            <Card className="border-2 border-primary/50 overflow-hidden" style={{ borderLeft: '6px solid hsl(var(--primary))' }}>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">
                  🔍 {hasFault || diagSession.confirmed_cause ? 'Diagnosis Complete' : 'Likely Diagnosis'}
                </p>
                <p className="text-xl font-bold text-primary">{faultName || leadingCause}</p>
                {confidenceScore && <p className="text-sm text-muted-foreground mt-1">Confidence: {confidenceScore}%</p>}

                {/* Evidence chain */}
                {diagSession.tests_summary && Array.isArray(diagSession.tests_summary) && (
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {(diagSession.tests_summary as any[]).filter((t: any) => t.result === 'healthy').map((t: any) => `${t.step_title} passed`).join(', ')}
                    {(diagSession.tests_summary as any[]).some((t: any) => t.result === 'faulty') && (
                      <> — <span className="text-destructive font-semibold">{(diagSession.tests_summary as any[]).filter((t: any) => t.result === 'faulty').map((t: any) => `${t.step_title} failed`).join(', ')}</span></>
                    )}
                  </p>
                )}

                <div className="flex flex-col gap-2 mt-4">
                  <Button onClick={createRepairProject} disabled={isCreatingRepair} className="w-full h-12 text-base font-semibold">
                    {isCreatingRepair ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Building repair plan...
                      </div>
                    ) : (
                      <><Wrench className="h-4 w-4 mr-2" /> Create Repair Project</>
                    )}
                  </Button>
                  {!hasFault && (
                    <Button variant="ghost" className="text-sm text-muted-foreground">Continue Testing</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Factory Diagrams Gallery */}
          {factoryImages.length > 0 && (
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Factory Diagrams</h3>
                  <Badge variant="outline" className="text-[10px] ml-auto">{factoryImages.length}</Badge>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {factoryImages.map((img, i) => (
                    <button key={i} onClick={() => setLightboxState({ images: factoryImages, index: i })}
                      className="shrink-0 rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors"
                      style={{ width: 140, height: 110 }}>
                      <img src={img.url} alt={img.title || `Diagram ${i + 1}`} className="w-full h-full object-contain bg-white" loading="lazy" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Safety warnings */}
          {project?.safety_warnings && (project.safety_warnings as string[]).length > 0 && (
            <div className="space-y-2">
              {(project.safety_warnings as string[]).map((w, i) => (
                <div key={i} className="rounded-xl p-3 border-l-4" style={{ background: 'hsl(0 84% 60% / 0.06)', borderColor: '#ef4444' }}>
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                    <p className="text-sm text-foreground">{w}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tools needed */}
          {tools && tools.length > 0 && (
            <Collapsible>
              <Card className="border-border">
                <CardContent className="p-4">
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                    <Package className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Tools Needed</h3>
                    <span className="text-xs text-muted-foreground ml-auto">{tools.length} tools</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {tools.map(t => (
                        <div key={t.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30">
                          <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-foreground">{t.name}</span>
                          {t.spec && <span className="text-xs text-muted-foreground">({t.spec})</span>}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          )}

          {/* Diagnostic Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Diagnostic Procedure
              </h3>
              <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)} className="text-xs">
                <MessageCircle className="h-3.5 w-3.5 mr-1" /> Ask Ratchet
              </Button>
            </div>

            {stepsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : (
              <div className="space-y-3">
                {steps?.map((step, i) => (
                  <div key={step.id} ref={el => { stepRefs.current[step.id] = el; }}>
                    <DiagStepCard
                      step={step}
                      isActive={i === currentStepIndex}
                      isCompleted={step.status === 'healthy' || step.status === 'faulty'}
                      stepTools={tools?.filter(t => {
                        // Match tools to step via notes metadata
                        let meta: any = null;
                        try { if (step.notes) meta = JSON.parse(step.notes); } catch {}
                        return false; // Tools are shown in collapsed upcoming only as list
                      })}
                      vehicle={vehicle}
                      diagSession={diagSession}
                      treeNodes={treeNodes}
                      onMarkResult={markStepResult}
                      onImageClick={openImageInLightbox}
                      onAskRatchet={openAskRatchet}
                      onCapturePhoto={handleCapturePhoto}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat panel (desktop) */}
        {showChat && !isMobile && (
          <div className="fixed top-0 right-0 bottom-0 w-[380px] bg-card border-l border-border z-30 flex flex-col">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">Ratchet · Diagnosis Help</span>
              </div>
              <button onClick={() => setShowChat(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-8">
                  <Wrench className="h-6 w-6 mx-auto mb-2 text-primary" />Ask Ratchet about this diagnostic step
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('px-3 py-2 text-sm rounded-xl max-w-[85%]', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                    {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                  </div>
                </div>
              ))}
              {isChatStreaming && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-1.5 px-3 py-2">
                  {[0,1,2].map(i => <span key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i*150}ms` }} />)}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-border shrink-0">
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendChatMessage(chatInput); }}
                  placeholder="Ask about this test..."
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <button onClick={() => sendChatMessage(chatInput)} disabled={!chatInput.trim() || isChatStreaming}
                  className={cn('h-9 w-9 rounded-lg flex items-center justify-center', chatInput.trim() && !isChatStreaming ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile chat sheet */}
      {showChat && isMobile && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowChat(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 h-[70dvh] bg-card rounded-t-2xl flex flex-col">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
            <div className="flex items-center justify-between px-4 h-10 border-b border-border">
              <span className="text-sm font-bold">Ratchet</span>
              <button onClick={() => setShowChat(false)} className="p-1"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('px-3 py-2 text-sm rounded-xl max-w-[85%]', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                    {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendChatMessage(chatInput); }}
                  placeholder="Ask about this test..."
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <button onClick={() => sendChatMessage(chatInput)} disabled={!chatInput.trim() || isChatStreaming}
                  className={cn('h-9 w-9 rounded-lg flex items-center justify-center', chatInput.trim() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {lightboxState && (
        <FactoryPhotoLightbox images={lightboxState.images} initialIndex={lightboxState.index} onClose={() => setLightboxState(null)} />
      )}
    </div>
  );
}
