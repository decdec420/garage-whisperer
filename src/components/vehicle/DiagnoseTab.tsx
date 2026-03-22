import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Search, ChevronRight, CheckCircle2, AlertCircle, Clock, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SYMPTOM_CHIPS = [
  "Won't start", "Rough idle", "Check engine light",
  "Strange noise", "Overheating", "Poor fuel economy",
  "Pulls when braking", "Vibration", "Stalling",
  "Transmission slipping", "AC not cold", "Oil leak",
];

interface DiagnoseTabProps {
  vehicleId: string;
  vehicle: any;
}

export default function DiagnoseTab({ vehicleId, vehicle }: DiagnoseTabProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [symptom, setSymptom] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  const { data: diagnosisSessions, isLoading } = useQuery({
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

  const startDiagnosis = async () => {
    if (!symptom.trim() || !user) return;
    setIsCreating(true);

    try {
      // Create chat session for the diagnosis
      const { data: chatSession, error: chatError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          vehicle_id: vehicleId,
          title: `Diagnosis: ${symptom.trim().slice(0, 50)}`,
        })
        .select('id')
        .single();
      if (chatError) throw chatError;

      // Create diagnosis session
      const { data: diagSession, error: diagError } = await supabase
        .from('diagnosis_sessions')
        .insert({
          user_id: user.id,
          vehicle_id: vehicleId,
          chat_session_id: chatSession.id,
          symptom: symptom.trim(),
          status: 'active',
          tree_data: [],
        } as any)
        .select('id')
        .single();
      if (diagError) throw diagError;

      // Generate the diagnostic project plan via edge function
      toast.info('Ratchet is building your diagnostic plan...');

      const { data: genData, error: genError } = await supabase.functions.invoke('generate-diagnosis', {
        body: {
          vehicleId,
          symptom: symptom.trim(),
          diagnosisId: (diagSession as any).id,
        },
      });

      if (genError) {
        console.error('Generation error:', genError);
        // Still navigate even if generation fails — they can use chat-based diagnosis
        toast.error('Plan generation had an issue, but you can still diagnose with Ratchet');
        navigate(`/garage/${vehicleId}/diagnose/${(diagSession as any).id}`);
        return;
      }

      if (genData?.projectId) {
        // Update diagnosis session with the generated project
        await supabase.from('diagnosis_sessions').update({
          project_id: genData.projectId,
          tree_data: (genData.possibleCauses || []).map((c: string) => ({
            name: c,
            status: 'untested',
          })),
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
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">What's going on?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Describe what you're experiencing with your {vehicleName}
            </p>
          </div>

          <textarea
            value={symptom}
            onChange={e => setSymptom(e.target.value)}
            placeholder={`Describe the symptom...\n\ne.g. Car won't start, just clicks\n     Rough idle when cold\n     Grinding noise when braking\n     Check engine light on`}
            className="w-full min-h-[140px] bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary transition-colors"
          />

          {/* Quick chips */}
          <div className="mt-4 mb-5">
            <p className="text-xs text-muted-foreground mb-2">Common symptoms</p>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => setSymptom(chip)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs border transition-colors",
                    symptom === chip
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={startDiagnosis}
            disabled={!symptom.trim() || isCreating}
            className="w-full h-12 text-base font-semibold"
          >
            {isCreating ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                <span>Building diagnostic plan...</span>
              </div>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Start Diagnosis
              </>
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
              return (
                <Card
                  key={session.id}
                  className="border-border hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/garage/${vehicleId}/diagnose/${session.id}`)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
                      <StatusIcon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{session.symptom}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                        {session.conclusion && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            → {session.conclusion}
                          </Badge>
                        )}
                        {linkedProject && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            <Wrench className="h-2.5 w-2.5 mr-1" />
                            Repair project created
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
