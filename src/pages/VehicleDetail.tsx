import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageCircle, AlertTriangle, CheckCircle2, Grid3X3, Search, BookOpen, Wrench, DollarSign, Activity, ChevronRight, CalendarDays } from 'lucide-react';
import MaintenanceTab from '@/components/vehicle/MaintenanceTab';
import RepairsTab from '@/components/vehicle/RepairsTab';
import ProjectsTab from '@/components/vehicle/ProjectsTab';
import BlueprintTab from '@/components/vehicle/BlueprintTab';
import DiagnoseTab from '@/components/vehicle/DiagnoseTab';
import DocsTab from '@/components/vehicle/DocsTab';
import ChatsTab from '@/components/vehicle/ChatsTab';

export default function VehicleDetail() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openRatchetPanel, setActiveVehicle } = useAppStore();
  const defaultTab = searchParams.get('tab') || 'overview';

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', vehicleId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!vehicleId,
  });

  const { data: recalls } = useQuery({
    queryKey: ['recalls', vehicleId],
    queryFn: async () => {
      if (!vehicle) return [];
      if (vehicle.recall_data) return vehicle.recall_data as any[];
      const res = await fetch(`https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&modelYear=${vehicle.year}`);
      const json = await res.json();
      const results = json.results || [];
      await supabase.from('vehicles').update({ recall_data: results, last_recall_check: new Date().toISOString() }).eq('id', vehicleId!);
      return results;
    },
    enabled: !!vehicle,
    staleTime: 5 * 60 * 1000,
  });

  // Sync activeVehicle with the vehicle page being viewed
  useEffect(() => {
    if (vehicle) {
      setActiveVehicle({
        id: vehicle.id, year: vehicle.year, make: vehicle.make, model: vehicle.model,
        trim: vehicle.trim, nickname: vehicle.nickname, engine: vehicle.engine, mileage: vehicle.mileage,
      });
    }
  }, [vehicle?.id]);

  const { data: activeProjects } = useQuery({
    queryKey: ['active-projects', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, status, difficulty')
        .eq('vehicle_id', vehicleId!)
        .in('status', ['planning', 'active', 'paused']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!vehicleId,
  });

  const { data: recentMaintenance } = useQuery({
    queryKey: ['recent-maintenance', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('id, service, date, cost, next_due_date, next_due_mileage')
        .eq('vehicle_id', vehicleId!)
        .order('date', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!vehicleId,
  });

  const { data: repairStats } = useQuery({
    queryKey: ['repair-stats', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repair_logs')
        .select('diy_cost, shop_quote')
        .eq('vehicle_id', vehicleId!);
      if (error) throw error;
      const totalDiy = (data || []).reduce((sum, r) => sum + (r.diy_cost || 0), 0);
      const totalShop = (data || []).reduce((sum, r) => sum + (r.shop_quote || 0), 0);
      return { count: data?.length || 0, totalDiy, totalShop, savings: totalShop - totalDiy };
    },
    enabled: !!vehicleId,
  });

  const { data: activeDtcs } = useQuery({
    queryKey: ['active-dtcs', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dtc_records')
        .select('id, code, description, severity')
        .eq('vehicle_id', vehicleId!)
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!vehicleId,
  });

  const switchTab = (tab: string) => {
    setSearchParams({ tab });
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-96 rounded-xl mt-4" /></div>;
  if (!vehicle) return <div className="p-6 text-center text-muted-foreground">Vehicle not found</div>;

  const recallCount = (recalls as any[])?.length || 0;
  const upcomingMaintenance = recentMaintenance?.filter(m => {
    if (!m.next_due_date) return false;
    const due = new Date(m.next_due_date);
    const daysUntil = (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 60 && daysUntil > -30;
  }) || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <button onClick={() => navigate('/garage')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Garage
      </button>

      {/* Vehicle Header */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}</h1>
              {vehicle.nickname && <p className="text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {vehicle.engine && <Badge variant="secondary">{vehicle.engine}</Badge>}
                {vehicle.transmission && <Badge variant="secondary">{vehicle.transmission}</Badge>}
                {vehicle.drivetrain && <Badge variant="secondary">{vehicle.drivetrain}</Badge>}
                {vehicle.mileage && <Badge variant="outline">{vehicle.mileage.toLocaleString()} mi</Badge>}
              </div>
            </div>
            <Button onClick={() => openRatchetPanel()}>
              <MessageCircle className="h-4 w-4 mr-2" /> Ask Ratchet
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={defaultTab} onValueChange={switchTab}>
        <TabsList className="w-full overflow-x-auto overflow-y-hidden flex-nowrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="blueprint"><Grid3X3 className="h-3.5 w-3.5 mr-1" />Blueprint</TabsTrigger>
          <TabsTrigger value="diagnose" data-tab-value="diagnose"><Search className="h-3.5 w-3.5 mr-1" />Diagnose</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="repairs">Repairs</TabsTrigger>
          <TabsTrigger value="docs"><BookOpen className="h-3.5 w-3.5 mr-1" />Docs</TabsTrigger>
          <TabsTrigger value="chats"><MessageCircle className="h-3.5 w-3.5 mr-1" />Chats</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Quick Status Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => switchTab('projects')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Wrench className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Active Projects</span>
                </div>
                <p className="text-2xl font-bold">{activeProjects?.length || 0}</p>
                {activeProjects && activeProjects.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{activeProjects[0].title}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">DIY Savings</span>
                </div>
                <p className="text-2xl font-bold text-green-500">
                  ${repairStats?.savings ? repairStats.savings.toLocaleString() : '0'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{repairStats?.count || 0} repairs logged</p>
              </CardContent>
            </Card>

            <Card className={activeDtcs && activeDtcs.length > 0 ? 'border-amber-500/40' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Active Codes</span>
                </div>
                <p className="text-2xl font-bold">{activeDtcs?.length || 0}</p>
                {activeDtcs && activeDtcs.length > 0 && (
                  <p className="text-xs text-amber-400 mt-1 truncate">{activeDtcs[0].code}: {activeDtcs[0].description}</p>
                )}
              </CardContent>
            </Card>

            <Card className={recallCount > 0 ? 'border-destructive/40' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Recalls</span>
                </div>
                <p className="text-2xl font-bold">{recallCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {recallCount === 0 ? 'All clear' : `${recallCount} active recall${recallCount > 1 ? 's' : ''}`}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Active Projects */}
          {activeProjects && activeProjects.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Active Projects</h2>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => switchTab('projects')}>
                  View all <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="space-y-2">
                {activeProjects.slice(0, 3).map(p => (
                  <Card key={p.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/garage/${vehicleId}/projects/${p.id}`)}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Wrench className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{p.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{{ active: 'Active', planning: 'Planning', paused: 'Paused' }[p.status] ?? p.status}</Badge>
                            {p.difficulty && <Badge variant="secondary" className="text-xs">{p.difficulty}</Badge>}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Maintenance */}
          {upcomingMaintenance.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Upcoming Maintenance</h2>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => switchTab('maintenance')}>
                  View all <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="space-y-2">
                {upcomingMaintenance.map(m => {
                  const dueDate = m.next_due_date ? new Date(m.next_due_date) : null;
                  const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                  const isOverdue = daysUntil !== null && daysUntil < 0;
                  return (
                    <Card key={m.id} className={isOverdue ? 'border-destructive/40' : 'border-amber-500/20'}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CalendarDays className={`h-4 w-4 ${isOverdue ? 'text-destructive' : 'text-amber-500'}`} />
                          <div>
                            <p className="font-medium text-sm">{m.service}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isOverdue ? `Overdue by ${Math.abs(daysUntil!)} days` : `Due in ${daysUntil} days`}
                              {m.next_due_mileage && ` · ${m.next_due_mileage.toLocaleString()} mi`}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recalls — compact, only if any exist */}
          {recallCount > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Recalls ({recallCount})
              </h2>
              <div className="space-y-2">
                {(recalls as any[]).slice(0, 3).map((r: any, i: number) => (
                  <Card key={i} className="border-destructive/20">
                    <CardContent className="p-3 flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{r.Component}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.Summary}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {recallCount > 3 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">+ {recallCount - 3} more recalls</p>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Specs */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Vehicle Specs</h2>
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                  {[
                    ['Year', vehicle.year],
                    ['Make', vehicle.make],
                    ['Model', vehicle.model],
                    ['Trim', vehicle.trim],
                    ['Engine', vehicle.engine],
                    ['Transmission', vehicle.transmission],
                    ['Drivetrain', vehicle.drivetrain],
                    ['Body Style', vehicle.body_style],
                    ['VIN', vehicle.vin],
                    ['Color', vehicle.color],
                    ['Mileage', vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : null],
                    ['License Plate', vehicle.license_plate],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="blueprint">
          <BlueprintTab vehicleId={vehicleId!} vehicle={vehicle} />
        </TabsContent>

        <TabsContent value="diagnose">
          <DiagnoseTab vehicleId={vehicleId!} vehicle={vehicle} />
        </TabsContent>

        <TabsContent value="projects">
          <ProjectsTab vehicleId={vehicleId!} vehicleName={vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`} />
        </TabsContent>

        <TabsContent value="maintenance">
          <MaintenanceTab vehicleId={vehicleId!} vehicleMileage={vehicle.mileage} />
        </TabsContent>

        <TabsContent value="repairs">
          <RepairsTab vehicleId={vehicleId!} />
        </TabsContent>

        <TabsContent value="docs">
          <DocsTab vehicleId={vehicleId!} vehicle={vehicle} />
        </TabsContent>

        <TabsContent value="chats">
          <ChatsTab vehicleId={vehicleId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
