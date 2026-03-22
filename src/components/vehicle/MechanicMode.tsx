import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, ArrowRight, Check, X, Mic, Volume2, VolumeX,
  Wrench, AlertTriangle, Lightbulb
} from 'lucide-react';

interface MechanicModeProps {
  project: any;
  vehicle: any;
  steps: any[];
  activeStepIdx: number;
  onStepComplete: (stepId: string) => void;
  onStepChange: (idx: number) => void;
  onExit: () => void;
  openRatchetPanel: (msg?: string) => void;
}

export default function MechanicMode({
  project, vehicle, steps, activeStepIdx, onStepComplete, onStepChange, onExit, openRatchetPanel,
}: MechanicModeProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const recognitionRef = useRef<any>(null);

  const step = steps[activeStepIdx];
  const isDone = step?.status === 'done';
  const torqueSpecs = Array.isArray(step?.torque_specs) ? step.torque_specs : [];

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

  // Voice recognition
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
      // Handle voice commands
      const lower = text.toLowerCase();
      if (lower.includes('next step')) {
        if (activeStepIdx < steps.length - 1) onStepChange(activeStepIdx + 1);
      } else if (lower.includes('mark complete') || lower.includes('done')) {
        if (step && !isDone) onStepComplete(step.id);
      } else if (lower.includes('torque')) {
        // Already visible
      } else {
        openRatchetPanel(
          `I'm on Step ${step?.step_number} of ${project.title}: ${step?.title}. ${text}`
        );
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
    recognitionRef.current = recognition;
  }, [activeStepIdx, step, isDone, steps.length, onStepChange, onStepComplete, openRatchetPanel, project.title]);

  if (!step) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-xs text-muted-foreground">Step {activeStepIdx + 1}/{steps.length}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className="text-muted-foreground p-2">
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button onClick={onExit} className="text-muted-foreground p-2 text-xs">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-y-auto px-6 pb-40">
        {/* Step title */}
        <h1 className="text-[28px] font-bold text-foreground leading-tight mt-4">{step.title}</h1>

        {step.estimated_minutes && (
          <Badge variant="secondary" className="mt-3 text-sm">~{step.estimated_minutes}m</Badge>
        )}

        {/* Description */}
        <div className="mt-6 text-xl leading-[1.8] text-foreground/90 prose prose-invert prose-lg max-w-none">
          <ReactMarkdown>{step.description}</ReactMarkdown>
        </div>

        {/* Torque specs - HUGE */}
        {torqueSpecs.length > 0 && (
          <div className="mt-6 space-y-3">
            {torqueSpecs.map((ts: any, i: number) => (
              <div key={i}
                className="flex items-center gap-3 px-5 py-4 rounded-xl border border-primary/40 bg-primary/15 font-mono text-2xl text-primary">
                <Wrench className="h-6 w-6 shrink-0" />
                <span>{ts.bolt}: <strong>{ts.spec} {ts.unit}</strong></span>
              </div>
            ))}
          </div>
        )}

        {/* Tip */}
        {step.tip && (
          <div className="mt-6 rounded-xl border border-warning/30 bg-[#1a1500] p-4" style={{ borderLeftWidth: 4, borderLeftColor: '#eab308' }}>
            <p className="font-bold text-warning flex items-center gap-2 text-lg"><Lightbulb className="h-5 w-5" /> Pro Tip</p>
            <p className="text-lg text-foreground mt-2">{step.tip}</p>
          </div>
        )}

        {/* Safety note */}
        {step.safety_note && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-[#1f0000] p-4" style={{ borderLeftWidth: 4, borderLeftColor: 'hsl(var(--destructive))' }}>
            <p className="font-bold text-destructive flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5" /> Safety</p>
            <p className="text-lg text-foreground mt-2">{step.safety_note}</p>
          </div>
        )}
      </div>

      {/* Voice listening indicator */}
      {isListening && (
        <div className="absolute top-16 left-0 right-0 text-center">
          <span className="text-primary animate-pulse text-lg font-medium">Listening...</span>
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-border">
        {/* Mark complete - massive tap target */}
        {!isDone && (
          <button
            className="w-full h-[72px] bg-primary text-primary-foreground text-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            onClick={() => onStepComplete(step.id)}>
            <Check className="h-6 w-6" /> Done — Next Step
          </button>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 h-16 safe-area-bottom">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-12 w-12 text-muted-foreground"
              disabled={activeStepIdx <= 0}
              onClick={() => onStepChange(activeStepIdx - 1)}>
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <button
              className={`h-14 w-14 rounded-full flex items-center justify-center ${
                isListening ? 'bg-destructive animate-pulse' : 'bg-secondary'
              }`}
              onClick={startListening}>
              <Mic className={`h-6 w-6 ${isListening ? 'text-destructive-foreground' : 'text-foreground'}`} />
            </button>
          </div>

          <Button variant="ghost" size="icon" className="h-12 w-12 text-primary"
            disabled={activeStepIdx >= steps.length - 1}
            onClick={() => onStepChange(activeStepIdx + 1)}>
            <ArrowRight className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
