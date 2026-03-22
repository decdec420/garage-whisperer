import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VehicleForm {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  transmission: string;
  drivetrain: string;
  body_style: string;
  nickname: string;
  mileage: string;
  color: string;
  vin: string;
}

const empty: VehicleForm = { year: '', make: '', model: '', trim: '', engine: '', transmission: '', drivetrain: '', body_style: '', nickname: '', mileage: '', color: '', vin: '' };

export default function AddVehicleModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<VehicleForm>(empty);
  const [vinInput, setVinInput] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const [nhtsaData, setNhtsaData] = useState<any>(null);

  const set = (k: keyof VehicleForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

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
        engine: `${get('Displacement (L)')}L ${get('Engine Number of Cylinders')}cyl`,
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
      const { error } = await supabase.from('vehicles').insert({
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Vehicle added!');
      onOpenChange(false);
      setForm(empty);
      setVinInput('');
      setDecoded(false);
      setNhtsaData(null);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            {decoded && <VehicleFormFields form={form} set={set} />}
            {decoded && (
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Adding...' : 'Add to Garage'}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <VehicleFormFields form={form} set={set} />
            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Adding...' : 'Add to Garage'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function VehicleFormFields({ form, set }: { form: VehicleForm; set: (k: keyof VehicleForm, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Year *</Label>
        <Input value={form.year} onChange={(e) => set('year', e.target.value)} placeholder="2024" className="bg-popover" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Make *</Label>
        <Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="Honda" className="bg-popover" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Model *</Label>
        <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Accord" className="bg-popover" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Trim</Label>
        <Input value={form.trim} onChange={(e) => set('trim', e.target.value)} placeholder="EX-L" className="bg-popover" />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-xs">Engine</Label>
        <Input value={form.engine} onChange={(e) => set('engine', e.target.value)} placeholder="2.4L i-VTEC K24" className="bg-popover" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Transmission</Label>
        <Select value={form.transmission} onValueChange={(v) => set('transmission', v)}>
          <SelectTrigger className="bg-popover"><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {['Automatic', 'Manual', 'CVT', 'DCT'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Drivetrain</Label>
        <Select value={form.drivetrain} onValueChange={(v) => set('drivetrain', v)}>
          <SelectTrigger className="bg-popover"><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {['FWD', 'RWD', 'AWD', '4WD'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Nickname</Label>
        <Input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="Daily Driver" className="bg-popover" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Mileage</Label>
        <Input value={form.mileage} onChange={(e) => set('mileage', e.target.value)} placeholder="45000" type="number" className="bg-popover" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Color</Label>
        <Input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Crystal Black" className="bg-popover" />
      </div>
    </div>
  );
}
