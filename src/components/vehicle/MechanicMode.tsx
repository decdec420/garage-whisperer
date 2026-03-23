import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, Mic, Volume2, VolumeX, Wrench, AlertTriangle, Lightbulb, Zap, Droplets, ArrowLeft, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MechanicModeProps {
  project: any;
  vehicle: any;
  steps: any[];
  activeStepIdx: number;
  onStepComplete: (stepId: string) => void;
  onStepChange: (idx: number) => void;
  onExit: () => void;
  onFinishJob: () => void;
  openRatchetPanel: (msg?: string) => void;
  elapsedStr: string;
}

function getStepContext(step: any): { icon: React.ReactNode; label: string } {
  const text = `${step.title} ${step.description}`.toLowerCase();
  if (text.match(/exhaust|catalytic|muffler|pipe|header/))
    return { icon: <Wrench className="h-12 w-12 text-primary" />, label: 'Exhaust System' };
  if (text.match(/jack|lift|support|stand/))
    return { icon: <ArrowUp className="h-12 w-12 text-primary" />, label: 'Lifting & Support' };
  if (text.match(/electric|wire|fuse|battery|sensor|connector|harness/))
    return { icon: <Zap className="h-12 w-12 text-primary" />, label: 'Electrical' };
  if (text.match(/oil|fluid|coolant|brake fluid|transmission fluid|drain|fill/))
    return { icon: <Droplets className="h-12 w-12 text-primary" />, label: 'Fluids' };
  if (text.match(/brake|rotor|caliper|pad/))
    return { icon: <Wrench className="h-12 w-12 text-primary" />, label: 'Braking System' };
  if (text.match(/suspen|strut|shock|spring|control arm|tie rod|ball joint/))
    return { icon: <Wrench className="h-12 w-12 text-primary" />, label: 'Suspension' };
  if (text.match(/engine|motor|cylinder|piston|valve|cam|timing/))
    return { icon: <Wrench className="h-12 w-12 text-primary" />, label: 'Engine' };
  return { icon: <Wrench className="h-12 w-12 text-primary" />, label: 'General' };
}

function ArrowUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export default function MechanicMode({
  project, vehicle, steps, activeStepIdx, onStepComplete, onStepChange, onExit, onFinishJob, openRatchetPanel, elapsedStr,
}: MechanicModeProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [subStepsChecked, setSubStepsChecked] = useState<Set<number>>(new Set());
  const [showCompletion, setShowCompletion] = useState(false);
  const [greenFlash, setGreenFlash] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const step = steps[activeStepIdx];
  const isDone = step?.status === 'done';
  const torqueSpecs = Array.isArray(step?.torque_specs) ? step.torque_specs : [];
  const subSteps = Array.isArray(step?.sub_steps) ? step.sub_steps : [];
  const completedSteps = steps.filter(s => s.status === 'done').length;
  const pctDone = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;
  const isLastStep = activeStepIdx >= steps.length - 1;
  const vehicleLabel = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '';

  useEffect(() => {
    setSubStepsChecked(new Set());
    scrollRef.current?.scrollTo(0, 0);
  }, [activeStepIdx]);

  // Wake Lock
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = lock;
      } catch {}
    };
    acquire();
    return () => { lock?.release(); };
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setIsListening(false);
      const lower = text.toLowerCase();
      if (lower.includes('next step') || lower.includes('next')) {
        if (activeStepIdx < steps.length - 1) onStepChange(activeStepIdx + 1);
      } else if (lower.includes('previous') || lower.includes('prev') || lower.includes('back')) {
        if (activeStepIdx > 0) onStepChange(activeStepIdx - 1);
      } else if (lower.includes('mark complete') || lower.includes('done') || lower.includes('finish')) {
        if (step && !isDone) handleComplete();
      } else {
        openRatchetPanel(`I'm on Step ${step?.step_number} of ${project.title}: ${step?.title}. ${text}`);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
    recognitionRef.current = recognition;
  }, [activeStepIdx, step, isDone, steps.length, onStepChange, openRatchetPanel, project.title]);

  const handleComplete = useCallback(() => {
    if (!step) return;
    if (isLastStep) {
      setGreenFlash(true);
      onStepComplete(step.id);
      setTimeout(() => { setGreenFlash(false); setShowCompletion(true); }, 600);
    } else {
      setGreenFlash(true);
      onStepComplete(step.id);
      setTimeout(() => { setGreenFlash(false); onStepChange(activeStepIdx + 1); }, 400);
    }
  }, [step, isLastStep, onStepComplete, onStepChange, activeStepIdx]);

  const toggleSubStep = (idx: number) => {
    setSubStepsChecked(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const allSubStepsDone = subSteps.length > 0 && subStepsChecked.size === subSteps.length;

  if (!step && !showCompletion) return null;

  const content = showCompletion ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.95)' }}>
      <div className="text-center space-y-5 p-8 animate-scale-in">
        <div className="mx-auto flex items-center justify-center rounded-full bg-primary" style={{ width: 80, height: 80 }}>
          <Check className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-bold text-foreground">Job done.</h1>
        <p className="text-lg text-primary">{vehicleLabel}</p>
        <p className="text-muted-foreground">Time spent: {elapsedStr}</p>
        <div className="space-y-3 pt-4 max-w-xs mx-auto">
          <button className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-lg font-bold" onClick={onFinishJob}>
            Log this repair
          </button>
          <button className="w-full h-12 rounded-xl text-muted-foreground text-base" onClick={onExit}>
            Exit Mechanic Mode
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: '#000000' }}>
      {greenFlash && (
        <div className="fixed inset-0 z-[10000] pointer-events-none animate-fade-out" style={{ background: 'rgba(34,197,94,0.3)' }} />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 52 }}>
        <button onClick={onExit} className="text-sm text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-zinc-900 transition-colors">
          Exit
        </button>
        <span className="text-base text-foreground font-medium">Step {activeStepIdx + 1} of {steps.length}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className="p-2 text-muted-foreground rounded-full hover:bg-zinc-900 transition-colors">
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            className={`flex items-center justify-center rounded-full transition-all ${isListening ? 'bg-destructive animate-pulse' : 'bg-zinc-800'}`}
            style={{ width: 44, height: 44 }}
            onClick={startListening}
          >
            <Mic className={`h-5 w-5 ${isListening ? 'text-destructive-foreground' : 'text-foreground'}`} />
          </button>
        </div>
      </div>

      {isListening && (
        <div className="text-center py-1">
          <span className="text-primary animate-pulse text-sm font-medium">Listening...</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full shrink-0" style={{ height: 3, background: '#27272a' }}>
        <div className="h-full transition-all duration-500 ease-out" style={{ width: `${pctDone}%`, background: '#f97316' }} />
      </div>

      {/* Main content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Step title */}
        <div className="flex items-start gap-3 px-5 pt-6 pb-2">
          <div className="shrink-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold" style={{ width: 36, height: 36, fontSize: 16 }}>
            {step!.step_number}
          </div>
          <h1 className="text-foreground font-bold leading-tight" style={{ fontSize: 28, lineHeight: 1.3 }}>
            {step!.title}
          </h1>
        </div>

        {/* Illustration zone — factory photo or icon placeholder */}
        {(step as any)?.charm_image_url ? (
          <div className="mx-5 mt-2 mb-4 rounded-xl overflow-hidden" style={{ background: '#0f0f0f', border: '1px solid #27272a' }}>
            <img
              src={(step as any).charm_image_url}
              alt={`Factory diagram — ${step!.title}`}
              className="w-full block"
              style={{ maxHeight: 240, objectFit: 'contain', padding: 12, background: '#0f0f0f' }}
              loading="lazy"
            />
            <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: '#0a0a0a', borderTop: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: 11, color: '#52525b' }}>📖 Factory Service Manual</span>
              {(step as any)?.charm_source_url && (
                <a href={(step as any).charm_source_url} target="_blank" rel="noopener noreferrer"
                  className="ml-auto hover:underline" style={{ fontSize: 11, color: '#f97316' }}>
                  charm.li
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="mx-5 mt-2 mb-4 flex flex-col items-center justify-center rounded-xl" style={{ height: 180, background: '#111111', border: '1px dashed #27272a' }}>
            {getStepContext(step!).icon}
            <span className="text-muted-foreground text-sm mt-2">{getStepContext(step!).label}</span>
            <span className="mt-auto mb-3" style={{ fontSize: 11, color: '#3f3f46' }}>Phase 2: Photo guide coming soon</span>
          </div>
        )}

        {/* Description */}
        <div className="px-5 pb-4 prose prose-invert max-w-none" style={{ fontSize: 19, lineHeight: 1.75, color: '#e4e4e7' }}>
          <ReactMarkdown>{step!.description}</ReactMarkdown>
        </div>

        {/* Torque specs */}
        {torqueSpecs.length > 0 && (
          <div className="px-5 space-y-2 pb-4">
            {torqueSpecs.map((ts: any, i: number) => (
              <div key={i} className="rounded-xl" style={{ background: 'rgba(249,115,22,0.15)', border: '2px solid rgba(249,115,22,0.6)', padding: '16px 20px' }}>
                <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: 15 }}>
                  🔩 {ts.bolt || ts.name || 'Torque spec'}
                </div>
                <div className="font-mono font-bold text-primary mt-1" style={{ fontSize: 32 }}>
                  {ts.spec || ts.value} {ts.unit || 'ft-lbs'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pro Tip */}
        {step!.tip && (
          <div className="mx-5 mb-3 rounded-r-xl" style={{ background: 'rgba(234,179,8,0.08)', borderLeft: '4px solid #eab308', padding: '14px 16px' }}>
            <p className="font-bold uppercase tracking-wide" style={{ fontSize: 13, color: '#eab308' }}>
              <Lightbulb className="h-4 w-4 inline mr-1" style={{ verticalAlign: '-2px' }} /> Pro Tip
            </p>
            <p className="text-foreground mt-1.5" style={{ fontSize: 17 }}>{step!.tip}</p>
          </div>
        )}

        {/* Safety note */}
        {step!.safety_note && (
          <div className="mx-5 mb-3 rounded-r-xl" style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid #ef4444', padding: '14px 16px' }}>
            <p className="font-bold uppercase tracking-wide" style={{ fontSize: 13, color: '#ef4444' }}>
              <AlertTriangle className="h-4 w-4 inline mr-1" style={{ verticalAlign: '-2px' }} /> Safety
            </p>
            <p className="text-foreground mt-1.5" style={{ fontSize: 17 }}>{step!.safety_note}</p>
          </div>
        )}

        {/* Sub-steps */}
        {subSteps.length > 0 && (
          <div className="px-5 pb-4 space-y-2">
            <p className="text-muted-foreground text-sm font-medium uppercase tracking-wide mb-2">Sub-steps</p>
            {subSteps.map((sub: string, i: number) => (
              <button key={i} className="flex items-center gap-3 w-full text-left rounded-lg p-3 transition-colors"
                style={{ background: subStepsChecked.has(i) ? 'rgba(34,197,94,0.1)' : '#111111' }}
                onClick={() => toggleSubStep(i)}>
                <div className="shrink-0 flex items-center justify-center rounded-lg border-2 transition-colors"
                  style={{ width: 36, height: 36, borderColor: subStepsChecked.has(i) ? '#22c55e' : '#3f3f46', background: subStepsChecked.has(i) ? '#22c55e' : 'transparent' }}>
                  {subStepsChecked.has(i) && <Check className="h-5 w-5 text-foreground" />}
                </div>
                <span className={`transition-colors ${subStepsChecked.has(i) ? 'text-muted-foreground line-through' : 'text-foreground'}`} style={{ fontSize: 18 }}>
                  {sub}
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={{ height: 100 }} />
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 flex items-center gap-3 px-4" style={{ height: 80, background: '#0a0a0a', borderTop: '1px solid #1a1a1a', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button className="flex items-center justify-center gap-1 rounded-xl font-medium transition-colors"
          style={{ flex: '0 0 30%', height: 56, background: '#1a1a1a', border: '1px solid #27272a', opacity: activeStepIdx <= 0 ? 0.3 : 1, color: '#e4e4e7', fontSize: 15 }}
          disabled={activeStepIdx <= 0} onClick={() => onStepChange(activeStepIdx - 1)}>
          <ArrowLeft className="h-5 w-5" /> Prev
        </button>

        <button
          className={`flex items-center justify-center gap-2 rounded-xl font-bold transition-all ${allSubStepsDone && subSteps.length > 0 ? 'animate-pulse' : ''}`}
          style={{ flex: '1 1 40%', height: 56, background: isDone ? '#22c55e' : '#f97316', color: '#fff', fontSize: 18 }}
          disabled={isDone} onClick={handleComplete}>
          <Check className="h-5 w-5" />
          {isDone ? 'Completed' : isLastStep ? 'Finish Job' : 'Done'}
        </button>

        <button className="flex items-center justify-center gap-1 rounded-xl font-medium transition-colors"
          style={{ flex: '0 0 30%', height: 56, background: '#1a1a1a', border: '1px solid #27272a', opacity: isLastStep ? 0.3 : 1, color: '#e4e4e7', fontSize: 15 }}
          disabled={isLastStep} onClick={() => onStepChange(activeStepIdx + 1)}>
          Next <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
