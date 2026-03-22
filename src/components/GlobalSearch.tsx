import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { Search, X, Car, Wrench, ClipboardList, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  type: 'vehicle' | 'project' | 'repair' | 'ratchet';
  title: string;
  subtitle?: string;
  path?: string;
  icon: typeof Car;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { openRatchetPanel } = useAppStore();

  // Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data } = await supabase.from('vehicles').select('id, year, make, model, nickname');
      return data || [];
    },
    enabled: open,
  });

  const { data: projects } = useQuery({
    queryKey: ['all-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, title, vehicle_id, status');
      return data || [];
    },
    enabled: open,
  });

  const { data: repairs } = useQuery({
    queryKey: ['repair-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('repair_logs').select('id, title, vehicle_id');
      return data || [];
    },
    enabled: open,
  });

  const results: SearchResult[] = [];
  const q = query.toLowerCase().trim();

  if (q) {
    vehicles?.filter(v => `${v.year} ${v.make} ${v.model} ${v.nickname || ''}`.toLowerCase().includes(q))
      .slice(0, 3).forEach(v => results.push({
        type: 'vehicle', title: `${v.year} ${v.make} ${v.model}`,
        subtitle: v.nickname || undefined, path: `/garage/${v.id}`, icon: Car,
      }));

    projects?.filter(p => p.title.toLowerCase().includes(q))
      .slice(0, 3).forEach(p => results.push({
        type: 'project', title: p.title,
        subtitle: p.status, path: `/garage/${p.vehicle_id}/projects/${p.id}`, icon: Wrench,
      }));

    repairs?.filter(r => r.title.toLowerCase().includes(q))
      .slice(0, 3).forEach(r => results.push({
        type: 'repair', title: r.title, path: '/repairs', icon: ClipboardList,
      }));

    results.push({
      type: 'ratchet', title: `Ask Ratchet: "${query}"`, icon: MessageCircle,
    });
  }

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery('');
    if (r.type === 'ratchet') {
      openRatchetPanel(query);
    } else if (r.path) {
      navigate(r.path);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search vehicles, projects, repairs..."
            className="flex-1 bg-transparent text-foreground text-base placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden md:inline text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">ESC</kbd>
          <button onClick={() => setOpen(false)} className="md:hidden text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {q && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  'hover:bg-primary/5 hover:border-l-2 hover:border-l-primary',
                  r.type === 'ratchet' && 'border-t border-border mt-1 pt-3'
                )}
              >
                <r.icon className={cn('h-4 w-4 shrink-0', r.type === 'ratchet' ? 'text-primary' : 'text-muted-foreground')} />
                <div className="min-w-0">
                  <p className={cn('text-sm truncate', r.type === 'ratchet' ? 'text-primary font-medium' : 'text-foreground')}>
                    {r.title}
                  </p>
                  {r.subtitle && <p className="text-xs text-muted-foreground">{r.subtitle}</p>}
                </div>
                <span className="ml-auto text-[10px] text-muted-foreground uppercase">{r.type}</span>
              </button>
            ))}
          </div>
        )}

        {!q && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <p>Start typing to search your garage</p>
            <p className="text-xs mt-2 hidden md:block">
              <kbd className="bg-secondary px-1.5 py-0.5 rounded text-[11px]">⌘K</kbd> to open anytime
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
