import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageCircle, AlertTriangle, CheckCircle2, Grid3X3 } from 'lucide-react';
import MaintenanceTab from '@/components/vehicle/MaintenanceTab';
import RepairsTab from '@/components/vehicle/RepairsTab';
import ProjectsTab from '@/components/vehicle/ProjectsTab';
import BlueprintTab from '@/components/vehicle/BlueprintTab';

export default function VehicleDetail() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { openRatchetPanel } = useAppStore();

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', vehicleId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!vehicleId,
  });

  const { data: recalls, isLoading: recallsLoading } = useQuery({
    queryKey: ['recalls', vehicleId],
    queryFn: async () => {
      if (!vehicle) return [];
      // Check cached first
      if (vehicle.recall_data) return vehicle.recall_data as any[];
      const res = await fetch(`https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&modelYear=${vehicle.year}`);
      const json = await res.json();
      const results = json.results || [];
      // Cache
      await supabase.from('vehicles').update({ recall_data: results, last_recall_check: new Date().toISOString() }).eq('id', vehicleId!);
      return results;
    },
    enabled: !!vehicle,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-96 rounded-xl mt-4" /></div>;
  if (!vehicle) return <div className="p-6 text-center text-muted-foreground">Vehicle not found</div>;

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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="blueprint"><Grid3X3 className="h-3.5 w-3.5 mr-1" />Blueprint</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="repairs">Repairs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Recalls */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Recalls</h2>
            {recallsLoading ? (
              <Skeleton className="h-20 rounded-xl" />
            ) : !recalls?.length ? (
              <Card className="border-success/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="text-sm">No active recalls for this vehicle</span>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(recalls as any[]).slice(0, 5).map((r: any, i: number) => (
                  <Card key={i} className="border-destructive/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{r.Component}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.Summary}</p>
                          <p className="text-xs text-muted-foreground mt-1">NHTSA #{r.NHTSACampaignNumber}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Specs Grid */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Vehicle Specs</h2>
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
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

        <TabsContent value="projects">
          <ProjectsTab vehicleId={vehicleId!} vehicleName={vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`} />
        </TabsContent>

        <TabsContent value="maintenance">
          <MaintenanceTab vehicleId={vehicleId!} vehicleMileage={vehicle.mileage} />
        </TabsContent>

        <TabsContent value="repairs">
          <RepairsTab vehicleId={vehicleId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
