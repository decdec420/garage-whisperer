import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Search, ChevronRight, CheckCircle2, AlertCircle, Clock, Wrench,
  Camera, Video, FileText, Link as LinkIcon, X, Plus, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Chip data ───
const WHEN_CHIPS = [
  'Cold start', 'After warming up', 'All the time', 'Under acceleration',
  'Braking', 'Turning', 'Highway speed', 'Idling', 'Random/intermittent',
];
const WHERE_CHIPS = [
  'Front left', 'Front right', 'Rear left', 'Rear right',
  'Under the hood', 'Underneath the car', 'Dashboard/cabin', 'Not sure',
];
const SOUND_CHIPS: { label: string; desc: string }[] = [
  { label: 'Knock', desc: 'deep thud, rhythmic with RPM' },
  { label: 'Tick', desc: 'rapid light tap, speeds with RPM' },
  { label: 'Rattle', desc: 'loose, irregular, metal-on-metal' },
  { label: 'Grind', desc: 'rough, grating during movement' },
  { label: 'Squeal', desc: 'high-pitched, braking or belt' },
  { label: 'Whine', desc: 'steady tone, changes with speed' },
  { label: 'Clunk', desc: 'single heavy thud, over bumps' },
  { label: 'Hiss', desc: 'air or fluid escaping' },
  { label: 'Click', desc: 'single or repeating (no-crank = starter click)' },
  { label: 'Rumble', desc: 'low vibration, felt and heard' },
  { label: 'Pop/Backfire', desc: 'sharp exhaust or engine' },
  { label: 'Screech', desc: 'extreme high-pitch, metal contact' },
];
const SOUND_KEYWORDS = ['knock','tick','rattle','grind','squeal','whine','clunk','hiss','click','rumble','pop','screech','noise','sound'];

const SYMPTOM_CATEGORIES: { label: string; chips: string[] }[] = [
  { label: 'Starting / Electrical', chips: ["Won't start — clicks", "Won't start — no sound", "Hard to start when cold", "Battery dies overnight", "Check engine light"] },
  { label: 'Engine Running', chips: ["Rough idle", "Misfires / shaking", "Stalls randomly", "Backfires", "Poor power under load", "Poor fuel economy"] },
  { label: 'Noises', chips: ["Knocking / ticking", "Rattling", "Grinding", "Squealing", "Clunking over bumps", "Whining noise"] },
  { label: 'Brakes / Steering / Suspension', chips: ["Pulls when braking", "Vibration at speed", "Steering pulls left/right", "Clunk when turning", "Brake pedal soft"] },
  { label: 'Fluids / Leaks', chips: ["Oil leak", "Coolant leak", "Transmission slipping", "Overheating", "AC not cold"] },
];

interface Attachment {
  type: 'photo' | 'video' | 'doc' | 'link';
  file?: File;
  url?: string;
  thumbnailUrl?: string;
  name: string;
  duration?: number;
}

interface DiagnoseTabProps {
  vehicleId: string;
  vehicle: any;
}

export default function DiagnoseTab({ vehicleId, vehicle }: DiagnoseTabProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [symptom, setSymptom] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [whenChip, setWhenChip] = useState<string | null>(null);
  const [whereChip, setWhereChip] = useState<string | null>(null);
  const [soundChip, setSoundChip] = useState<string | null>(null);
  const [showSoundRow, setShowSoundRow] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [linkInput, setLinkInput] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  // Build full symptom from chips + text
  const buildFullSymptom = useCallback(() => {
    let s = symptom.trim();
    if (whenChip) s = `[When ${whenChip.toLowerCase()}] ${s}`;
    if (whereChip) s = `${s} [from ${whereChip.toLowerCase()}]`;
    if (soundChip) s = `${s} — sounds like ${soundChip.toLowerCase()}`;
    return s;
  }, [symptom, selectedChips, whenChip, whereChip, soundChip]);

  // Should sound row show?
  const soundVisible = showSoundRow || SOUND_KEYWORDS.some(k => symptom.toLowerCase().includes(k));

  // Placeholder
  const getPlaceholder = () => {
    if (soundChip) return `When exactly does the ${soundChip.toLowerCase()} happen?`;
    if (whereChip) return `What does it feel like from ${whereChip.toLowerCase()}?`;
    if (whenChip) return `What specifically happens ${whenChip.toLowerCase()}?`;
    return "Describe what's happening...";
  };

  // Past diagnoses
  const { data: diagnosisSessions } = useQuery({
    queryKey: ['diagnosis-sessions', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diagnosis_sessions')
        .select('*, projects:project_id(id, title, status)')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!vehicleId,
  });

  // Get step counts for past sessions that have project_ids
  const projectIds = (diagnosisSessions || []).filter((s: any) => s.project_id).map((s: any) => s.project_id);
  const { data: stepCounts } = useQuery({
    queryKey: ['diagnosis-step-counts', projectIds],
    queryFn: async () => {
      if (!projectIds.length) return {};
      const { data, error } = await supabase
        .from('project_steps')
        .select('project_id, status')
        .in('project_id', projectIds);
      if (error) throw error;
      const counts: Record<string, { total: number; completed: number }> = {};
      for (const s of data || []) {
        if (!counts[s.project_id]) counts[s.project_id] = { total: 0, completed: 0 };
        counts[s.project_id].total++;
        if (s.status === 'healthy' || s.status === 'faulty') counts[s.project_id].completed++;
      }
      return counts;
    },
    enabled: projectIds.length > 0,
  });

  // File handlers
  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 6);
    const valid = files.filter(f => f.size <= 10 * 1024 * 1024 && /\.(jpg|jpeg|png|heic|webp)$/i.test(f.name));
    setAttachments(prev => [...prev, ...valid.map(f => ({
      type: 'photo' as const, file: f, name: f.name, thumbnailUrl: URL.createObjectURL(f),
    }))]);
    setShowAttachMenu(false);
  };

  const handleVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error('Video must be under 50MB'); return; }
    // Check duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      if (video.duration > 15) {
        toast.error('Keep it under 15 seconds — just the sound or symptom.');
        URL.revokeObjectURL(url);
        return;
      }
      // Extract first frame
      video.currentTime = 0.5;
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.7);
        setAttachments(prev => [...prev, {
          type: 'video', file, name: file.name, thumbnailUrl: thumbUrl,
          duration: Math.round(video.duration),
        }]);
        URL.revokeObjectURL(url);
      };
    };
    setShowAttachMenu(false);
  };

  const handleDocs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    const valid = files.filter(f => f.size <= 5 * 1024 * 1024 && /\.(pdf|txt)$/i.test(f.name));
    setAttachments(prev => [...prev, ...valid.map(f => ({
      type: 'doc' as const, file: f, name: f.name,
    }))]);
    setShowAttachMenu(false);
  };

  const addLink = () => {
    if (!linkInput.trim()) return;
    const links = attachments.filter(a => a.type === 'link');
    if (links.length >= 3) { toast.error('Max 3 links'); return; }
    try {
      const u = new URL(linkInput.startsWith('http') ? linkInput : `https://${linkInput}`);
      setAttachments(prev => [...prev, { type: 'link', url: u.href, name: u.hostname }]);
      setLinkInput('');
      setShowLinkInput(false);
    } catch { toast.error('Invalid URL'); }
    setShowAttachMenu(false);
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const startDiagnosis = async () => {
    const fullSymptom = buildFullSymptom();
    if (!fullSymptom.trim() || !user) return;
    setIsCreating(true);

    try {
      const { data: chatSession, error: chatError } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, vehicle_id: vehicleId, title: `Diagnosis: ${fullSymptom.slice(0, 50)}` })
        .select('id').single();
      if (chatError) throw chatError;

      const { data: diagSession, error: diagError } = await supabase
        .from('diagnosis_sessions')
        .insert({
          user_id: user.id, vehicle_id: vehicleId, chat_session_id: chatSession.id,
          symptom: fullSymptom, status: 'active', tree_data: [],
        } as any)
        .select('id').single();
      if (diagError) throw diagError;

      toast.info('Ratchet is building your diagnostic plan...');

      // Build media context for the edge function
      const photoBase64s: string[] = [];
      const contextParts: string[] = [];

      for (const att of attachments) {
        if (att.type === 'photo' && att.file) {
          const b64 = await fileToBase64(att.file);
          photoBase64s.push(b64);
        } else if (att.type === 'video' && att.thumbnailUrl) {
          photoBase64s.push(att.thumbnailUrl);
        } else if (att.type === 'doc' && att.file) {
          try {
            const text = await att.file.text();
            contextParts.push(`Document "${att.name}": ${text.slice(0, 2000)}`);
          } catch {}
        } else if (att.type === 'link' && att.url) {
          contextParts.push(att.url);
        }
      }

      const additionalContext = contextParts.length > 0
        ? `\n\nUser provided references: ${contextParts.join(', ')}`
        : '';

      const { data: genData, error: genError } = await supabase.functions.invoke('generate-diagnosis', {
        body: {
          vehicleId, symptom: fullSymptom + additionalContext,
          diagnosisId: (diagSession as any).id,
          images: photoBase64s.length > 0 ? photoBase64s : undefined,
        },
      });

      if (genError) {
        console.error('Generation error:', genError);
        toast.error('Plan generation had an issue, but you can still diagnose with Ratchet');
        navigate(`/garage/${vehicleId}/diagnose/${(diagSession as any).id}`);
        return;
      }

      if (genData?.projectId) {
        await supabase.from('diagnosis_sessions').update({
          project_id: genData.projectId,
          tree_data: (genData.possibleCauses || []).map((c: string) => ({ cause: c, status: 'untested' })),
          updated_at: new Date().toISOString(),
        } as any).eq('id', (diagSession as any).id);
      }

      toast.success('Diagnostic plan ready!');
      navigate(`/garage/${vehicleId}/diagnose/${(diagSession as any).id}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to start diagnosis');
    }
    setIsCreating(false);
  };

  const statusConfig = {
    active: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'In Progress' },
    resolved: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Diagnosed' },
    unresolved: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Unresolved' },
  };

  return (
    <div className="space-y-8 mt-4">
      {/* Symptom Input */}
      <Card className="border-primary/20 overflow-hidden">
        <CardContent className="p-5 md:p-8">
          <div className="flex flex-col items-center text-center mb-5">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Search className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">What's going on?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Describe what you're experiencing with your {vehicleName}
            </p>
          </div>

          {/* WHEN chips */}
          <div className="mb-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">When</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {WHEN_CHIPS.map(chip => (
                <button key={chip} onClick={() => setWhenChip(whenChip === chip ? null : chip)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors whitespace-nowrap",
                    whenChip === chip
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}>
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* WHERE chips */}
          <div className="mb-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Where</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {WHERE_CHIPS.map(chip => (
                <button key={chip} onClick={() => setWhereChip(whereChip === chip ? null : chip)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors whitespace-nowrap",
                    whereChip === chip
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}>
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* SOUND chips */}
          {soundVisible && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Sound</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {SOUND_CHIPS.map(chip => (
                  <button key={chip.label}
                    onClick={() => setSoundChip(soundChip === chip.label ? null : chip.label)}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-lg text-xs border transition-colors whitespace-nowrap",
                      soundChip === chip.label
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}>
                    <span className="font-medium">{chip.label}</span>
                    <span className="text-muted-foreground ml-1">— {chip.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!soundVisible && (
            <button onClick={() => setShowSoundRow(true)}
              className="text-xs text-primary hover:underline mb-3 block">
              + Add sound description
            </button>
          )}

          {/* Textarea */}
          <textarea
            value={symptom}
            onChange={e => setSymptom(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full min-h-[100px] bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary transition-colors"
          />

          {/* Symptom categories */}
          <div className="mt-4 mb-4 space-y-2">
            {SYMPTOM_CATEGORIES.map(cat => (
              <Collapsible key={cat.label} defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider w-full text-left py-1">
                  <ChevronDown className="h-3 w-3 transition-transform" />
                  {cat.label}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {cat.chips.map(chip => (
                      <button key={chip} onClick={() => setSymptom(prev => prev === chip ? '' : chip)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs border transition-colors",
                          symptom === chip
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        )}>
                        {chip}
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>

          {/* Media attachment */}
          <div className="mb-4 relative">
            <button onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Add photos, video, or docs to help Ratchet understand the problem
            </button>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5 ml-5">
              The more context now, the more targeted your plan.
            </p>

            {showAttachMenu && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-popover border border-border rounded-xl shadow-lg p-2 space-y-1 min-w-[220px]">
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-left">
                  <Camera className="h-4 w-4 text-primary" /> Photos
                </button>
                <button onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-left">
                  <Video className="h-4 w-4 text-primary" /> Short video (≤15s)
                </button>
                <button onClick={() => docInputRef.current?.click()}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-left">
                  <FileText className="h-4 w-4 text-primary" /> Documents
                </button>
                <button onClick={() => { setShowLinkInput(true); setShowAttachMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-left">
                  <LinkIcon className="h-4 w-4 text-primary" /> Links
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
            <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={handleVideo} />
            <input ref={docInputRef} type="file" accept=".pdf,.txt" multiple className="hidden" onChange={handleDocs} />
          </div>

          {/* Link input */}
          {showLinkInput && (
            <div className="flex gap-2 mb-3">
              <input value={linkInput} onChange={e => setLinkInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addLink(); }}
                placeholder="Paste a URL..."
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              <Button size="sm" onClick={addLink}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowLinkInput(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Attachment thumbnails */}
          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
              {attachments.map((att, i) => (
                <div key={i} className="relative shrink-0 group">
                  {att.type === 'photo' && att.thumbnailUrl && (
                    <img src={att.thumbnailUrl} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
                  )}
                  {att.type === 'video' && att.thumbnailUrl && (
                    <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                      <img src={att.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[10px] text-white px-1 rounded">
                        {att.duration}s
                      </span>
                    </div>
                  )}
                  {att.type === 'doc' && (
                    <div className="h-16 w-16 rounded-lg border border-border bg-muted flex flex-col items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[56px]">{att.name}</span>
                    </div>
                  )}
                  {att.type === 'link' && (
                    <div className="h-16 px-3 rounded-lg border border-border bg-muted flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate max-w-[80px]">{att.name}</span>
                    </div>
                  )}
                  <button onClick={() => removeAttachment(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={startDiagnosis} disabled={!symptom.trim() || isCreating} className="w-full h-12 text-base font-semibold">
            {isCreating ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                <span>Building diagnostic plan...</span>
              </div>
            ) : (
              <><Search className="h-4 w-4 mr-2" />Start Diagnosis</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Past Diagnoses */}
      {diagnosisSessions && diagnosisSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Past Diagnoses</h3>
          <div className="space-y-2">
            {diagnosisSessions.map((session: any) => {
              const config = statusConfig[session.status as keyof typeof statusConfig] || statusConfig.active;
              const StatusIcon = config.icon;
              const linkedProject = session.projects;
              const sc = session.project_id && stepCounts ? stepCounts[session.project_id] : null;
              return (
                <Card key={session.id}
                  className="border-border hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/garage/${vehicleId}/diagnose/${session.id}`)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
                      <StatusIcon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{session.symptom}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                        {session.confirmed_cause && (
                          <Badge className="text-[10px] h-5 bg-primary/10 text-primary border-primary/30">
                            → {session.confirmed_cause}
                          </Badge>
                        )}
                        {!session.confirmed_cause && session.conclusion && (
                          <Badge variant="outline" className="text-[10px] h-5">→ {session.conclusion}</Badge>
                        )}
                        {sc && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{sc.completed}/{sc.total} steps</span>
                            <Progress value={(sc.completed / sc.total) * 100} className="h-1 w-12" />
                          </div>
                        )}
                        {linkedProject && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            <Wrench className="h-2.5 w-2.5 mr-1" />Repair project
                          </Badge>
                        )}
                      </div>
                    </div>
                    {session.status === 'active' ? (
                      <Button size="sm" variant="default" className="shrink-0 text-xs"
                        onClick={e => { e.stopPropagation(); navigate(`/garage/${vehicleId}/diagnose/${session.id}`); }}>
                        Resume
                      </Button>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
