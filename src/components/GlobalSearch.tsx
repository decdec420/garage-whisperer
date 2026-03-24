import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { Search, X, Car, Wrench, ClipboardList, MessageCircle, Loader2 } from 'lucide-react';
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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { openRatchetPanel } = useAppStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Debounced server-side search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const pattern = `%${q}%`;
        const [vehiclesRes, projectsRes, repairsRes] = await Promise.all([
          supabase.from('vehicles').select('id, year, make, model, nickname').or(`make.ilike.${pattern},model.ilike.${pattern},nickname.ilike.${pattern}`).limit(5),
          supabase.from('projects').select('id, title, vehicle_id, status').ilike('title', pattern).limit(5),
          supabase.from('repair_logs').select('id, title, vehicle_id').ilike('title', pattern).limit(5),
        ]);

        const items: SearchResult[] = [];

        (vehiclesRes.data || []).forEach(v => items.push({
          type: 'vehicle', title: `${v.year} ${v.make} ${v.model}`,
          subtitle: v.nickname || undefined, path: `/garage/${v.id}`, icon: Car,
        }));

        (projectsRes.data || []).forEach(p => items.push({
          type: 'project', title: p.title,
          subtitle: p.status, path: `/garage/${p.vehicle_id}/projects/${p.id}`, icon: Wrench,
        }));

        (repairsRes.data || []).forEach(r => items.push({
          type: 'repair', title: r.title, path: '/repairs', icon: ClipboardList,
        }));

        // Always add "Ask Ratchet" option
        items.push({ type: 'ratchet', title: `Ask Ratchet: "${q}"`, icon: MessageCircle });

        setResults(items);
      } catch (e) {
        console.error('Search error:', e);
        setResults([{ type: 'ratchet', title: `Ask Ratchet: "${q}"`, icon: MessageCircle }]);
      }
      setLoading(false);
    }, 300);
  }, [query]);

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

  const q = query.trim();

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

        {q.length >= 2 && loading && (
          <div className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching...
          </div>
        )}

        {q.length >= 2 && !loading && results.length > 0 && (
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

        {q.length >= 2 && !loading && results.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No results found
          </div>
        )}

        {q.length < 2 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <p>{q.length === 0 ? 'Start typing to search your garage' : 'Type at least 2 characters...'}</p>
            <p className="text-xs mt-2 hidden md:block">
              <kbd className="bg-secondary px-1.5 py-0.5 rounded text-[11px]">⌘K</kbd> to open anytime
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
