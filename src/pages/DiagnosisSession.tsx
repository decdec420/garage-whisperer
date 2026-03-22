import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Search, Send, CheckCircle2, AlertCircle, Clock, Wrench, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

const QUICK_RESPONSES = [
  { label: '✅ Looks fine / normal', value: 'Looks fine, normal.' },
  { label: '❌ Looks bad / abnormal', value: 'Looks bad, abnormal.' },
  { label: '⏭ Can\'t check this right now', value: "I can't check this right now." },
];

function DiagnosisTree({ nodes }: { nodes: TreeNode[] }) {
  if (!nodes.length) return null;

  const statusStyles = {
    testing: { dot: 'bg-yellow-500 animate-pulse', text: 'text-yellow-500' },
    healthy: { dot: 'bg-green-500', text: 'text-green-500' },
    faulty: { dot: 'bg-destructive', text: 'text-destructive' },
    untested: { dot: 'bg-muted-foreground/30', text: 'text-muted-foreground' },
  };

  return (
    <div className="space-y-1">
      {nodes.map((node, i) => {
        const style = statusStyles[node.status];
        return (
          <div key={i} className="flex items-center gap-2.5 px-3 py-1.5">
            <div className="flex items-center gap-1 text-muted-foreground/40 w-4 justify-center">
              {i === 0 ? '┌' : i === nodes.length - 1 ? '└' : '├'}
            </div>
            <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", style.dot)} />
            <span className={cn("text-sm", style.text, node.status === 'faulty' && 'font-semibold')}>
              {node.name}
            </span>
            {node.status === 'testing' && (
              <span className="text-[10px] text-yellow-500/70 ml-auto">Testing...</span>
            )}
            {node.status === 'healthy' && (
              <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
            )}
            {node.status === 'faulty' && (
              <AlertCircle className="h-3 w-3 text-destructive ml-auto" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConclusionCard({
  conclusion,
  confidence,
  onCreateProject,
  onKeepDiagnosing,
  isCreatingProject,
}: {
  conclusion: string;
  confidence: number;
  onCreateProject: () => void;
  onKeepDiagnosing: () => void;
  isCreatingProject: boolean;
}) {
  return (
    <div
      className="mx-4 mb-3 rounded-xl p-4 border-2"
      style={{
        background: '#1a1a1a',
        borderColor: '#f97316',
        borderLeftWidth: '4px',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Search className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-foreground">Diagnosis Complete</span>
      </div>
      <p className="text-base font-semibold text-foreground mb-1">
        Most likely cause: {conclusion}
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        Confidence: {confidence}%
      </p>
      <div className="flex gap-2">
        <Button
          onClick={onCreateProject}
          disabled={isCreatingProject}
          className="flex-1 h-10"
        >
          {isCreatingProject ? (
            <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <>Create Repair Project <ChevronRight className="h-4 w-4 ml-1" /></>
          )}
        </Button>
        <Button variant="outline" onClick={onKeepDiagnosing} className="h-10">
          Keep Diagnosing
        </Button>
      </div>
    </div>
  );
}

export default function DiagnosisSession() {
  const { vehicleId, diagnosisId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [showConclusion, setShowConclusion] = useState(false);
  const [conclusionText, setConclusionText] = useState('');
  const [conclusionConfidence, setConclusionConfidence] = useState(0);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', vehicleId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!vehicleId,
  });

  const { data: diagSession, isLoading } = useQuery({
    queryKey: ['diagnosis-session', diagnosisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diagnosis_sessions')
        .select('*')
        .eq('id', diagnosisId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!diagnosisId,
  });

  // Load existing messages + tree data
  useEffect(() => {
    if (!diagSession) return;
    if (diagSession.tree_data && Array.isArray(diagSession.tree_data)) {
      setTreeNodes(diagSession.tree_data as TreeNode[]);
    }
    if (diagSession.conclusion) {
      setConclusionText(diagSession.conclusion);
      setConclusionConfidence(diagSession.conclusion_confidence || 0);
      if (diagSession.status === 'resolved' || diagSession.conclusion_confidence >= 85) {
        setShowConclusion(true);
      }
    }
    // Load chat messages
    if (diagSession.chat_session_id) {
      supabase.from('chat_messages').select('*')
        .eq('session_id', diagSession.chat_session_id)
        .order('created_at')
        .then(({ data }) => {
          if (data?.length) {
            setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
          } else {
            // First load — send initial diagnosis message
            sendInitialDiagnosis();
          }
        });
    }
  }, [diagSession]);

  const vehicleContext = vehicle
    ? `Active vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}${vehicle.engine ? ` · ${vehicle.engine}` : ''}${vehicle.mileage ? ` · ${vehicle.mileage.toLocaleString()} mi` : ''}`
    : '';

  const diagnosisSystemAddendum = diagSession
    ? `\n\nDIAGNOSIS MODE ACTIVE. Symptom reported: "${diagSession.symptom}"\n\nYou are running a structured diagnostic session. Rules:\n- Start with the most COMMON cause for this symptom on this specific vehicle\n- Ask ONE diagnostic question or test at a time\n- Each test should be something checkable with basic tools or observation\n- After each answer, update your working theory and reasoning briefly\n- Include a confidence percentage: "I'm now X% sure this is Y"\n- When confidence reaches 85%+: state your conclusion clearly with "DIAGNOSIS CONCLUSION:" prefix, the part/system name, and the confidence number\n- Format each diagnostic step as:\n  ## What to check: [short title]\n  [Clear instruction]\n  **If it's fine:** [expected result]\n  **If it's the problem:** [problem indicator]\n  Then ask: "What did you find?"\n- When listing systems to investigate, prefix each with "TREE_NODE:" for tracking`
    : '';

  const sendInitialDiagnosis = async () => {
    if (!diagSession || !vehicle) return;
    setIsStreaming(true);

    const initialMessage = `My ${vehicle.year} ${vehicle.make} ${vehicle.model} has this problem: ${diagSession.symptom}`;
    const userMsg: Message = { role: 'user', content: initialMessage };
    setMessages([userMsg]);

    try {
      if (diagSession.chat_session_id) {
        await supabase.from('chat_messages').insert({
          session_id: diagSession.chat_session_id,
          role: 'user',
          content: initialMessage,
        });
      }

      await streamMessage([userMsg]);
    } catch (e) {
      console.error(e);
      setIsStreaming(false);
    }
  };

  const streamMessage = async (allMessages: Message[]) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: allMessages.map(m => ({ role: m.role, content: m.content })),
        vehicleContext: vehicleContext + diagnosisSystemAddendum,
        userId: user?.id,
        vehicleId: vehicleId || null,
      }),
    });

    if (resp.status === 429) { toast.error('Rate limited. Wait a moment.'); setIsStreaming(false); return; }
    if (resp.status === 402) { toast.error('Credits exhausted.'); setIsStreaming(false); return; }
    if (!resp.ok || !resp.body) throw new Error('Stream failed');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
              }
              return [...prev, { role: 'assistant', content: assistantContent }];
            });
          }
        } catch { /* partial */ }
      }
    }

    // Parse tree nodes and conclusion from response
    if (assistantContent) {
      if (diagSession?.chat_session_id) {
        await supabase.from('chat_messages').insert({
          session_id: diagSession.chat_session_id,
          role: 'assistant',
          content: assistantContent,
        });
      }

      // Extract tree nodes
      const treeMatches = assistantContent.match(/TREE_NODE:\s*(.+)/g);
      if (treeMatches) {
        const newNodes = treeMatches.map(m => ({
          name: m.replace('TREE_NODE:', '').trim(),
          status: 'untested' as const,
        }));
        // Merge with existing, marking first untested as testing
        setTreeNodes(prev => {
          const existingNames = new Set(prev.map(n => n.name));
          const merged = [...prev];
          for (const node of newNodes) {
            if (!existingNames.has(node.name)) merged.push(node);
          }
          // Mark first untested as testing
          let foundTesting = false;
          return merged.map(n => {
            if (n.status === 'untested' && !foundTesting) {
              foundTesting = true;
              return { ...n, status: 'testing' as const };
            }
            return n;
          });
        });
      }

      // Extract "What to check:" to update tree
      const checkMatch = assistantContent.match(/## What to check:\s*(.+)/i);
      if (checkMatch) {
        const checkingName = checkMatch[1].trim();
        setTreeNodes(prev => {
          const updated = prev.map(n => ({
            ...n,
            status: n.name.toLowerCase().includes(checkingName.toLowerCase()) ||
                    checkingName.toLowerCase().includes(n.name.toLowerCase())
              ? 'testing' as const
              : n.status,
          }));
          // If no match found, add it
          if (!updated.some(n => n.status === 'testing')) {
            updated.push({ name: checkingName, status: 'testing' });
          }
          return updated;
        });
      }

      // Check for conclusion
      const conclusionMatch = assistantContent.match(/DIAGNOSIS CONCLUSION:\s*(.+?)(?:\n|$)/i);
      const confidenceMatch = assistantContent.match(/(\d{2,3})%\s*(?:sure|confident|confidence)/i);
      if (conclusionMatch) {
        const concl = conclusionMatch[1].trim();
        const conf = confidenceMatch ? parseInt(confidenceMatch[1]) : 85;
        setConclusionText(concl);
        setConclusionConfidence(conf);
        if (conf >= 85) setShowConclusion(true);

        // Update tree — mark the concluded system as faulty
        setTreeNodes(prev => prev.map(n => ({
          ...n,
          status: n.status === 'testing' ? 'faulty' as const : n.status,
        })));

        // Save to DB
        await supabase.from('diagnosis_sessions').update({
          conclusion: concl,
          conclusion_confidence: conf,
          status: conf >= 85 ? 'resolved' : 'active',
          tree_data: treeNodes,
          updated_at: new Date().toISOString(),
        } as any).eq('id', diagnosisId!);
      }

      // Save tree to DB
      await supabase.from('diagnosis_sessions').update({
        tree_data: treeNodes,
        updated_at: new Date().toISOString(),
      } as any).eq('id', diagnosisId!);
    }

    setIsStreaming(false);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    // Mark current testing node based on response
    if (text.toLowerCase().includes('fine') || text.toLowerCase().includes('normal') || text.toLowerCase().includes('looks good')) {
      setTreeNodes(prev => prev.map(n => n.status === 'testing' ? { ...n, status: 'healthy' as const } : n));
    }

    try {
      if (diagSession?.chat_session_id) {
        await supabase.from('chat_messages').insert({
          session_id: diagSession.chat_session_id,
          role: 'user',
          content: text.trim(),
        });
      }
      await streamMessage(newMessages);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'assistant', content: "Having trouble connecting. Try again." }]);
      setIsStreaming(false);
    }
  };

  const createProjectFromDiagnosis = async () => {
    if (!vehicle || !diagSession || !user) return;
    setIsCreatingProject(true);

    try {
      const jobDescription = `${conclusionText} replacement/repair on ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.engine ? ` ${vehicle.engine}` : ''}. Diagnosed from symptom: "${diagSession.symptom}". ${diagSession.diagnosis_summary || ''}`;

      const { data, error } = await supabase.functions.invoke('generate-project', {
        body: {
          vehicleId,
          jobDescription,
          userId: user.id,
        },
      });

      if (error) throw error;
      const projectId = data?.projectId;
      if (!projectId) throw new Error('No project ID returned');

      // Link diagnosis to project
      await supabase.from('diagnosis_sessions').update({
        project_id: projectId,
        status: 'resolved',
        updated_at: new Date().toISOString(),
      } as any).eq('id', diagnosisId!);

      toast.success(`Project created for ${conclusionText}`);
      navigate(`/garage/${vehicleId}/projects/${projectId}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create project');
    }
    setIsCreatingProject(false);
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 rounded-xl" /></div>;
  if (!diagSession) return <div className="p-6 text-center text-muted-foreground">Diagnosis not found</div>;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 bg-card border-b border-border shrink-0">
        <button onClick={() => navigate(`/garage/${vehicleId}?tab=diagnose`)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">Diagnosing: {diagSession.symptom}</p>
          {vehicle && (
            <p className="text-xs text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Search className="h-4 w-4 text-primary" />
          <span className="text-xs text-primary font-medium">Diagnosis Mode</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Tree panel — desktop sidebar, mobile top strip */}
        <div className="hidden md:flex flex-col w-64 bg-card border-r border-border shrink-0 overflow-y-auto">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Diagnostic Tree</p>
            <p className="text-xs text-primary mt-1 truncate">Symptom: {diagSession.symptom}</p>
          </div>
          <div className="p-2 flex-1">
            {treeNodes.length > 0 ? (
              <DiagnosisTree nodes={treeNodes} />
            ) : (
              <p className="text-xs text-muted-foreground p-3">Tree will build as Ratchet tests each system...</p>
            )}
          </div>
        </div>

        {/* Mobile tree strip */}
        {treeNodes.length > 0 && (
          <div className="md:hidden shrink-0 absolute top-14 left-0 right-0 z-10 bg-card/95 backdrop-blur border-b border-border px-3 py-2">
            <div className="flex gap-3 overflow-x-auto">
              {treeNodes.map((node, i) => {
                const dotColor = {
                  testing: 'bg-yellow-500 animate-pulse',
                  healthy: 'bg-green-500',
                  faulty: 'bg-destructive',
                  untested: 'bg-muted-foreground/30',
                }[node.status];
                return (
                  <div key={i} className="flex items-center gap-1.5 shrink-0">
                    <div className={cn("h-2 w-2 rounded-full", dotColor)} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{node.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className={cn("flex-1 overflow-y-auto p-4 space-y-4", treeNodes.length > 0 && "md:pt-4 pt-12")}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'flex animate-fade-in',
                  m.role === 'user' ? 'justify-end' : 'justify-start gap-2'
                )}
              >
                {m.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Search className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <div className={cn(
                  'px-4 py-3 text-sm max-w-[85%]',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                    : 'bg-card border border-border text-foreground rounded-2xl rounded-bl-sm'
                )}>
                  {m.role === 'assistant' ? (
                    <div className="max-w-none prose-sm">
                      <ReactMarkdown>{m.content.replace(/TREE_NODE:\s*.+/g, '').replace(/DIAGNOSIS CONCLUSION:\s*/g, '**Diagnosis: **')}</ReactMarkdown>
                    </div>
                  ) : m.content}
                </div>
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex items-start gap-2">
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Search className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-card px-4 py-3 flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Conclusion card */}
          {showConclusion && (
            <ConclusionCard
              conclusion={conclusionText}
              confidence={conclusionConfidence}
              onCreateProject={createProjectFromDiagnosis}
              onKeepDiagnosing={() => setShowConclusion(false)}
              isCreatingProject={isCreatingProject}
            />
          )}

          {/* Quick responses */}
          {!isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && !showConclusion && (
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0">
              {QUICK_RESPONSES.map(qr => (
                <button
                  key={qr.label}
                  onClick={() => sendMessage(qr.value)}
                  className="shrink-0 px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground hover:border-primary/40 transition-colors"
                >
                  {qr.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="bg-card border-t border-border p-3 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Describe what you found..."
                className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none min-h-[44px] max-h-[120px] focus:outline-none focus:border-primary transition-all"
                rows={1}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className={cn(
                  'shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-all',
                  input.trim() && !isStreaming
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
