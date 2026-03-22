import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Plus, Wrench, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const quickPrompts = [
  'Diagnose a symptom or noise',
  'Walk me through a repair',
  'What maintenance is due?',
  'Is this DIY or should I go to a shop?',
];

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

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  // Load sessions
  const { data: sessions } = useQuery({
    queryKey: ['chat-sessions', activeVehicle?.id],
    queryFn: async () => {
      const q = supabase.from('chat_sessions').select('*').order('updated_at', { ascending: false });
      if (activeVehicle) q.eq('vehicle_id', activeVehicle.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Load messages for active session
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    supabase.from('chat_messages').select('*').eq('session_id', activeSessionId).order('created_at').then(({ data }) => {
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
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
        // Auto-title
        const title = text.trim().slice(0, 50);
        await supabase.from('chat_sessions').update({ title }).eq('id', sessionId);
        queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      }

      await saveMessage(sessionId, 'user', text.trim());

      // Build context
      const vehicleContext = activeVehicle
        ? `Active vehicle: ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}${activeVehicle.trim ? ` ${activeVehicle.trim}` : ''}`
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

      if (resp.status === 429) { toast.error('Rate limited. Please wait a moment.'); setIsStreaming(false); return; }
      if (resp.status === 402) { toast.error('Credits exhausted. Please add funds.'); setIsStreaming(false); return; }
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
          } catch { /* partial JSON */ }
        }
      }

      if (assistantContent) await saveMessage(sessionId, 'assistant', assistantContent);
      await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
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
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
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
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Describe your issue or ask a question..."
              className="bg-popover resize-none min-h-[44px] max-h-[120px]"
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
