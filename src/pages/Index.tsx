import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Car, Wrench, DollarSign, Clock, MessageCircle, Plus, AlertTriangle, Cpu, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { user } = useAuth();
  const { activeVehicle, setAddVehicleModalOpen, openRatchetPanel } = useAppStore();
  const navigate = useNavigate();

  const profileName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: repairStats } = useQuery({
    queryKey: ['repair-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('repair_logs').select('diy_cost, shop_quote');
      if (error) throw error;
      const totalRepairs = data.length;
      const totalSavings = data.reduce((acc, r) => acc + ((Number(r.shop_quote) || 0) - (Number(r.diy_cost) || 0)), 0);
      return { totalRepairs, totalSavings: Math.max(0, totalSavings) };
    },
  });

  const { data: nextMaintenance } = useQuery({
    queryKey: ['next-maintenance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('maintenance_logs').select('service, next_due_date, next_due_mileage').not('next_due_date', 'is', null).order('next_due_date', { ascending: true }).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  // Empty state: no vehicles
  if (!vehiclesLoading && (!vehicles || vehicles.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Car className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Your garage is empty</h1>
        <p className="text-muted-foreground mb-6 max-w-sm">Add your first ride and I'll help you keep it running smooth — diagnostics, maintenance, the whole deal.</p>
        <Button size="lg" onClick={() => setAddVehicleModalOpen(true)}>
          <Plus className="h-5 w-5 mr-2" /> Add your first vehicle
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting}, {profileName}</h1>
          {activeVehicle && (
            <p className="text-muted-foreground text-sm mt-1">
              Active: {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Vehicles', value: vehicles?.length ?? 0, icon: Car, color: 'text-primary' },
          { label: 'Repairs', value: repairStats?.totalRepairs ?? 0, icon: Wrench, color: 'text-primary' },
          { label: 'DIY Savings', value: `$${(repairStats?.totalSavings ?? 0).toLocaleString()}`, icon: DollarSign, color: 'text-success' },
          { label: 'Next Service', value: nextMaintenance?.service ?? 'None', icon: Clock, color: 'text-warning' },
        ].map((stat) => (
          <Card key={stat.label} className="border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold">{vehiclesLoading ? <Skeleton className="h-7 w-16" /> : stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Start a Project', icon: FolderOpen, onClick: () => navigate('/projects'), color: 'bg-primary/10 text-primary' },
            { label: 'Blueprint my car', icon: Cpu, onClick: () => { if (activeVehicle) navigate(`/garage/${activeVehicle.id}?tab=blueprint`); else navigate('/garage'); }, color: 'bg-accent text-accent-foreground' },
            { label: 'Log maintenance', icon: Wrench, onClick: () => navigate('/maintenance'), color: 'bg-success/10 text-success' },
            { label: 'Diagnose a problem', icon: MessageCircle, onClick: () => openRatchetPanel('Diagnose a symptom'), color: 'bg-warning/10 text-warning' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:border-primary/30 transition-colors min-h-[100px] justify-center relative"
            >
              {'badge' in action && (action as any).badge && (
                <span className="absolute top-2 right-2 text-[9px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground">{(action as any).badge}</span>
              )}
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
