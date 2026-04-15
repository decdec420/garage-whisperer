import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Car, MoreVertical, Trash2, Pencil } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AddVehicleModal from '@/components/AddVehicleModal';

function VehicleCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="skeleton-shimmer h-5 w-3/5 rounded-md" />
      <div className="skeleton-shimmer h-3.5 w-2/5 rounded-md" />
      <div className="skeleton-shimmer h-3 w-1/3 rounded-md" />
      <div className="flex gap-3 mt-4">
        <div className="skeleton-shimmer h-3 w-20 rounded-md" />
        <div className="skeleton-shimmer h-3 w-16 rounded-md" />
      </div>
      <div className="skeleton-shimmer h-9 w-full rounded-lg mt-4" />
    </div>
  );
}

export default function Garage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addVehicleModalOpen, setAddVehicleModalOpen } = useAppStore();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, year, make, model, mileage, nickname, color, engine, trim').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Manual cascade: delete child records before the vehicle
      // Get project IDs first for nested deletes
      const { data: projects } = await supabase.from('projects').select('id').eq('vehicle_id', id);
      const projectIds = (projects ?? []).map(p => p.id);

      if (projectIds.length > 0) {
        await Promise.all([
          supabase.from('project_steps').delete().in('project_id', projectIds),
          supabase.from('project_parts').delete().in('project_id', projectIds),
          supabase.from('project_tools').delete().in('project_id', projectIds),
          supabase.from('project_notes').delete().in('project_id', projectIds),
        ]);
        // Chat sessions linked to projects
        await supabase.from('chat_sessions').delete().in('project_id', projectIds);
        // Diagnosis feedback linked to projects
        await supabase.from('diagnosis_feedback').delete().in('project_id', projectIds);
      }

      // Delete vehicle-level children
      await Promise.all([
        supabase.from('projects').delete().eq('vehicle_id', id),
        supabase.from('diagnosis_sessions').delete().eq('vehicle_id', id),
        supabase.from('maintenance_logs').delete().eq('vehicle_id', id),
        supabase.from('repair_logs').delete().eq('vehicle_id', id),
        supabase.from('dtc_records').delete().eq('vehicle_id', id),
        supabase.from('vehicle_documents').delete().eq('vehicle_id', id),
        supabase.from('vehicle_service_schedules').delete().eq('vehicle_id', id),
        supabase.from('vehicle_projects').delete().eq('vehicle_id', id),
        supabase.from('chat_sessions').delete().eq('vehicle_id', id),
        supabase.from('ratchet_memory').delete().eq('vehicle_id', id),
      ]);

      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-list'] });
      toast.success('Vehicle removed');
    },
    onError: (e) => {
      console.error('Delete vehicle failed:', e);
      toast.error('Failed to delete vehicle');
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Garage</h1>
        <Button onClick={() => setAddVehicleModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Vehicle
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <VehicleCardSkeleton key={i} />)}
        </div>
      ) : !vehicles?.length ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Car className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Your garage is empty</h2>
          <p className="text-muted-foreground mb-4 max-w-sm">Add your first vehicle to get started.</p>
          <Button onClick={() => setAddVehicleModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Vehicle
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <Card key={v.id} className="border-border card-hover group relative cursor-pointer overflow-hidden"
              onClick={() => navigate(`/garage/${v.id}`)}
              style={{ borderLeftWidth: '3px', borderLeftColor: v.color || 'hsl(var(--primary))' }}
            >
              {/* Gradient top accent */}
              <div className="h-1 bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
              <CardContent className="p-5">
                {v.nickname && (
                  <span className="absolute top-4 right-12 text-xs bg-primary/15 text-primary px-2.5 py-0.5 rounded-full font-semibold border border-primary/20">
                    {v.nickname}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="absolute top-4 right-3 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={e => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/garage/${v.id}`); }}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: v.id, name: `${v.year} ${v.make} ${v.model}` }); }}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Car className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold mb-0.5">{v.year} {v.make} {v.model}</h3>
                    {v.trim && <p className="text-sm text-muted-foreground">{v.trim}</p>}
                    {v.engine && <p className="text-xs text-muted-foreground mt-0.5">{v.engine}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  {v.mileage && <span className="font-medium">{v.mileage.toLocaleString()} mi</span>}
                  {v.color && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 rounded-full border border-border shadow-sm" style={{ backgroundColor: v.color }} />
                      {v.color}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddVehicleModal open={addVehicleModalOpen} onOpenChange={setAddVehicleModalOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the vehicle and all associated data — projects, diagnoses, maintenance logs, and repair history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteTarget) { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); } }}>
              Delete Vehicle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
