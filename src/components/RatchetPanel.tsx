import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { streamChat, extractMemories } from '@/lib/ratchet-chat';
import { X, Wrench, Plus, Clock, Send, Mic, MicOff, Car, ChevronDown, FolderOpen, Paperclip, Camera, Image as ImageIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';

interface MessageImage {
  url: string; // public URL after upload
  dataUrl?: string; // local preview before upload
}

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  images?: string[]; // public URLs
}

interface QueuedFile {
  file: File;
  previewUrl: string;
}

// Chat and memory extraction are handled by @/lib/ratchet-chat

const quickPrompts = [
  { emoji: '🔍', text: 'Diagnose a symptom' },
  { emoji: '🔧', text: 'Walk me through a repair' },
  { emoji: '⏱', text: 'What maintenance is due?' },
  { emoji: '🏪', text: 'DIY or take it to a shop?' },
];

const projectQuickPrompts = [
  { emoji: '❓', text: 'What should I watch out for on this step?' },
  { emoji: '🔩', text: 'Double-check the torque specs for me' },
  { emoji: '🛠', text: 'I\'m stuck — walk me through this' },
  { emoji: '⚠️', text: 'Any safety concerns I should know about?' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

function RatchetAvatar() {
  return (
    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
      <Wrench className="h-3.5 w-3.5 text-primary-foreground" />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <RatchetAvatar />
      <div className="rounded-2xl rounded-bl-sm bg-card px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

function RatchetMarkdown({ content }: { content: string }) {
  const components: Components = {
    h2: ({ children }) => (
      <div className="text-xs font-bold uppercase tracking-wider text-primary mt-4 mb-2 pb-1 border-b border-primary/20 first:mt-0">
        {children}
      </div>
    ),
    h3: ({ children }) => (
      <div className="text-sm font-bold text-foreground mt-3 mb-1.5">
        {children}
      </div>
    ),
    p: ({ children }) => {
      const text = typeof children === 'string' ? children :
        Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '';

      if (text.startsWith('🔩')) {
        // Check if it contains an FSM reference
        const hasFsm = text.includes('FSM') || text.includes('factory') || text.includes('📖');
        return (
          <div className="my-1.5 px-3 py-2 rounded-lg border font-mono text-sm flex items-center gap-2"
            style={{ background: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.3)', color: '#f97316' }}>
            <span className="flex-1">{children}</span>
            {hasFsm && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-sans font-semibold"
                style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)' }}>
                📖 FSM
              </span>
            )}
          </div>
        );
      }
      if (text.startsWith('⚠️')) {
        return (
          <div className="my-1.5 px-3 py-2 rounded-r-lg"
            style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid #ef4444' }}>
            <span className="text-sm">{children}</span>
          </div>
        );
      }
      if (text.startsWith('⚡')) {
        return (
          <div className="my-1.5 px-3 py-2 rounded-r-lg"
            style={{ background: 'rgba(234,179,8,0.08)', borderLeft: '3px solid #eab308' }}>
            <span className="text-sm">{children}</span>
          </div>
        );
      }
      return <p className="my-1 text-sm leading-relaxed">{children}</p>;
    },
    code: ({ children, className }) => {
      const isBlock = className?.includes('language-');
      if (isBlock) {
        return (
          <code className={cn("block my-2 p-3 rounded-lg text-xs font-mono bg-muted/50 overflow-x-auto", className)}>
            {children}
          </code>
        );
      }
      return (
        <code className="px-1.5 py-0.5 rounded font-mono text-xs"
          style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', color: '#f97316' }}>
          {children}
        </code>
      );
    },
    ol: ({ children }) => (
      <ol className="my-1.5 pl-0 space-y-1 list-none" style={{ counterReset: 'item' }}>
        {children}
      </ol>
    ),
    ul: ({ children }) => (
      <ul className="my-1.5 pl-4 space-y-0.5 list-none">
        {children}
      </ul>
    ),
    li: ({ children, ...props }) => {
      const isOrdered = (props as any).ordered;
      if (isOrdered) {
        return (
          <li className="flex gap-2 text-sm" style={{ counterIncrement: 'item' }}>
            <span className="text-primary font-bold shrink-0 min-w-[1.2em]"></span>
            <span>{children}</span>
          </li>
        );
      }
      return (
        <li className="text-sm flex gap-1.5 items-start">
          <span className="text-primary mt-1.5 shrink-0">•</span>
          <span>{children}</span>
        </li>
      );
    },
    strong: ({ children }) => (
      <strong className="text-foreground font-semibold">{children}</strong>
    ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
        {children}
      </a>
    ),
  };

  return (
    <div className="max-w-none">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}

// extractMemories is now imported from @/lib/ratchet-chat

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadToStorage(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/chat/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('repair-photos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  // Return just the path — images sent to chat are base64 encoded, not URLs
  return path;
}

function ChatContent() {
  const { user } = useAuth();
  const {
    activeVehicle, ratchetPrefilledMessage, closeRatchetPanel, isRatchetOpen,
    setActiveVehicle, ratchetProjectContext, ratchetActiveSessionId,
    ratchetDiagnosisContext,
  } = useAppStore();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastUserMsgRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isProjectMode = !!ratchetProjectContext;
  const activePrompts = isProjectMode ? projectQuickPrompts : quickPrompts;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  const { data: allVehicles } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, year, make, model, trim, nickname, engine, mileage').order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (ratchetPrefilledMessage && isRatchetOpen) {
      setInput(ratchetPrefilledMessage);
      useAppStore.setState({ ratchetPrefilledMessage: null });
    }
  }, [ratchetPrefilledMessage, isRatchetOpen]);

  const { data: sessions } = useQuery({
    queryKey: ['ratchet-sessions', activeVehicle?.id, ratchetProjectContext?.id],
    queryFn: async () => {
      if (isProjectMode) {
        const { data, error } = await supabase.from('chat_sessions').select('id, title, vehicle_id, project_id, updated_at')
          .eq('project_id', ratchetProjectContext!.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        return data;
      } else {
        const q = supabase.from('chat_sessions').select('id, title, vehicle_id, project_id, updated_at')
          .is('project_id', null)
          .order('updated_at', { ascending: false })
          .limit(20);
        if (activeVehicle) q.eq('vehicle_id', activeVehicle.id);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      }
    },
    enabled: !!user && isRatchetOpen,
  });

  const { data: generalSessions } = useQuery({
    queryKey: ['ratchet-general-sessions', activeVehicle?.id],
    queryFn: async () => {
      const q = supabase.from('chat_sessions').select('id, title, vehicle_id, project_id, updated_at')
        .is('project_id', null)
        .order('updated_at', { ascending: false })
        .limit(10);
      if (activeVehicle) q.eq('vehicle_id', activeVehicle.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user && isRatchetOpen && isProjectMode,
  });

  useEffect(() => {
    setActiveSessionId(null);
    setMessages([]);
  }, [activeVehicle?.id, ratchetProjectContext?.id]);

  // Handle openRatchetWithSession — load a specific session from store
  useEffect(() => {
    if (ratchetActiveSessionId && isRatchetOpen) {
      setActiveSessionId(ratchetActiveSessionId);
      // Clear it from store so it doesn't re-trigger
      useAppStore.setState({ ratchetActiveSessionId: null });
    }
  }, [ratchetActiveSessionId, isRatchetOpen]);

  useEffect(() => {
    if (sessions?.length && !activeSessionId && !messages.length) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions]);

  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    supabase.from('chat_messages').select('id, role, content, image_urls, created_at').eq('session_id', activeSessionId)
      .order('created_at').limit(50)
      .then(({ data }) => {
        if (data) setMessages(data.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          created_at: m.created_at,
          images: (m as any).image_urls?.length ? (m as any).image_urls : undefined,
        })));
      });
  }, [activeSessionId]);

  const createSession = async (): Promise<string> => {
    const insertData: any = {
      user_id: user!.id,
      vehicle_id: activeVehicle?.id || null,
    };
    if (isProjectMode) {
      insertData.project_id = ratchetProjectContext!.id;
    }
    const { data, error } = await supabase.from('chat_sessions').insert(insertData).select('id').single();
    if (error) throw error;
    setActiveSessionId(data.id);
    queryClient.invalidateQueries({ queryKey: ['ratchet-sessions'] });
    return data.id;
  };

  const saveMessage = async (sessionId: string, role: string, content: string, imageUrls?: string[]) => {
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role,
      content,
      image_urls: imageUrls || [],
    } as any);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles: QueuedFile[] = [];
    for (let i = 0; i < Math.min(files.length, 3 - queuedFiles.length); i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name} — unsupported file type`);
        continue;
      }
      newFiles.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setQueuedFiles(prev => [...prev, ...newFiles].slice(0, 3));
    setShowAttachMenu(false);
  };

  const removeQueuedFile = (index: number) => {
    setQueuedFiles(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && queuedFiles.length === 0) || isStreaming) return;

    const hasImages = queuedFiles.length > 0;
    const filesToUpload = [...queuedFiles];
    setQueuedFiles([]);

    const userMsg: Message = { role: 'user', content: text.trim() };
    // Show local previews immediately
    if (hasImages) {
      userMsg.images = filesToUpload.map(f => f.previewUrl);
    }
    lastUserMsgRef.current = text.trim();
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
        const title = isProjectMode
          ? ratchetProjectContext!.title
          : text.trim().slice(0, 50) || 'Photo message';
        await supabase.from('chat_sessions').update({ title }).eq('id', sessionId);
        queryClient.invalidateQueries({ queryKey: ['ratchet-sessions'] });
      }

      // Upload images to storage and get base64 for AI
      let uploadedUrls: string[] = [];
      let base64Images: string[] = [];
      if (hasImages && isProjectMode) {
        setIsUploading(true);
        for (const qf of filesToUpload) {
          try {
            const [url, dataUrl] = await Promise.all([
              uploadToStorage(qf.file, ratchetProjectContext!.id),
              fileToBase64(qf.file),
            ]);
            uploadedUrls.push(url);
            base64Images.push(dataUrl);
          } catch (e) {
            console.error('Upload error:', e);
            toast.error('Failed to upload image');
          }
        }
        setIsUploading(false);

        // Update message with real URLs
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 && m.role === 'user' ? { ...m, images: uploadedUrls } : m
        ));
      }

      await saveMessage(sessionId, 'user', text.trim(), uploadedUrls);

      let vehicleContext = activeVehicle
        ? `Active vehicle: ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}${activeVehicle.trim ? ` ${activeVehicle.trim}` : ''}${activeVehicle.engine ? ` · ${activeVehicle.engine}` : ''}${activeVehicle.mileage ? ` · ${activeVehicle.mileage.toLocaleString()} mi` : ''}`
        : '';

      if (isProjectMode) {
        vehicleContext += `\n\nProject context: "${ratchetProjectContext!.title}" — The user is currently working on this specific project. Provide advice specific to this repair job.`;
      }

      // Inject diagnosis context if active
      if (ratchetDiagnosisContext) {
        const dc = ratchetDiagnosisContext;
        const causesStr = dc.treeNodes?.map(n => `${n.cause} (${n.status}${n.probability ? `, ${Math.round(n.probability)}%` : ''})`).join(', ') || 'Unknown';
        vehicleContext += `\n\n## Active Diagnosis Session
The user is currently diagnosing their vehicle, not asking a general question.
Symptom: ${dc.symptom}
${dc.currentStepTitle ? `Current step: Step ${dc.currentStepNumber} — ${dc.currentStepTitle}` : ''}
${dc.totalSteps ? `Steps completed: ${dc.currentStepNumber ? dc.currentStepNumber - 1 : 0} of ${dc.totalSteps}` : ''}
Possible causes: ${causesStr}
${dc.confidenceScore ? `Current confidence: ${dc.confidenceScore}% → ${dc.leadingCause || 'Testing...'}` : ''}

How to help:
- Interpret test results against the expected/failure criteria for the current step
- Answer "is this good or bad" questions with specific reference to the thresholds
- Answer hardware questions with component-specific counts (not generic)
- When answering hardware questions, ALWAYS separate component mounting hardware from access path hardware. Never give a combined bolt count.
- Suggest whether to continue testing or whether current evidence is sufficient
- If they found something: help them understand what it means for the diagnosis
- Never suggest they restart from scratch if they're mid-diagnosis`;
      }

      // Build messages for API — include base64 images for the current message
      const allMessages = [...messages, userMsg].map((m, idx) => {
        const isLast = idx === messages.length; // the userMsg we just added
        if (isLast && base64Images.length > 0) {
          return { role: m.role, content: m.content || '', images: base64Images };
        }
        return { role: m.role, content: m.content };
      });

      await streamChat({
        messages: allMessages,
        vehicleContext,
        vehicleId: activeVehicle?.id || null,
        onToken: (content) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
            }
            return [...prev, { role: 'assistant', content }];
          });
        },
        onDone: async (assistantContent) => {
          if (assistantContent) {
            await saveMessage(sessionId!, 'assistant', assistantContent);
            if (user?.id) {
              extractMemories(lastUserMsgRef.current, assistantContent, activeVehicle?.id || null, sessionId!);
            }
          }
          await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId!);
        },
        onError: () => {},
      });
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Try again in a moment.",
      }]);
    }

    // Cleanup blob URLs
    filesToUpload.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setIsStreaming(false);
  };

  const startNewConversation = () => {
    setActiveSessionId(null);
    setMessages([]);
    setShowSessions(false);
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Speech recognition not supported'); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const vehicleLabel = activeVehicle
    ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`
    : 'No vehicle selected';

  const headerTitle = isProjectMode
    ? `Ratchet · ${ratchetProjectContext!.title}`
    : 'Ratchet';

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Wrench className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">{headerTitle}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isProjectMode && (
            <button onClick={startNewConversation} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors" title="New chat">
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setShowSessions(!showSessions)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors" title="Chat history">
            <Clock className="h-4 w-4" />
          </button>
          <button onClick={closeRatchetPanel} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Vehicle context bar */}
      <div className="relative shrink-0">
        <button
          onClick={() => !isProjectMode && setShowVehiclePicker(!showVehiclePicker)}
          className={cn(
            "flex items-center gap-2 w-full px-4 h-10 bg-muted/30 border-b border-border text-xs text-muted-foreground transition-colors",
            !isProjectMode && "hover:bg-muted/50 cursor-pointer"
          )}
        >
          <Car className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate flex-1 text-left">{vehicleLabel}</span>
          {isProjectMode && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">Project</span>
          )}
          {!isProjectMode && <ChevronDown className={cn("h-3 w-3 transition-transform", showVehiclePicker && "rotate-180")} />}
        </button>
        {showVehiclePicker && !isProjectMode && allVehicles && (
          <div className="absolute top-full left-0 right-0 z-50 border-b border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
            {allVehicles.map(v => (
              <button
                key={v.id}
                onClick={() => {
                  setActiveVehicle(v);
                  setShowVehiclePicker(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center gap-2',
                  v.id === activeVehicle?.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                )}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", v.id === activeVehicle?.id ? "bg-primary" : "bg-muted-foreground/30")} />
                {v.nickname || `${v.year} ${v.make} ${v.model}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Session history drawer */}
      {showSessions && (
        <div className="border-b border-border bg-card max-h-56 overflow-y-auto shrink-0">
          {isProjectMode && (
            <>
              <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                This Project
              </div>
              <div className="px-2 pb-1 space-y-0.5">
                {sessions?.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setActiveSessionId(s.id); setShowSessions(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-colors',
                      s.id === activeSessionId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <FolderOpen className="h-3 w-3 inline mr-1.5" />
                    {s.title || ratchetProjectContext?.title || 'Project conversation'}
                  </button>
                ))}
                {!sessions?.length && (
                  <p className="text-xs text-muted-foreground px-3 py-2">No conversation yet — ask Ratchet anything about this project</p>
                )}
              </div>
              <div className="px-3 py-1.5 border-t border-border">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  General — {vehicleLabel}
                </div>
                {generalSessions?.slice(0, 5).map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setActiveSessionId(s.id); setShowSessions(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 rounded-lg text-xs truncate transition-colors',
                      s.id === activeSessionId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {s.title || 'Conversation'}
                  </button>
                ))}
              </div>
            </>
          )}

          {!isProjectMode && (
            <>
              <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Conversations about {vehicleLabel}
              </div>
              <div className="px-2 pb-2 space-y-0.5">
                {sessions?.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setActiveSessionId(s.id); setShowSessions(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-colors',
                      s.id === activeSessionId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {s.title || 'New conversation'}
                  </button>
                ))}
                {!sessions?.length && <p className="text-xs text-muted-foreground px-3 py-2">No conversations yet</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Wrench className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">
              {isProjectMode ? `Help with ${ratchetProjectContext!.title}` : 'What do you need help with?'}
            </h2>
            {activeVehicle && (
              <p className="text-xs text-muted-foreground mb-4">Working on your {vehicleLabel}</p>
            )}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {activePrompts.map(p => (
                <button
                  key={p.text}
                  onClick={() => sendMessage(p.text)}
                  className="rounded-xl border border-border bg-card p-3 text-xs text-foreground text-left hover:border-primary/40 transition-colors"
                >
                  {p.emoji} {p.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                'flex animate-fade-in',
                m.role === 'user' ? 'justify-end' : 'justify-start gap-2'
              )}
            >
              {m.role === 'assistant' && <RatchetAvatar />}
              <div className="flex flex-col gap-1">
                <div className={cn(
                  'px-4 py-3 text-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm max-w-[80%]'
                    : 'bg-card border border-border text-foreground rounded-2xl rounded-bl-sm max-w-[85%]'
                )}>
                  {m.role === 'assistant' ? (
                    <RatchetMarkdown content={m.content} />
                  ) : m.content || null}
                  {/* Inline images */}
                  {m.images && m.images.length > 0 && (
                    <div className={cn("flex flex-wrap gap-2", m.content && "mt-2")}>
                      {m.images.map((url, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={url}
                          alt="Uploaded photo"
                          className="rounded-xl object-cover max-h-[280px] max-w-full"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {m.role === 'assistant' && activeVehicle && m.content.length > 50 && (
                  <span className="text-[11px] text-green-500/80 flex items-center gap-1 ml-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                    Specific to your {activeVehicle.engine || `${activeVehicle.year} ${activeVehicle.make}`}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice listening indicator */}
      {isListening && (
        <div className="px-4 py-1.5 text-xs text-primary text-center animate-pulse bg-primary/5">
          🎙 Listening...
        </div>
      )}

      {/* Queued file previews */}
      {queuedFiles.length > 0 && (
        <div className="px-3 pb-1 pt-2 flex gap-2 bg-card border-t border-border shrink-0">
          {queuedFiles.map((qf, i) => (
            <div key={i} className="relative group">
              <img
                src={qf.previewUrl}
                alt="Queued"
                className="h-[60px] w-[60px] rounded-lg object-cover border border-border"
              />
              {isUploading && (
                <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <button
                onClick={() => removeQueuedFile(i)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Attach menu popover */}
      {showAttachMenu && isProjectMode && (
        <div className="absolute bottom-20 left-3 z-50 bg-popover border border-border rounded-xl shadow-lg p-1 min-w-[200px]">
          <button
            onClick={() => { cameraInputRef.current?.click(); }}
            className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-muted flex items-center gap-2 text-foreground"
          >
            <Camera className="h-4 w-4 text-primary" />
            Take a photo
          </button>
          <button
            onClick={() => { fileInputRef.current?.click(); }}
            className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-muted flex items-center gap-2 text-foreground"
          >
            <ImageIcon className="h-4 w-4 text-primary" />
            Choose from library
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        multiple
        className="hidden"
        onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; setShowAttachMenu(false); }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; setShowAttachMenu(false); }}
      />

      {/* Input */}
      <div className="bg-card border-t border-border p-3 shrink-0">
        <div className="flex items-end gap-2">
          {/* Attachment button — only active in project mode */}
          {isProjectMode ? (
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className={cn(
                'shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-colors',
                showAttachMenu ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
              title="Attach photo"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={toggleVoice}
              className={cn(
                'shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-colors',
                isListening ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder={isProjectMode ? `Ask about ${ratchetProjectContext!.title}...` : 'Ask Ratchet anything...'}
            className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none min-h-[44px] max-h-[160px] focus:outline-none focus:border-primary transition-all"
            style={{ WebkitOverflowScrolling: 'touch' }}
            rows={1}
          />
          {/* Mic button in project mode */}
          {isProjectMode && (
            <button
              onClick={toggleVoice}
              className={cn(
                'shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-colors',
                isListening ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={() => sendMessage(input)}
            disabled={(!input.trim() && queuedFiles.length === 0) || isStreaming}
            className={cn(
              'shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-all',
              (input.trim() || queuedFiles.length > 0) && !isStreaming
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Click-away for attach menu */}
      {showAttachMenu && <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />}
    </div>
  );
}

// Mobile: bottom sheet
function MobilePanel() {
  const { isRatchetOpen, closeRatchetPanel, ratchetPanelMode, setRatchetPanelMode } = useAppStore();
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragY(dy);
    if (dy < -50 && ratchetPanelMode === 'default') setRatchetPanelMode('fullscreen');
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > window.innerHeight * 0.3) closeRatchetPanel();
    setDragY(0);
  };

  useEffect(() => {
    if (!isRatchetOpen) { setRatchetPanelMode('default'); setDragY(0); }
  }, [isRatchetOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRatchetPanel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeRatchetPanel]);

  if (!isRatchetOpen) return null;

  const isFullscreen = ratchetPanelMode === 'fullscreen';
  const panelHeight = isFullscreen ? '100dvh' : '75dvh';

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/60 animate-fade-in" onClick={closeRatchetPanel} />
      <div
        ref={panelRef}
        className="fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl overflow-hidden animate-slide-up"
        style={{
          height: panelHeight,
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1), height 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {!isFullscreen && (
          <div
            className="flex justify-center pt-3 pb-1 bg-card cursor-grab"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <ChatContent />
      </div>
    </>
  );
}

// Desktop: right-side drawer
function DesktopPanel() {
  const { isRatchetOpen, closeRatchetPanel } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRatchetPanel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeRatchetPanel]);

  if (!isRatchetOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/60 animate-fade-in" onClick={closeRatchetPanel} />
      <div className="fixed top-0 right-0 bottom-0 z-[9999] w-[420px] animate-slide-in-right border-l border-border shadow-2xl">
        <ChatContent />
      </div>
    </>
  );
}

export default function RatchetPanel() {
  const isMobile = useIsMobile();
  return isMobile ? <MobilePanel /> : <DesktopPanel />;
}
