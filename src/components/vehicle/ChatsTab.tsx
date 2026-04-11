import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ChatsTabProps {
  vehicleId: string;
}

interface SessionWithCount {
  id: string;
  title: string | null;
  project_id: string | null;
  updated_at: string;
  created_at: string;
  message_count: number;
  project_title?: string | null;
}

export default function ChatsTab({ vehicleId }: ChatsTabProps) {
  const { openRatchetWithSession } = useAppStore();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['vehicle-chat-sessions', vehicleId],
    queryFn: async () => {
      // Get only general chat sessions (no project_id) for this vehicle
      const { data: chatSessions, error } = await supabase
        .from('chat_sessions')
        .select('id, title, project_id, updated_at, created_at, vehicle_id')
        .eq('vehicle_id', vehicleId)
        .is('project_id', null)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!chatSessions?.length) return [];

      // Get message counts in a single query instead of N individual queries
      const sessionIds = chatSessions.map(s => s.id);
      const { data: messageRows } = await supabase
        .from('chat_messages')
        .select('session_id')
        .in('session_id', sessionIds);
      const counts: Record<string, number> = {};
      messageRows?.forEach(m => {
        counts[m.session_id] = (counts[m.session_id] || 0) + 1;
      });

      return chatSessions.map(s => ({
        ...s,
        message_count: counts[s.id] || 0,
      })) as SessionWithCount[];
    },
    enabled: !!vehicleId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!sessions?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <MessageCircle className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No conversations yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Tap the Ratchet button to start chatting about this vehicle
        </p>
      </div>
    );
  }

  const SessionRow = ({ session }: { session: SessionWithCount }) => (
    <Card
      className="cursor-pointer hover:border-primary/40 transition-colors"
      onClick={() => openRatchetWithSession(session.id)}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <MessageCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {session.title || 'Untitled conversation'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
            </span>
            <span className="text-xs text-muted-foreground">
              · {session.message_count} messages
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3 mt-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <MessageCircle className="h-3.5 w-3.5" />
        General Conversations
      </h3>
      <div className="space-y-2">
        {sessions.map(s => (
          <SessionRow key={s.id} session={s} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center pt-2">
        Project-specific chats live inside each project
      </p>
    </div>
  );
}
