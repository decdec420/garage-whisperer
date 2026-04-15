import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithAuth } from '@/integrations/supabase/functions';
import { useAuth } from '@/hooks/useAuth';
import {
  Search, ChevronRight, CheckCircle2, AlertCircle, Clock, Wrench,
  Camera, Video, FileText, Link as LinkIcon, X, Plus, ChevronDown,
  ArrowLeft, ArrowRight, Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
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

// ─── Step indicator ───
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
              isActive ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background" :
              isDone ? "bg-primary/20 text-primary" :
              "bg-muted text-muted-foreground"
            )}>
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : step}
            </div>
            {i < total - 1 && (
              <div className={cn("h-0.5 w-8 rounded-full transition-colors", step < current ? "bg-primary/40" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chip row helper ───
function ChipRow({ chips, selected, onToggle, label }: {
  chips: string[] | { label: string; desc: string }[];
  selected: string[];
  onToggle: (chip: string) => void;
  label?: string;
}) {
  return (
    <div className="mb-4">
      {label && <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const chipLabel = typeof chip === 'string' ? chip : chip.label;
          const chipDesc = typeof chip === 'string' ? undefined : chip.desc;
          const isSelected = selected.includes(chipLabel);
          return (
            <button key={chipLabel} onClick={() => onToggle(chipLabel)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs border transition-colors whitespace-nowrap",
                isSelected
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}>
              <span className="font-medium">{chipLabel}</span>
              {chipDesc && <span className="text-muted-foreground ml-1 hidden sm:inline">— {chipDesc}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── DTC prefix → symptom category mapping ───
const DTC_PREFIX_MAP: Record<string, { category: string; chip: string; description: string }> = {
  'P00': { category: 'Engine Running', chip: 'Poor fuel economy', description: 'Fuel/Air Metering' },
  'P01': { category: 'Engine Running', chip: 'Poor fuel economy', description: 'Fuel/Air Metering' },
  'P02': { category: 'Engine Running', chip: 'Poor fuel economy', description: 'Fuel/Air Metering Auxiliary' },
  'P03': { category: 'Engine Running', chip: 'Misfires / shaking', description: 'Ignition System or Misfire' },
  'P04': { category: 'Engine Running', chip: 'Poor fuel economy', description: 'Auxiliary Emission Controls' },
  'P05': { category: 'Engine Running', chip: 'Rough idle', description: 'Vehicle Speed / Idle Control' },
  'P06': { category: 'Starting / Electrical', chip: 'Check engine light', description: 'Computer / Output Circuit' },
  'P07': { category: 'Engine Running', chip: 'Stalls randomly', description: 'Transmission' },
  'P0A': { category: 'Starting / Electrical', chip: 'Check engine light', description: 'Hybrid Propulsion' },
  'B': { category: 'Starting / Electrical', chip: 'Check engine light', description: 'Body' },
  'C': { category: 'Brakes / Steering / Suspension', chip: 'Vibration at speed', description: 'Chassis' },
  'U': { category: 'Starting / Electrical', chip: 'Check engine light', description: 'Network Communication' },
};

function mapDTCToSymptom(code: string): { chip: string; description: string } | null {
  const upper = code.toUpperCase();
  // Try P0x prefix first (3 chars), then first letter
  const p3 = upper.slice(0, 3);
  if (DTC_PREFIX_MAP[p3]) return DTC_PREFIX_MAP[p3];
  const p1 = upper.charAt(0);
  if (DTC_PREFIX_MAP[p1]) return DTC_PREFIX_MAP[p1];
  return null;
}

export default function DiagnoseTab({ vehicleId, vehicle }: DiagnoseTabProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Wizard: 0 = history, 1 = symptoms, 2 = context, 3 = evidence
  const [wizardStep, setWizardStep] = useState(0);
  const [obdSource, setObdSource] = useState<string | null>(null);

  const [symptom, setSymptom] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [whenChips, setWhenChips] = useState<string[]>([]);
  const [whereChips, setWhereChips] = useState<string[]>([]);
  const [soundChips, setSoundChips] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [linkInput, setLinkInput] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  // Auto-fill from scanned DTC
  useEffect(() => {
    const dtc = searchParams.get('dtc');
    if (!dtc) return;
    
    const mapping = mapDTCToSymptom(dtc);
    const desc = mapping?.description || 'Diagnostic Trouble Code';
    
    setSymptom(`DTC ${dtc.toUpperCase()} — ${desc} (scanned via OBD-II)`);
    if (mapping?.chip) {
      setSelectedChips(prev => prev.includes(mapping.chip) ? prev : [...prev, mapping.chip]);
    }
    setObdSource(dtc.toUpperCase());
    setWizardStep(2); // Skip to context — symptom is known from hardware
    
    // Clear the dtc param so it doesn't re-trigger
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('dtc');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  // Sound row auto-show based on noise chips
  const noiseRelated = selectedChips.some(c =>
    SOUND_KEYWORDS.some(k => c.toLowerCase().includes(k))
  ) || SOUND_KEYWORDS.some(k => symptom.toLowerCase().includes(k));

  const buildFullSymptom = useCallback(() => {
    const chipText = selectedChips.join(', ');
    let s = symptom.trim() ? symptom.trim() : chipText;
    if (symptom.trim() && selectedChips.length > 0) s = `${chipText}. ${symptom.trim()}`;
    if (whenChips.length) s = `[When ${whenChips.join(', ').toLowerCase()}] ${s}`;
    if (whereChips.length) s = `${s} [from ${whereChips.join(', ').toLowerCase()}]`;
    if (soundChips.length) s = `${s} — sounds like ${soundChips.join(', ').toLowerCase()}`;
    return s;
  }, [symptom, selectedChips, whenChips, whereChips, soundChips]);

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
  };

  const handleVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error('Video must be under 50MB'); return; }
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
  };

  const handleDocs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    const valid = files.filter(f => f.size <= 5 * 1024 * 1024 && /\.(pdf|txt)$/i.test(f.name));
    setAttachments(prev => [...prev, ...valid.map(f => ({
      type: 'doc' as const, file: f, name: f.name,
    }))]);
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
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const resetWizard = () => {
    setWizardStep(0);
    setSymptom('');
    setSelectedChips([]);
    setWhenChips([]);
    setWhereChips([]);
    setSoundChips([]);
    setAttachments([]);
    setLinkInput('');
    setShowLinkInput(false);
    setObdSource(null);
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

      const { data: genData, error: genError } = await invokeWithAuth('generate-diagnosis', {
        vehicleId,
        symptom: fullSymptom + additionalContext,
        diagnosisId: (diagSession as any).id,
        images: photoBase64s.length > 0 ? photoBase64s : undefined,
      });

      if (genError) {
        console.error('Generation error:', genError);
        const isRateLimit = (genError as any).status === 429 || genError.message?.toLowerCase().includes('rate limit');
        toast.error(isRateLimit
          ? 'Rate limit reached — max 20 AI diagnoses per day.'
          : 'Plan generation had an issue, but you can still diagnose with Ratchet'
        );
        queryClient.invalidateQueries({ queryKey: ['diagnosis-sessions', vehicleId] });
        navigate(`/garage/${vehicleId}/diagnose/${(diagSession as any).id}`);
        return;
      }

      const mediaUrls: { type: string; url: string; name: string; duration?: number }[] = [];
      for (const att of attachments) {
        if ((att.type === 'photo' || att.type === 'video' || att.type === 'doc') && att.file) {
          try {
            const ext = att.file.name.split('.').pop() || 'jpg';
            const path = `${user.id}/diagnosis/${(diagSession as any).id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: uploadErr } = await supabase.storage.from('vehicle-documents').upload(path, att.file, { contentType: att.file.type });
            if (!uploadErr) {
              mediaUrls.push({ type: att.type, url: path, name: att.name, ...(att.duration ? { duration: att.duration } : {}) });
            }
          } catch {}
        } else if (att.type === 'link' && att.url) {
          mediaUrls.push({ type: 'link', url: att.url, name: att.name });
        }
      }

      if ((genData as any)?.projectId) {
        await supabase.from('diagnosis_sessions').update({
          project_id: (genData as any).projectId,
          tree_data: ((genData as any).possibleCauses || []).map((c: string) => ({ cause: c, status: 'untested' })),
          media_urls: mediaUrls,
          updated_at: new Date().toISOString(),
        } as any).eq('id', (diagSession as any).id);
      } else if (mediaUrls.length > 0) {
        await supabase.from('diagnosis_sessions').update({
          media_urls: mediaUrls,
          updated_at: new Date().toISOString(),
        } as any).eq('id', (diagSession as any).id);
      }

      queryClient.invalidateQueries({ queryKey: ['diagnosis-sessions', vehicleId] });
      toast.success('Diagnostic plan ready!');
      resetWizard();
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

  const canProceedStep1 = symptom.trim().length > 0 || selectedChips.length > 0;

  // ─── RENDER ───

  // Step 0: History view (default)
  if (wizardStep === 0) {
    const hasSessions = diagnosisSessions && diagnosisSessions.length > 0;
    return (
      <div className="space-y-6 mt-4">
        {/* New Diagnosis CTA */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Stethoscope className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-lg font-semibold text-foreground">Diagnose an Issue</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Describe what's going on and Ratchet will build a step-by-step diagnostic plan for your {vehicleName}.
              </p>
            </div>
            <Button onClick={() => setWizardStep(1)} size="lg" className="shrink-0 gap-2">
              <Plus className="h-4 w-4" /> New Diagnosis
            </Button>
          </CardContent>
        </Card>

        {/* Past Diagnoses */}
        {hasSessions ? (
          <div>
            <h3 className="text-base font-semibold text-foreground mb-3">Past Diagnoses</h3>
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
        ) : (
          <div className="text-center py-12">
            <Stethoscope className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No diagnoses yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Start one when something doesn't feel right.</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Wizard steps 1-3 ───
  return (
    <div className="mt-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setWizardStep(prev => prev === 1 ? 0 : prev - 1)}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold text-foreground flex-1">
          New Diagnosis
          {obdSource && (
            <Badge className="ml-2 text-[10px] h-5 bg-primary/10 text-primary border-primary/30">
              🔧 Scanned via OBD-II · {obdSource}
            </Badge>
          )}
        </h2>
        <button onClick={resetWizard} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>

      <StepIndicator current={wizardStep} total={3} />

      {/* Step 1: Symptoms */}
      {wizardStep === 1 && (
        <Card className="border-primary/20">
          <CardContent className="p-5 md:p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">What's happening?</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Select symptoms or describe the issue below.</p>
            </div>

            {/* Symptom categories as accordion (one at a time) */}
            <Accordion type="single" collapsible className="mb-4">
              {SYMPTOM_CATEGORIES.map(cat => (
                <AccordionItem key={cat.label} value={cat.label} className="border-border/50">
                  <AccordionTrigger className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-2.5 hover:no-underline">
                    <span className="flex items-center gap-2">
                      {cat.label}
                      {cat.chips.some(c => selectedChips.includes(c)) && (
                        <Badge className="text-[10px] h-4 bg-primary/10 text-primary border-0 px-1.5">
                          {cat.chips.filter(c => selectedChips.includes(c)).length}
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-1.5 pb-1">
                      {cat.chips.map(chip => (
                        <button key={chip} onClick={() => setSelectedChips(prev =>
                          prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
                        )}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs border transition-colors",
                            selectedChips.includes(chip)
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                          )}>
                          {chip}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* Selected chips summary */}
            {selectedChips.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {selectedChips.map(chip => (
                  <span key={chip} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/30">
                    {chip}
                    <button onClick={() => setSelectedChips(prev => prev.filter(c => c !== chip))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Free-text */}
            <textarea
              value={symptom}
              onChange={e => setSymptom(e.target.value)}
              placeholder="Describe what's happening in your own words..."
              className="w-full min-h-[100px] bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary transition-colors"
            />

            <div className="flex justify-end mt-4">
              <Button onClick={() => setWizardStep(2)} disabled={!canProceedStep1} className="gap-2">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Context */}
      {wizardStep === 2 && (
        <Card className="border-primary/20">
          <CardContent className="p-5 md:p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">When & where?</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Help narrow down the issue with context.</p>
            </div>

            <ChipRow label="When does it happen?" chips={WHEN_CHIPS} selected={whenChips}
              onToggle={chip => setWhenChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip])} />

            <ChipRow label="Where is it coming from?" chips={WHERE_CHIPS} selected={whereChips}
              onToggle={chip => setWhereChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip])} />

            {noiseRelated && (
              <ChipRow label="What does it sound like?" chips={SOUND_CHIPS} selected={soundChips}
                onToggle={chip => setSoundChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip])} />
            )}

            <div className="flex justify-between mt-4">
              <Button variant="ghost" onClick={() => setWizardStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setWizardStep(3)} className="gap-2">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Evidence */}
      {wizardStep === 3 && (
        <Card className="border-primary/20">
          <CardContent className="p-5 md:p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">Add evidence</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Optional — photos, short videos, or docs help Ratchet build a better plan.
              </p>
            </div>

            {/* Attachment buttons */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border hover:border-primary/30 bg-card text-sm transition-colors">
                <Camera className="h-4 w-4 text-primary" /> Photos
              </button>
              <button onClick={() => videoInputRef.current?.click()}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border hover:border-primary/30 bg-card text-sm transition-colors">
                <Video className="h-4 w-4 text-primary" /> Video (≤15s)
              </button>
              <button onClick={() => docInputRef.current?.click()}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border hover:border-primary/30 bg-card text-sm transition-colors">
                <FileText className="h-4 w-4 text-primary" /> Documents
              </button>
              <button onClick={() => setShowLinkInput(true)}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border hover:border-primary/30 bg-card text-sm transition-colors">
                <LinkIcon className="h-4 w-4 text-primary" /> Link
              </button>
            </div>

            {/* Hidden inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
            <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={handleVideo} />
            <input ref={docInputRef} type="file" accept=".pdf,.txt" multiple className="hidden" onChange={handleDocs} />

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
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ overscrollBehaviorX: 'contain' }}>
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

            {/* Summary of what will be diagnosed */}
            <div className="bg-muted rounded-xl p-3 mb-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-sm mb-1">Summary</p>
              <p className="line-clamp-3">{buildFullSymptom() || 'No symptoms selected'}</p>
              {attachments.length > 0 && (
                <p className="mt-1 text-primary">{attachments.length} attachment{attachments.length !== 1 ? 's' : ''} added</p>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setWizardStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={startDiagnosis}
                disabled={(!symptom.trim() && selectedChips.length === 0) || isCreating}
                className="gap-2">
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Building plan...
                  </div>
                ) : (
                  <><Search className="h-4 w-4" /> Start Diagnosis</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
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
