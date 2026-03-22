import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  Wrench, Sparkles, X, ChevronDown, ChevronRight,
  AlertTriangle, Clock, Shield, Package, Settings2,
  ListOrdered, CheckCircle2
} from 'lucide-react';

interface NewProjectSheetProps {
  open: boolean;
  onClose: () => void;
  vehicleId: string;
  vehicleName: string;
}

type Screen = 'describe' | 'generating' | 'review';

interface GeneratedPlan {
  project: any;
  parts: any[];
  tools: any[];
  steps: any[];
}

const COMMON_JOBS: Record<string, string[]> = {
  default: [
    'Oil & Filter Change', 'Spark Plugs', 'Brake Pads & Rotors',
    'Air Filter', 'Starter Replacement', 'Alternator', 'Water Pump',
    'Thermostat', 'O2 Sensor', 'Catalytic Converter', 'Timing Chain Service',
    'Valve Cover Gasket', 'AC Compressor', 'Power Steering Rack',
  ],
};

const LOADING_MESSAGES = [
  'Checking factory specs for your vehicle...',
  'Looking up torque values...',
  'Building your parts list...',
  'Writing step-by-step instructions...',
  'Adding vehicle-specific tips...',
  'Calculating estimated costs...',
  'Reviewing safety procedures...',
];

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-success/20 text-success',
  Intermediate: 'bg-primary/20 text-primary',
  Advanced: 'bg-warning/20 text-warning',
  Expert: 'bg-destructive/20 text-destructive',
};

export default function NewProjectSheet({ open, onClose, vehicleId, vehicleName }: NewProjectSheetProps) {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>('describe');
  const [jobDescription, setJobDescription] = useState('');
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setScreen('describe');
      setJobDescription('');
      setGeneratedPlan(null);
      setLoadingMsgIndex(0);
    }
  }, [open]);

  // Cycle loading messages
  useEffect(() => {
    if (screen !== 'generating') return;
    const interval = setInterval(() => {
      setLoadingMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [screen]);

  const handleGenerate = async () => {
    setScreen('generating');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-project`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ vehicleId, jobDescription }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate project');
      }

      const plan = await response.json();
      setGeneratedPlan(plan);
      setScreen('review');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate project');
      setScreen('describe');
    }
  };

  const handleSave = () => {
    queryClient.invalidateQueries({ queryKey: ['projects', vehicleId] });
    queryClient.invalidateQueries({ queryKey: ['vehicle-projects', vehicleId] });
    toast.success('Project saved!');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <span className="font-bold">New Project</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {screen === 'describe' && (
          <DescribeScreen
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            vehicleName={vehicleName}
            onGenerate={handleGenerate}
          />
        )}
        {screen === 'generating' && (
          <GeneratingScreen
            loadingMessage={LOADING_MESSAGES[loadingMsgIndex]}
            vehicleName={vehicleName}
          />
        )}
        {screen === 'review' && generatedPlan && (
          <ReviewScreen
            plan={generatedPlan}
            partsExpanded={partsExpanded}
            setPartsExpanded={setPartsExpanded}
            toolsExpanded={toolsExpanded}
            setToolsExpanded={setToolsExpanded}
            stepsExpanded={stepsExpanded}
            setStepsExpanded={setStepsExpanded}
            onSave={handleSave}
            onBack={() => setScreen('describe')}
          />
        )}
      </div>
    </div>
  );
}

function DescribeScreen({
  jobDescription, setJobDescription, vehicleName, onGenerate
}: {
  jobDescription: string;
  setJobDescription: (v: string) => void;
  vehicleName: string;
  onGenerate: () => void;
}) {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="text-center pt-4">
        <p className="text-sm text-muted-foreground">
          What are you working on? · <span className="text-foreground">{vehicleName}</span>
        </p>
      </div>

      <Textarea
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder={"Describe the repair...\n\ne.g. Replace catalytic converter, front brake pads and rotors, diagnose rough idle, change starter motor..."}
        className="min-h-[120px] text-lg bg-secondary border-2 border-border focus:border-primary rounded-2xl resize-none p-4"
      />

      {/* Common jobs */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">Common jobs for your {vehicleName}</p>
        <div className="flex flex-wrap gap-2">
          {COMMON_JOBS.default.map((job) => (
            <button
              key={job}
              onClick={() => setJobDescription(job)}
              className="px-3 py-1.5 rounded-full text-sm border border-border bg-secondary hover:border-primary transition-colors"
            >
              {job}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <div className="pt-4 pb-8">
        <Button
          onClick={onGenerate}
          disabled={!jobDescription.trim()}
          className="w-full h-14 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Generate with Ratchet
        </Button>
      </div>
    </div>
  );
}

function GeneratingScreen({ loadingMessage, vehicleName }: { loadingMessage: string; vehicleName: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="relative mb-8">
        <Wrench className="h-16 w-16 text-primary animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      <h2 className="text-xl font-bold mb-2">Ratchet is building your plan...</h2>
      <p className="text-sm text-muted-foreground mb-8">{vehicleName}</p>
      <p className="text-sm text-primary animate-pulse transition-all min-h-[20px]">
        {loadingMessage}
      </p>
      <div className="w-48 mt-8">
        <Progress value={undefined} className="h-1 bg-secondary [&>div]:bg-primary [&>div]:animate-pulse" />
      </div>
    </div>
  );
}

function ReviewScreen({
  plan, partsExpanded, setPartsExpanded, toolsExpanded, setToolsExpanded,
  stepsExpanded, setStepsExpanded, onSave, onBack,
}: {
  plan: GeneratedPlan;
  partsExpanded: boolean;
  setPartsExpanded: (v: boolean) => void;
  toolsExpanded: boolean;
  setToolsExpanded: (v: boolean) => void;
  stepsExpanded: boolean;
  setStepsExpanded: (v: boolean) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const { project, parts, tools, steps } = plan;
  const totalPartsCost = parts.reduce((s, p) => s + (Number(p.estimated_cost) || 0) * (p.quantity || 1), 0);
  const difficultyClass = DIFFICULTY_COLORS[project.difficulty] || '';

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 pb-24">
      {/* Project Header */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <h2 className="text-xl font-bold">{project.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {project.difficulty && (
              <Badge className={difficultyClass}>{project.difficulty}</Badge>
            )}
            {project.estimated_minutes && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                ~{project.estimated_minutes} min
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> AI Generated
            </Badge>
          </div>

          {/* Safety warnings */}
          {project.safety_warnings?.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-3 space-y-1">
                {project.safety_warnings.map((w: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Parts */}
      <Collapsible open={partsExpanded} onOpenChange={setPartsExpanded}>
        <Card className="border-border">
          <CollapsibleTrigger asChild>
            <CardContent className="p-4 cursor-pointer hover:bg-accent/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{parts.length} parts needed</span>
                <span className="text-muted-foreground text-sm">· Est. ${totalPartsCost.toFixed(0)}</span>
              </div>
              {partsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2">
              {parts.map((p) => (
                <div key={p.id} className="flex items-start justify-between py-2 border-t border-border text-sm">
                  <div>
                    <p className="font-medium">{p.name}{p.quantity > 1 ? ` ×${p.quantity}` : ''}</p>
                    {p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}
                    {p.part_number && <p className="text-xs font-mono text-primary">{p.part_number}</p>}
                    {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                  </div>
                  {p.estimated_cost && (
                    <span className="text-muted-foreground shrink-0">${Number(p.estimated_cost).toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Tools */}
      <Collapsible open={toolsExpanded} onOpenChange={setToolsExpanded}>
        <Card className="border-border">
          <CollapsibleTrigger asChild>
            <CardContent className="p-4 cursor-pointer hover:bg-accent/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{tools.length} tools needed</span>
              </div>
              {toolsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              {tools.map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 border-t border-border text-sm">
                  <span>{t.name}</span>
                  {t.spec && <span className="text-xs font-mono text-muted-foreground">({t.spec})</span>}
                  {!t.required && <Badge variant="outline" className="text-[10px]">Optional</Badge>}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Steps */}
      <Collapsible open={stepsExpanded} onOpenChange={setStepsExpanded}>
        <Card className="border-border">
          <CollapsibleTrigger asChild>
            <CardContent className="p-4 cursor-pointer hover:bg-accent/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{steps.length} steps</span>
              </div>
              {stepsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              {steps.map((s) => (
                <div key={s.id} className="border-t border-border pt-3">
                  <div className="flex items-start gap-2">
                    <span className="text-primary font-bold text-sm shrink-0">{s.step_number}.</span>
                    <div className="space-y-1 flex-1">
                      <p className="font-medium text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                      {s.torque_specs && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(s.torque_specs as any[]).map((ts: any, i: number) => (
                            <Badge key={i} className="bg-primary/20 text-primary text-[10px]">
                              {ts.bolt}: {ts.spec} {ts.unit}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {s.tip && (
                        <p className="text-xs text-primary mt-1">💡 {s.tip}</p>
                      )}
                      {s.safety_note && (
                        <p className="text-xs text-destructive mt-1">⚠️ {s.safety_note}</p>
                      )}
                      {s.estimated_minutes && (
                        <p className="text-[10px] text-muted-foreground">~{s.estimated_minutes} min</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border z-10">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-shrink-0">
            Edit
          </Button>
          <Button onClick={onSave} className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Looks good — Save Project
          </Button>
        </div>
      </div>
    </div>
  );
}
