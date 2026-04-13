import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getServiceTemplatesForVehicle } from '@/lib/service-schedules';

/**
 * When vehicles exist but have no service schedules,
 * auto-populate them with manufacturer-recommended intervals.
 * Runs once per vehicle (checks for existing schedules first).
 */
export function usePopulateServiceSchedules(vehicles: Array<{
  id: string;
  make: string;
  drivetrain?: string | null;
  mileage?: number | null;
  engine?: string | null;
}> | undefined) {
  useEffect(() => {
    if (!vehicles || vehicles.length === 0) return;

    const populate = async () => {
      for (const vehicle of vehicles) {
        // Check if schedules already exist
        const { count } = await supabase
          .from('vehicle_service_schedules')
          .select('id', { count: 'exact', head: true })
          .eq('vehicle_id', vehicle.id);

        if (count && count > 0) continue;

        const templates = getServiceTemplatesForVehicle(vehicle);
        const rows = templates.map(t => ({
          vehicle_id: vehicle.id,
          service_name: t.service_name,
          interval_miles: t.interval_miles,
          interval_months: t.interval_months,
          priority: t.priority,
          category: t.category,
          notes: t.notes || null,
        }));

        if (rows.length > 0) {
          await supabase.from('vehicle_service_schedules').insert(rows);
        }
      }
    };

    populate();
  }, [vehicles?.map(v => v.id).join(',')]); // Only re-run when vehicle IDs change
}
