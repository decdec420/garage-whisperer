import { getAccessToken } from '@/lib/auth-helpers';
import { toast } from 'sonner';

export const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-memories`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface StreamOptions {
  messages: ChatMessage[];
  vehicleContext: string;
  vehicleId: string | null;
  signal?: AbortSignal;
  onToken: (fullContent: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: Error) => void;
}

/**
 * Streams a chat completion from the Ratchet Edge Function.
 * Pass an AbortSignal to cancel mid-stream.
 */
export async function streamChat(opts: StreamOptions): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    toast.error('Please log in to chat');
    opts.onError(new Error('Not authenticated'));
    return;
  }

  let resp: Response;
  try {
    resp = await fetch(CHAT_URL, {
      method: 'POST',
      signal: opts.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: opts.messages.map(m => {
          if (m.images?.length) return { role: m.role, content: m.content || '', images: m.images };
          return { role: m.role, content: m.content };
        }),
        vehicleContext: opts.vehicleContext,
        vehicleId: opts.vehicleId,
      }),
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') return;
    throw e;
  }

  if (resp.status === 429) { toast.error('Rate limited. Please wait a moment.'); opts.onError(new Error('Rate limited')); return; }
  if (resp.status === 402) { toast.error('Credits exhausted. Please add funds.'); opts.onError(new Error('Credits exhausted')); return; }
  if (!resp.ok || !resp.body) { opts.onError(new Error('Stream failed')); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let assistantContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (opts.signal?.aborted) break;
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
            opts.onToken(assistantContent);
          }
        } catch { /* partial JSON chunk */ }
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return; // intentional cancel
    throw e;
  } finally {
    reader.releaseLock();
  }

  if (!opts.signal?.aborted) {
    opts.onDone(assistantContent);
  }
}

/**
 * Fire-and-forget memory extraction after a chat exchange.
 */
export async function extractMemories(
  userMessage: string,
  assistantMessage: string,
  vehicleId: string | null,
  sessionId: string,
): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) return;
    await fetch(EXTRACT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userMessage, assistantMessage, vehicleId, sessionId }),
    });
  } catch { /* non-critical */ }
}
