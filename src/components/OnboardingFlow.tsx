import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/button';
import { Wrench, ChevronRight, Car, MessageCircle, Grid3X3 } from 'lucide-react';

const STEPS = ['welcome', 'features', 'done'] as const;

interface OnboardingFlowProps {
  name: string;
  onComplete: () => void;
}

export default function OnboardingFlow({ name, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<typeof STEPS[number]>('welcome');
  const [featureIdx, setFeatureIdx] = useState(0);
  const { setAddVehicleModalOpen } = useAppStore();

  const features = [
    {
      icon: Wrench, color: 'text-primary',
      title: 'Start a project for any repair',
      body: 'Ratchet builds you a step-by-step plan, specific to your car — with torque specs, parts lists, and pro tips.',
    },
    {
      icon: MessageCircle, color: 'text-primary',
      title: 'Your AI mechanic, always available',
      body: 'Ask anything about your car. Get answers in seconds. Ratchet knows your exact vehicle.',
    },
    {
      icon: Grid3X3, color: 'text-primary',
      title: 'Blueprint your car',
      body: 'Tap any system to see components, costs, and common issues for your exact make and model.',
    },
  ];

  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center animate-page-enter">
        <div className="text-center space-y-6 px-6 max-w-md">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Wrench className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">
            Hey {name}, welcome to <span className="text-primary">Ratchet</span>.
          </h1>
          <p className="text-muted-foreground text-lg">
            Your mechanic buddy. Let's set up your garage.
          </p>
          <Button
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 text-lg"
            onClick={() => setStep('features')}
          >
            Let's go <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'features') {
    const f = features[featureIdx];
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center animate-page-enter">
        <div className="text-center space-y-6 px-6 max-w-md" key={featureIdx}>
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <f.icon className={`h-8 w-8 ${f.color}`} />
          </div>
          <h2 className="text-2xl font-bold animate-fade-in">{f.title}</h2>
          <p className="text-muted-foreground animate-fade-in">{f.body}</p>
          <div className="flex items-center justify-center gap-2 pt-4">
            {features.map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === featureIdx ? 'w-6 bg-primary' : 'w-2 bg-secondary'}`} />
            ))}
          </div>
          <Button
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8"
            onClick={() => {
              if (featureIdx < features.length - 1) {
                setFeatureIdx(featureIdx + 1);
              } else {
                setStep('done');
              }
            }}
          >
            {featureIdx < features.length - 1 ? 'Next' : 'Get started'}
            <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center animate-page-enter">
      <div className="text-center space-y-6 px-6 max-w-md">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Car className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Your garage is ready.</h2>
        <p className="text-muted-foreground">Add your first vehicle to unlock everything.</p>
        <div className="space-y-3 pt-2">
          <Button
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12"
            onClick={() => {
              onComplete();
              setAddVehicleModalOpen(true);
            }}
          >
            Add your vehicle
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onComplete}
          >
            I'll do this later
          </Button>
        </div>
      </div>
    </div>
  );
}
