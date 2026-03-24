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
  MessageCircle, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TreeNode {
  name: string;
  status: 'testing' | 'healthy' | 'faulty' | 'untested';
}

type StepRow = {
  id: string; project_id: string; step_number: number; title: string; description: string;
  torque_specs: any; sub_steps: string[] | null; tip: string | null; safety_note: string | null;
  estimated_minutes: number | null; status: string | null; notes: string | null;
  completed_at: string | null; sort_order: number | null; photo_urls: string[] | null;
};

type ToolRow = {
  id: string; project_id: string; name: string; spec: string | null;
  required: boolean | null; have_it: boolean | null; sort_order: number | null;
};

function DiagnosisTree({ nodes, onNodeClick }: { nodes: TreeNode[]; onNodeClick?: (name: string) => void }) {
  if (!nodes.length) return null;

  const statusStyles = {
    testing: { dot: 'bg-yellow-500 animate-pulse', text: 'text-yellow-500', label: 'Testing' },
    healthy: { dot: 'bg-green-500', text: 'text-green-500', label: 'Ruled out' },
    faulty: { dot: 'bg-destructive', text: 'text-destructive', label: 'Likely cause' },
    untested: { dot: 'bg-muted-foreground/30', text: 'text-muted-foreground', label: 'Not tested' },
  };

  return (
    <div className="space-y-1.5">
      {nodes.map((node, i) => {
        const style = statusStyles[node.status];
        return (
          <button
            key={i}
            onClick={() => onNodeClick?.(node.name)}
            className="flex items-center gap-2.5 px-3 py-2 w-full text-left rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className={cn("h-3 w-3 rounded-full shrink-0", style.dot)} />
            <span className={cn("text-sm flex-1", style.text, node.status === 'faulty' && 'font-semibold')}>
              {node.name}
            </span>
            {node.status === 'testing' && <Clock className="h-3 w-3 text-yellow-500" />}
            {node.status === 'healthy' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
            {node.status === 'faulty' && <AlertCircle className="h-3 w-3 text-destructive" />}
          </button>
        );
      })}
    </div>
  );
}

function StepCard({
  step,
  isActive,
  isCompleted,
  onMarkResult,
}: {
  step: StepRow;
  isActive: boolean;
  isCompleted: boolean;
  onMarkResult: (stepId: string, result: 'healthy' | 'faulty') => void;
}) {
  const [isOpen, setIsOpen] = useState(isActive);
  const torqueSpecs = step.torque_specs as any[] | null;

  // Parse diagnostic metadata from notes
  let diagMeta: any = null;
  try {
    if (step.notes) diagMeta = JSON.parse(step.notes);
  } catch {}

  const statusColor = isCompleted
    ? (step.status === 'faulty' ? 'border-l-destructive' : 'border-l-green-500')
    : isActive
    ? 'border-l-yellow-500'
    : 'border-l-muted-foreground/20';

  const bgColor = isCompleted
    ? (step.status === 'faulty' ? 'bg-destructive/5' : 'bg-green-500/5')
    : isActive
    ? 'bg-yellow-500/5'
    : 'bg-card';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full text-left rounded-xl border border-border border-l-4 p-4 transition-all",
            statusColor, bgColor,
            "hover:border-primary/30"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
              isCompleted
                ? (step.status === 'faulty' ? 'bg-destructive/20 text-destructive' : 'bg-green-500/20 text-green-500')
                : isActive ? 'bg-yellow-500/20 text-yellow-500' : 'bg-muted text-muted-foreground'
            )}>
              {isCompleted ? (step.status === 'faulty' ? '✗' : '✓') : step.step_number}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", isCompleted && step.status !== 'faulty' && 'text-muted-foreground')}>
                {step.title}
              </p>
              {diagMeta?.systemTesting && (
                <span className="text-[10px] text-muted-foreground">Testing: {diagMeta.systemTesting}</span>
              )}
            </div>
            {step.estimated_minutes && (
              <span className="text-xs text-muted-foreground shrink-0">{step.estimated_minutes}m</span>
            )}
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className={cn("mx-1 mt-1 rounded-b-xl border border-t-0 border-border p-4 space-y-4", bgColor)}>
          {/* Description */}
          <div className="text-sm text-foreground leading-relaxed">
            <ReactMarkdown>{step.description}</ReactMarkdown>
          </div>

          {/* Sub-steps */}
          {step.sub_steps && step.sub_steps.length > 0 && (
            <div className="space-y-2">
              {step.sub_steps.map((sub, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary font-bold shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-foreground">{sub}</span>
                </div>
              ))}
            </div>
          )}

          {/* Torque Specs */}
          {torqueSpecs && torqueSpecs.length > 0 && (
            <div className="space-y-2">
              {torqueSpecs.map((ts: any, i: number) => (
                <div key={i} className="rounded-lg p-3 border-2"
                  style={{ background: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.4)' }}>
                  <div className="text-xs text-muted-foreground">🔩 {ts.bolt}</div>
                  <div className="text-xl font-bold font-mono" style={{ color: '#f97316' }}>
                    {ts.spec} {ts.unit}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pro Tip */}
          {step.tip && (
            <div className="rounded-lg p-3" style={{ background: 'rgba(234,179,8,0.08)', borderLeft: '4px solid #eab308' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#eab308' }}>
                <Zap className="h-3 w-3 inline mr-1" />Pro Tip
              </div>
              <p className="text-sm text-foreground">{step.tip}</p>
            </div>
          )}

          {/* Safety Note */}
          {step.safety_note && (
            <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid #ef4444' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#ef4444' }}>
                <ShieldAlert className="h-3 w-3 inline mr-1" />Safety
              </div>
              <p className="text-sm text-foreground">{step.safety_note}</p>
            </div>
          )}

          {/* Action buttons for active step */}
          {isActive && !isCompleted && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onMarkResult(step.id, 'healthy')}
                className="flex-1 h-11 text-green-500 border-green-500/30 hover:bg-green-500/10"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Looks Good — Rule Out
              </Button>
              <Button
                variant="outline"
                onClick={() => onMarkResult(step.id, 'faulty')}
                className="flex-1 h-11 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Found the Problem
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

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
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', vehicleId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!vehicleId,
  });

  const { data: diagSession, isLoading: diagLoading } = useQuery({
    queryKey: ['diagnosis-session', diagnosisId],
    queryFn: async () => {
      const { data, error } = await supabase.from('diagnosis_sessions').select('*').eq('id', diagnosisId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!diagnosisId,
  });

  const { data: steps, isLoading: stepsLoading } = useQuery({
    queryKey: ['diagnosis-steps', diagSession?.project_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_steps').select('*')
        .eq('project_id', diagSession!.project_id)
        .order('step_number');
      if (error) throw error;
      return data as StepRow[];
    },
    enabled: !!diagSession?.project_id,
  });

  const { data: tools } = useQuery({
    queryKey: ['diagnosis-tools', diagSession?.project_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_tools').select('*')
        .eq('project_id', diagSession!.project_id)
        .order('sort_order');
      if (error) throw error;
      return data as ToolRow[];
    },
    enabled: !!diagSession?.project_id,
  });

  const { data: project } = useQuery({
    queryKey: ['diagnosis-project', diagSession?.project_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*')
        .eq('id', diagSession!.project_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!diagSession?.project_id,
  });

  // Load tree & current step from session data
  useEffect(() => {
    if (!diagSession) return;
    if (diagSession.tree_data && Array.isArray(diagSession.tree_data)) {
      setTreeNodes(diagSession.tree_data as TreeNode[]);
    }
    // Load chat messages
    if (diagSession.chat_session_id) {
      supabase.from('chat_messages').select('*')
        .eq('session_id', diagSession.chat_session_id)
        .order('created_at')
        .then(({ data }) => {
          if (data?.length) {
            setChatMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
          }
        });
    }
  }, [diagSession]);

  // Calculate current step based on completed steps
  useEffect(() => {
    if (!steps) return;
    const firstIncomplete = steps.findIndex(s => s.status !== 'healthy' && s.status !== 'faulty');
    setCurrentStepIndex(firstIncomplete >= 0 ? firstIncomplete : steps.length);
  }, [steps]);

  const markStepResult = async (stepId: string, result: 'healthy' | 'faulty') => {
    const step = steps?.find(s => s.id === stepId);
    if (!step) return;

    // Update step status
    await supabase.from('project_steps').update({
      status: result,
      completed_at: new Date().toISOString(),
    }).eq('id', stepId);

    // Update tree node
    let diagMeta: any = null;
    try { if (step.notes) diagMeta = JSON.parse(step.notes); } catch {}

    const updatedTree = treeNodes.map(n => {
      if (result === 'healthy') {
        // If this step eliminates certain causes, mark them healthy
        if (diagMeta?.eliminates?.some((e: string) =>
          n.name.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(n.name.toLowerCase())
        )) {
          return { ...n, status: 'healthy' as const };
        }
        if (diagMeta?.systemTesting && (
          n.name.toLowerCase().includes(diagMeta.systemTesting.toLowerCase()) ||
          diagMeta.systemTesting.toLowerCase().includes(n.name.toLowerCase())
        )) {
          return { ...n, status: 'healthy' as const };
        }
      }
      if (result === 'faulty') {
        if (diagMeta?.confirms?.some((c: string) =>
          n.name.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(n.name.toLowerCase())
        )) {
          return { ...n, status: 'faulty' as const };
        }
        if (diagMeta?.systemTesting && (
          n.name.toLowerCase().includes(diagMeta.systemTesting.toLowerCase()) ||
          diagMeta.systemTesting.toLowerCase().includes(n.name.toLowerCase())
        )) {
          return { ...n, status: 'faulty' as const };
        }
      }
      return n;
    });

    // Mark next untested as testing
    let hasAnyTesting = updatedTree.some(n => n.status === 'testing');
    if (!hasAnyTesting && result === 'healthy') {
      const firstUntested = updatedTree.findIndex(n => n.status === 'untested');
      if (firstUntested >= 0) updatedTree[firstUntested].status = 'testing';
    }

    setTreeNodes(updatedTree);

    // Save tree to diagnosis session
    await supabase.from('diagnosis_sessions').update({
      tree_data: updatedTree,
      updated_at: new Date().toISOString(),
      ...(result === 'faulty' ? {
        conclusion: diagMeta?.systemTesting || step.title,
        conclusion_confidence: 90,
        status: 'resolved',
      } : {}),
    } as any).eq('id', diagnosisId!);

    // Refresh data
    queryClient.invalidateQueries({ queryKey: ['diagnosis-steps'] });
    queryClient.invalidateQueries({ queryKey: ['diagnosis-session'] });

    if (result === 'faulty') {
      toast.success(`Found the problem: ${diagMeta?.systemTesting || step.title}`, {
        description: 'Ready to create a repair project',
      });
    } else {
      toast.success(`${diagMeta?.systemTesting || step.title} — ruled out`);
    }
  };

  const createRepairProject = async () => {
    if (!vehicle || !diagSession || !user) return;
    setIsCreatingRepair(true);

    const faultyNode = treeNodes.find(n => n.status === 'faulty');
    const conclusion = diagSession.conclusion || faultyNode?.name || diagSession.symptom;

    try {
      const jobDescription = `Replace/repair ${conclusion} on ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.engine ? ` ${vehicle.engine}` : ''}. Diagnosed from symptom: "${diagSession.symptom}". Diagnostic testing confirmed ${conclusion} as the root cause.`;

      const { data, error } = await supabase.functions.invoke('generate-project', {
        body: { vehicleId, jobDescription, userId: user.id },
      });

      if (error) throw error;
      const projectId = data?.project?.id || data?.projectId;
      if (!projectId) throw new Error('No project ID returned');

      // Update diagnosis session to link to repair project
      // Note: the diagnosis project_id stays as the diagnostic project
      // We store the repair project reference in diagnosis_summary
      await supabase.from('diagnosis_sessions').update({
        diagnosis_summary: `Repair project created: ${projectId}`,
        status: 'resolved',
        updated_at: new Date().toISOString(),
      } as any).eq('id', diagnosisId!);

      toast.success(`Repair project created for ${conclusion}`);
      navigate(`/garage/${vehicleId}/projects/${projectId}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create repair project');
    }
    setIsCreatingRepair(false);
  };

  // Chat with Ratchet about diagnosis
  const sendChatMessage = async (text: string) => {
    if (!text.trim() || isChatStreaming) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatStreaming(true);

    try {
      if (diagSession?.chat_session_id) {
        await supabase.from('chat_messages').insert({
          session_id: diagSession.chat_session_id, role: 'user', content: text.trim(),
        });
      }

      const vehicleContext = vehicle
        ? `Active vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}${vehicle.engine ? ` · ${vehicle.engine}` : ''}${vehicle.mileage ? ` · ${vehicle.mileage.toLocaleString()} mi` : ''}\n\nDIAGNOSIS IN PROGRESS for symptom: "${diagSession?.symptom}". Systems tested so far: ${treeNodes.map(n => `${n.name} (${n.status})`).join(', ')}. Help the user with this specific diagnostic test.`
        : '';

      const accessToken = await getAccessToken();
      if (!accessToken) { toast.error('Please log in to chat'); setIsChatStreaming(false); return; }

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          vehicleContext,
          vehicleId: vehicleId || null,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
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
        await supabase.from('chat_messages').insert({
          session_id: diagSession.chat_session_id, role: 'assistant', content: assistantContent,
        });
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Having trouble connecting. Try again." }]);
    }
    setIsChatStreaming(false);
  };

  if (diagLoading) return <div className="p-6"><Skeleton className="h-96 rounded-xl" /></div>;
  if (!diagSession) return <div className="p-6 text-center text-muted-foreground">Diagnosis not found</div>;

  const completedSteps = steps?.filter(s => s.status === 'healthy' || s.status === 'faulty').length || 0;
  const totalSteps = steps?.length || 0;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const hasFault = treeNodes.some(n => n.status === 'faulty');
  const faultName = treeNodes.find(n => n.status === 'faulty')?.name || diagSession.conclusion;

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 h-[3px]" style={{ background: '#27272a' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${progressPct}%`, background: hasFault ? '#ef4444' : '#f97316' }} />
      </div>

      {/* Header */}
      <div className="bg-card border-b border-border px-4 md:px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(`/garage/${vehicleId}?tab=diagnose`)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary shrink-0" />
              <h1 className="text-lg font-bold text-foreground truncate">
                {project?.title || `Diagnose: ${diagSession.symptom}`}
              </h1>
            </div>
            {vehicle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {vehicle.year} {vehicle.make} {vehicle.model} · {diagSession.symptom}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={cn(
              "text-xs",
              hasFault ? 'bg-destructive/20 text-destructive' : 'bg-yellow-500/20 text-yellow-500'
            )}>
              {hasFault ? 'Cause Found' : `Step ${Math.min(currentStepIndex + 1, totalSteps)} of ${totalSteps}`}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
              <MessageCircle className="h-4 w-4 mr-1" />
              Ask Ratchet
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{completedSteps}/{totalSteps} tests done</span>
          <span>{treeNodes.filter(n => n.status === 'healthy').length} ruled out</span>
          {project?.difficulty && <span>Difficulty: {project.difficulty}</span>}
          {project?.estimated_minutes && <span>~{project.estimated_minutes}m</span>}
        </div>
      </div>

      <div className="flex">
        {/* Main content */}
        <div className={cn("flex-1 p-4 md:p-6 space-y-6 min-w-0", showChat && !isMobile && "mr-[380px]")}>

          {/* Fault found banner */}
          {hasFault && (
            <Card className="border-2 border-destructive/50 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground">Root Cause Identified</h3>
                    <p className="text-primary font-semibold text-lg mt-0.5">{faultName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Diagnosed from: "{diagSession.symptom}" · {completedSteps} tests performed
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={createRepairProject} disabled={isCreatingRepair} className="flex-1">
                    {isCreatingRepair ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Building repair plan...
                      </div>
                    ) : (
                      <>
                        <Wrench className="h-4 w-4 mr-2" />
                        Create Repair Project
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Diagnostic tree summary */}
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Diagnostic Tree</h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  {treeNodes.filter(n => n.status !== 'untested').length}/{treeNodes.length} tested
                </span>
              </div>
              <DiagnosisTree nodes={treeNodes} />
            </CardContent>
          </Card>

          {/* Tools needed */}
          {tools && tools.length > 0 && (
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Tools Needed</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {tools.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30">
                      <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-foreground">{t.name}</span>
                      {t.spec && <span className="text-xs text-muted-foreground">({t.spec})</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Safety warnings */}
          {project?.safety_warnings && (project.safety_warnings as string[]).length > 0 && (
            <div className="space-y-2">
              {(project.safety_warnings as string[]).map((w, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid #ef4444' }}>
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                    <p className="text-sm text-foreground">{w}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Diagnostic Steps */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Diagnostic Procedure
            </h3>
            {stepsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : (
              <div className="space-y-3">
                {steps?.map((step, i) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    isActive={i === currentStepIndex}
                    isCompleted={step.status === 'healthy' || step.status === 'faulty'}
                    onMarkResult={markStepResult}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat panel (desktop side panel) */}
        {showChat && !isMobile && (
          <div className="fixed top-0 right-0 bottom-0 w-[380px] bg-card border-l border-border z-30 flex flex-col">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">Ratchet · Diagnosis Help</span>
              </div>
              <button onClick={() => setShowChat(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-8">
                  <Wrench className="h-6 w-6 mx-auto mb-2 text-primary" />
                  Ask Ratchet about this diagnostic step
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'px-3 py-2 text-sm rounded-xl max-w-[85%]',
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  )}>
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
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendChatMessage(chatInput); }}
                  placeholder="Ask about this test..."
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => sendChatMessage(chatInput)}
                  disabled={!chatInput.trim() || isChatStreaming}
                  className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center',
                    chatInput.trim() && !isChatStreaming ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
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
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-4 h-10 border-b border-border">
              <span className="text-sm font-bold">Ratchet</span>
              <button onClick={() => setShowChat(false)} className="p-1"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'px-3 py-2 text-sm rounded-xl max-w-[85%]',
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  )}>
                    {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendChatMessage(chatInput); }}
                  placeholder="Ask about this test..."
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => sendChatMessage(chatInput)}
                  disabled={!chatInput.trim() || isChatStreaming}
                  className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center',
                    chatInput.trim() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
