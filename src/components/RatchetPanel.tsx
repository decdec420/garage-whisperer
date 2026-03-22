import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { X, Wrench, Plus, Clock, ChevronDown, Send, Mic, MicOff } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const quickPrompts = [
  { emoji: '🔍', text: 'Diagnose a symptom' },
  { emoji: '🔧', text: 'Walk me through a repair' },
  { emoji: '⏱', text: 'What maintenance is due?' },
  { emoji: '🏪', text: 'DIY or take it to a shop?' },
];

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
      <div className="rounded-2xl rounded-bl-sm bg-[#1a1a1a] px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

function ChatContent() {
  const { user } = useAuth();
  const { activeVehicle, ratchetPrefilledMessage, closeRatchetPanel, isRatchetOpen } = useAppStore();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const isMobile = useIsMobile();

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  // Handle prefilled message
  useEffect(() => {
    if (ratchetPrefilledMessage && isRatchetOpen) {
      setInput(ratchetPrefilledMessage);
      // Clear it from store so it doesn't re-apply
      useAppStore.setState({ ratchetPrefilledMessage: null });
    }
  }, [ratchetPrefilledMessage, isRatchetOpen]);

  // Load sessions
  const { data: sessions } = useQuery({
    queryKey: ['ratchet-sessions', activeVehicle?.id],
    queryFn: async () => {
      const q = supabase.from('chat_sessions').select('*').order('updated_at', { ascending: false });
      if (activeVehicle) q.eq('vehicle_id', activeVehicle.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user && isRatchetOpen,
  });

  // Auto-load last session
  useEffect(() => {
    if (sessions?.length && !activeSessionId && !messages.length) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions]);

  // Load messages for active session
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    supabase.from('chat_messages').select('*').eq('session_id', activeSessionId)
      .order('created_at').limit(50)
      .then(({ data }) => {
        if (data) setMessages(data.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content, created_at: m.created_at })));
      });
  }, [activeSessionId]);

  const createSession = async (): Promise<string> => {
    const { data, error } = await supabase.from('chat_sessions').insert({
      user_id: user!.id,
      vehicle_id: activeVehicle?.id || null,
    }).select('id').single();
    if (error) throw error;
    setActiveSessionId(data.id);
    queryClient.invalidateQueries({ queryKey: ['ratchet-sessions'] });
    return data.id;
  };

  const saveMessage = async (sessionId: string, role: string, content: string) => {
    await supabase.from('chat_messages').insert({ session_id: sessionId, role, content });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
        const title = text.trim().slice(0, 50);
        await supabase.from('chat_sessions').update({ title }).eq('id', sessionId);
        queryClient.invalidateQueries({ queryKey: ['ratchet-sessions'] });
      }

      await saveMessage(sessionId, 'user', text.trim());

      const vehicleContext = activeVehicle
        ? `Active vehicle: ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}${activeVehicle.trim ? ` ${activeVehicle.trim}` : ''}${activeVehicle.engine ? ` · ${activeVehicle.engine}` : ''}${activeVehicle.mileage ? ` · ${activeVehicle.mileage.toLocaleString()} mi` : ''}`
        : '';

      const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, vehicleContext }),
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

      if (assistantContent) await saveMessage(sessionId, 'assistant', assistantContent);
      await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
    } catch (e: any) {
      toast.error(e.message || 'Failed to get response');
    }
    setIsStreaming(false);
  };

  const startNewConversation = () => {
    setActiveSessionId(null);
    setMessages([]);
    setShowSessions(false);
  };

  // Voice input
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
    : null;

  const vehicleDetail = activeVehicle
    ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}${activeVehicle.engine ? ` · ${activeVehicle.engine}` : ''}${activeVehicle.mileage ? ` · ${activeVehicle.mileage.toLocaleString()} mi` : ''}`
    : null;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 bg-[#111111] border-b border-[#27272a] shrink-0">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <span className="text-base font-bold text-foreground">Ratchet</span>
        </div>
        {vehicleLabel && (
          <span className="text-xs bg-[#3f3f46] text-foreground px-2.5 py-1 rounded-full truncate max-w-[160px]">
            {vehicleLabel}
          </span>
        )}
        <div className="flex items-center gap-1">
          <button onClick={startNewConversation} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-[#1a1a1a] transition-colors" title="New chat">
            <Plus className="h-4 w-4" />
          </button>
          <button onClick={() => setShowSessions(!showSessions)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-[#1a1a1a] transition-colors" title="Chat history">
            <Clock className="h-4 w-4" />
          </button>
          <button onClick={closeRatchetPanel} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-[#1a1a1a] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Vehicle context bar */}
      {vehicleDetail && (
        <div className="flex items-center gap-2 px-4 h-10 bg-[#0f0f0f] border-b border-[#27272a] text-xs text-muted-foreground shrink-0">
          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          <span className="truncate">{vehicleDetail}</span>
        </div>
      )}

      {/* Session history drawer */}
      {showSessions && (
        <div className="border-b border-[#27272a] bg-[#111111] max-h-48 overflow-y-auto shrink-0">
          <div className="p-2 space-y-0.5">
            {sessions?.map(s => (
              <button
                key={s.id}
                onClick={() => { setActiveSessionId(s.id); setShowSessions(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-colors',
                  s.id === activeSessionId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-[#1a1a1a]'
                )}
              >
                {s.title || 'New conversation'}
              </button>
            ))}
            {!sessions?.length && <p className="text-xs text-muted-foreground px-3 py-2">No conversations yet</p>}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Wrench className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">What do you need help with?</h2>
            {activeVehicle && (
              <p className="text-xs text-muted-foreground mb-4">Working on your {vehicleLabel}</p>
            )}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {quickPrompts.map(p => (
                <button
                  key={p.text}
                  onClick={() => sendMessage(p.text)}
                  className="rounded-xl border border-[#3f3f46] bg-[#1a1a1a] p-3 text-xs text-foreground text-left hover:border-primary/40 transition-colors"
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
              <div className={cn(
                'px-4 py-3 text-sm',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm max-w-[80%]'
                  : 'bg-[#1a1a1a] text-foreground rounded-2xl rounded-bl-sm max-w-[85%]'
              )}>
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:text-foreground prose-headings:border-b prose-headings:border-[#27272a] prose-headings:pb-1 prose-code:bg-primary/20 prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs prose-strong:text-foreground">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : m.content}
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

      {/* Input */}
      <div className="bg-[#111111] border-t border-[#27272a] p-3 shrink-0">
        <div className="flex items-end gap-2">
          <button
            onClick={toggleVoice}
            className={cn(
              'shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-colors',
              isListening ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-[#27272a] text-muted-foreground hover:text-foreground'
            )}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              // Auto-expand
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask Ratchet anything..."
            className="flex-1 bg-[#1a1a1a] border border-[#27272a] rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none min-h-[40px] max-h-[120px] focus:outline-none focus:border-primary transition-colors"
            rows={1}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className={cn(
              'shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-all',
              input.trim() && !isStreaming
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-[#27272a] text-muted-foreground cursor-not-allowed'
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Mobile: bottom sheet approach with overlay
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
    if (dy > 0) setDragY(dy); // Only drag down
    if (dy < -50 && ratchetPanelMode === 'default') setRatchetPanelMode('fullscreen');
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > window.innerHeight * 0.3) {
      closeRatchetPanel();
    }
    setDragY(0);
  };

  useEffect(() => {
    if (!isRatchetOpen) {
      setRatchetPanelMode('default');
      setDragY(0);
    }
  }, [isRatchetOpen]);

  // Escape key
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
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 animate-fade-in"
        onClick={closeRatchetPanel}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl overflow-hidden animate-slide-up"
        style={{
          height: panelHeight,
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1), height 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        {!isFullscreen && (
          <div
            className="flex justify-center pt-3 pb-1 bg-[#111111] cursor-grab"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-[#3f3f46]" />
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
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 animate-fade-in"
        onClick={closeRatchetPanel}
      />
      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-[9999] w-[420px] animate-slide-in-right border-l border-[#27272a] shadow-2xl">
        <ChatContent />
      </div>
    </>
  );
}

export default function RatchetPanel() {
  const isMobile = useIsMobile();
  return isMobile ? <MobilePanel /> : <DesktopPanel />;
}
