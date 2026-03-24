import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { streamChat, extractMemories } from '@/lib/ratchet-chat';
import { Button } from '@/components/ui/button';
import { Send, Plus, Wrench, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';

const quickPrompts = [
  'Diagnose a symptom or noise',
  'Walk me through a repair',
  'What maintenance is due?',
  'Is this DIY or should I go to a shop?',
];

// Reuse the same markdown components from RatchetPanel
const markdownComponents: Components = {
  h2: ({ children }) => (
    <div className="text-xs font-bold uppercase tracking-wider text-primary mt-4 mb-2 pb-1 border-b border-primary/20 first:mt-0">
      {children}
    </div>
  ),
  h3: ({ children }) => (
    <div className="text-sm font-bold text-foreground mt-3 mb-1.5">{children}</div>
  ),
  p: ({ children }) => {
    const text = typeof children === 'string' ? children :
      Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '';
    if (text.startsWith('🔩')) {
      return (
        <div className="my-1.5 px-3 py-2 rounded-lg border font-mono text-sm"
          style={{ background: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.3)', color: '#f97316' }}>
          {children}
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
    if (className?.includes('language-')) {
      return <code className={cn("block my-2 p-3 rounded-lg text-xs font-mono bg-muted/50 overflow-x-auto", className)}>{children}</code>;
    }
    return (
      <code className="px-1.5 py-0.5 rounded font-mono text-xs"
        style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', color: '#f97316' }}>
        {children}
      </code>
    );
  },
  ul: ({ children }) => <ul className="my-1.5 pl-4 space-y-0.5 list-none">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 space-y-1">{children}</ol>,
  li: ({ children }) => (
    <li className="text-sm flex gap-1.5 items-start">
      <span className="text-primary mt-1.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
};

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat() {
  const { user } = useAuth();
  const { activeVehicle } = useAppStore();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastUserMsgRef = useRef('');

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  const { data: sessions } = useQuery({
    queryKey: ['chat-sessions', activeVehicle?.id],
    queryFn: async () => {
      const q = supabase.from('chat_sessions').select('id, title, vehicle_id, project_id, updated_at').order('updated_at', { ascending: false });
      if (activeVehicle) q.eq('vehicle_id', activeVehicle.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    supabase.from('chat_messages').select('id, role, content').eq('session_id', activeSessionId).order('created_at').then(({ data }) => {
      if (data) setMessages(data.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })));
    });
  }, [activeSessionId]);

  const createSession = async (): Promise<string> => {
    const { data, error } = await supabase.from('chat_sessions').insert({
      user_id: user!.id,
      vehicle_id: activeVehicle?.id || null,
    }).select('id').single();
    if (error) throw error;
    setActiveSessionId(data.id);
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    return data.id;
  };

  const saveMessage = async (sessionId: string, role: string, content: string) => {
    await supabase.from('chat_messages').insert({ session_id: sessionId, role, content });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    lastUserMsgRef.current = text.trim();
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
        const title = text.trim().slice(0, 50);
        await supabase.from('chat_sessions').update({ title }).eq('id', sessionId);
        queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      }

      await saveMessage(sessionId, 'user', text.trim());

      const vehicleContext = activeVehicle
        ? `Active vehicle: ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}${activeVehicle.trim ? ` ${activeVehicle.trim}` : ''}`
        : '';

      const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

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
            extractMemories(lastUserMsgRef.current, assistantContent, activeVehicle?.id || null, sessionId!);
          }
          await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId!);
        },
        onError: () => {},
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to get response');
    }
    setIsStreaming(false);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen">
      {/* Session sidebar - desktop only */}
      <div className="hidden md:flex flex-col w-64 border-r border-border bg-popover">
        <div className="p-3 border-b border-border">
          <Button size="sm" className="w-full" onClick={() => { setActiveSessionId(null); setMessages([]); }}>
            <Plus className="h-4 w-4 mr-1" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions?.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors',
                s.id === activeSessionId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              {s.title || 'New conversation'}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">What can I help you with?</h2>
              {activeVehicle && (
                <p className="text-sm text-muted-foreground mb-6">
                  Chatting about your {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {quickPrompts.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="rounded-xl border border-border p-3 text-sm text-left hover:border-primary/30 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-xl px-4 py-3 text-sm',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'
                )}>
                  {m.role === 'assistant' ? (
                    <div className="flex gap-3">
                      <Wrench className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="max-w-none">
                        <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  ) : m.content}
                </div>
              </div>
            ))
          )}
          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2 items-end max-w-3xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Describe your issue or ask a question..."
              className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none min-h-[44px] max-h-[160px] focus:outline-none focus:border-primary transition-all"
              rows={1}
            />
            <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim() || isStreaming} className="shrink-0 h-11 w-11">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
