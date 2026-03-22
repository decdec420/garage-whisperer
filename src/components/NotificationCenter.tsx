import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Clock, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'maintenance' | 'project' | 'complete';
  title: string;
  body: string;
  action?: { label: string; path?: string; ratchet?: string };
  time: Date;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { openRatchetPanel } = useAppStore();

  const { data: maintenanceDue } = useQuery({
    queryKey: ['notifications-maintenance'],
    queryFn: async () => {
      const { data } = await supabase.from('maintenance_logs')
        .select('id, service, next_due_date, next_due_mileage, vehicle_id')
        .not('next_due_date', 'is', null)
        .order('next_due_date', { ascending: true })
        .limit(5);
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  const { data: stalledProjects } = useQuery({
    queryKey: ['notifications-stalled'],
    queryFn: async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('projects')
        .select('id, title, vehicle_id, updated_at')
        .in('status', ['active', 'paused'])
        .lt('updated_at', threeDaysAgo)
        .limit(5);
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  const notifications: Notification[] = [];

  maintenanceDue?.forEach(m => {
    if (m.next_due_date) {
      const dueDate = new Date(m.next_due_date);
      const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 30) {
        notifications.push({
          id: `maint-${m.id}`,
          type: 'maintenance',
          title: `${m.service} coming up`,
          body: daysUntil <= 0 ? 'Overdue' : `Due in ${daysUntil} days`,
          action: { label: 'Log service', path: '/maintenance' },
          time: dueDate,
        });
      }
    }
  });

  stalledProjects?.forEach(p => {
    const days = Math.floor((Date.now() - new Date(p.updated_at!).getTime()) / (1000 * 60 * 60 * 24));
    notifications.push({
      id: `proj-${p.id}`,
      type: 'project',
      title: p.title,
      body: `Untouched for ${days} days`,
      action: { label: 'Resume', path: `/garage/${p.vehicle_id}/projects/${p.id}` },
      time: new Date(p.updated_at!),
    });
  });

  const visible = notifications.filter(n => !dismissed.has(n.id));
  const unreadCount = visible.length;

  const IconMap = { maintenance: Clock, project: Wrench, complete: CheckCircle2 };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">Notifications</span>
              {visible.length > 0 && (
                <button
                  onClick={() => setDismissed(new Set(notifications.map(n => n.id)))}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-72">
              {visible.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  All caught up 🔧
                </div>
              ) : (
                visible.map(n => {
                  const Icon = IconMap[n.type];
                  return (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0',
                        n.type === 'maintenance' ? 'text-warning' : 'text-primary')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.body}</p>
                        {n.action && (
                          <button
                            onClick={() => {
                              setOpen(false);
                              if (n.action!.path) navigate(n.action!.path);
                            }}
                            className="text-xs text-primary hover:underline mt-1"
                          >
                            {n.action.label} →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
