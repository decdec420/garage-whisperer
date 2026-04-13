import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithAuth } from '@/integrations/supabase/functions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import SmartVehicleForm, { emptyForm, type VehicleFormData } from '@/components/vehicle/SmartVehicleForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddVehicleModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { openRatchetPanel } = useAppStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<VehicleFormData>({ ...emptyForm });
  const [vinInput, setVinInput] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const [nhtsaData, setNhtsaData] = useState<any>(null);

  // Reset everything when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setForm({ ...emptyForm });
      setVinInput('');
      setDecoded(false);
      setNhtsaData(null);
    }
    onOpenChange(isOpen);
  };

  const decodeVin = async () => {
    if (vinInput.length !== 17) { toast.error('VIN must be 17 characters'); return; }
    setDecoding(true);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vinInput}?format=json`);
      const json = await res.json();
      const results = json.Results as { Variable: string; Value: string | null }[];
      const get = (v: string) => results.find((r) => r.Variable === v)?.Value || '';
      setForm({
        ...form,
        vin: vinInput,
        year: get('Model Year'),
        make: get('Make'),
        model: get('Model'),
        trim: get('Trim'),
        engine: (() => {
          const rawDisp = get('Displacement (L)');
          const cylCount = get('Engine Number of Cylinders');
          if (!rawDisp) return '';
          const STANDARD = [1.0,1.2,1.3,1.4,1.5,1.6,1.7,1.8,2.0,2.2,2.3,2.4,2.5,2.7,2.8,3.0,3.2,3.3,3.5,3.6,3.7,3.8,4.0,4.2,4.3,4.6,4.7,5.0,5.3,5.4,5.7,6.0,6.2,6.4,6.6,6.7,7.0,7.3];
          const parsed = parseFloat(rawDisp);
          const rounded = STANDARD.reduce((prev, cur) => Math.abs(cur - parsed) < Math.abs(prev - parsed) ? cur : prev);
          return `${rounded.toFixed(1)}L ${cylCount}cyl`;
        })(),
        transmission: get('Transmission Style'),
        drivetrain: get('Drive Type'),
        body_style: get('Body Class'),
      });
      setNhtsaData(json.Results);
      setDecoded(true);
      toast.success('VIN decoded successfully');
    } catch {
      toast.error('Failed to decode VIN');
    }
    setDecoding(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.year || !form.make || !form.model) throw new Error('Year, Make, and Model are required');
      const { data: inserted, error } = await supabase.from('vehicles').insert({
        user_id: user!.id,
        vin: form.vin || null,
        year: parseInt(form.year),
        make: form.make,
        model: form.model,
        trim: form.trim || null,
        engine: form.engine || null,
        transmission: form.transmission || null,
        drivetrain: form.drivetrain || null,
        body_style: form.body_style || null,
        nickname: form.nickname || null,
        mileage: form.mileage ? parseInt(form.mileage) : null,
        color: form.color || null,
        nhtsa_data: nhtsaData,
      }).select().single();
      if (error) throw error;
      return inserted;
    },
    onSuccess: (inserted) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-list'] });
      toast.success('Vehicle added!');
      handleOpenChange(false);

      invokeWithAuth('search-manuals', {
        vehicleId: inserted.id,
        year: inserted.year,
        make: inserted.make,
        model: inserted.model,
        trim: inserted.trim,
        userId: user!.id,
      }).then(() => {
        toast.success('Found manual references for your vehicle', { duration: 3000 });
      }).catch(() => {});

      setTimeout(() => {
        openRatchetPanel(
          `I just added my ${inserted.year} ${inserted.make} ${inserted.model}${inserted.trim ? ` ${inserted.trim}` : ''} to the garage! ` +
          `Please interview me to build a complete maintenance baseline for this vehicle. Ask me these one or two at a time:\n` +
          `1. Current mileage (exact or approximate)\n` +
          `2. When was the last oil change and at what mileage?\n` +
          `3. When were the last brake pads/rotors done?\n` +
          `4. Has the transmission fluid ever been changed? If so, when?\n` +
          `5. Coolant flush history?\n` +
          `6. Spark plugs — ever replaced?\n` +
          `7. Tire age and tread condition — when were they last replaced or rotated?\n` +
          `8. Any known issues, warning lights, or weird noises?\n` +
          `9. Any modifications or non-stock parts?\n` +
          `10. Is this a new purchase or have you owned it a while?\n\n` +
          `After I answer, use my responses to figure out what maintenance is overdue or coming up soon based on the manufacturer's recommended schedule for this vehicle. ` +
          `Then offer to log the services I've already done so my maintenance tracker is accurate from day one.`
        );
      }, 500);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Vehicle</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="vin" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="vin" className="flex-1">VIN Lookup</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="vin" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input placeholder="Enter 17-character VIN" value={vinInput} onChange={(e) => setVinInput(e.target.value.toUpperCase())} maxLength={17} className="bg-popover font-mono" />
              <Button onClick={decodeVin} disabled={decoding}>
                {decoding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Decode'}
              </Button>
            </div>
            {decoded && <SmartVehicleForm form={form} onChange={setForm} smartSuggest={false} />}
            {decoded && (
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Adding...' : 'Add to Garage'}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <SmartVehicleForm form={form} onChange={setForm} smartSuggest={true} />
            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Adding...' : 'Add to Garage'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
