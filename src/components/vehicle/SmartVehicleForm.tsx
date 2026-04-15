import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export interface VehicleFormData {
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

export const emptyForm: VehicleFormData = {
  year: '', make: '', model: '', trim: '', engine: '',
  transmission: '', drivetrain: '', body_style: '',
  nickname: '', mileage: '', color: '', vin: '',
};

interface Props {
  form: VehicleFormData;
  onChange: (form: VehicleFormData) => void;
  smartSuggest?: boolean;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 40 }, (_, i) => String(currentYear + 1 - i));

interface NHTSAResult {
  [key: string]: string | number | null;
}

async function fetchNHTSA(url: string): Promise<NHTSAResult[]> {
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json.Results ?? [];
  } catch {
    return [];
  }
}

// Use NHTSA VIN decode to get specs for a specific year/make/model by looking up
// known VIN patterns. We'll decode a "blank" VIN with just year/make/model to get
// available vehicle configurations.
async function fetchModelSpecs(year: string, make: string, model: string): Promise<{
  trims: string[];
  engines: string[];
  drivetrains: string[];
  bodyStyles: string[];
}> {
  // Strategy: Search for all VINs decoded for this make/model/year in NHTSA's database
  // by using the "DecodeVin" with partial WMI patterns for major manufacturers
  const makeUpper = make.toUpperCase();

  // Get WMI (World Manufacturer Identifier) codes for this make
  const wmiResults = await fetchNHTSA(
    `https://vpic.nhtsa.dot.gov/api/vehicles/GetWMIsForManufacturer/${encodeURIComponent(make)}?format=json`
  );

  const wmis = wmiResults
    .map(r => String(r.WMI ?? ''))
    .filter(w => w.length === 3)
    .slice(0, 5); // Limit to 5 WMIs to avoid too many requests

  if (wmis.length === 0) {
    return { trims: [], engines: [], drivetrains: [], bodyStyles: [] };
  }

  // For each WMI, try to decode a VIN pattern to get available specs
  // VIN format: WMI(3) + VDS(5) + check(1) + year(1) + plant(1) + seq(6)
  // We'll use the batch decode endpoint with model year
  const yearCode = getYearCode(parseInt(year));
  
  // Try decoding several VIN patterns with different body/engine codes
  const vinPatterns = wmis.flatMap(wmi => {
    // Generate a few VIN variations with common descriptor patterns
    return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L'].map(
      code => `${wmi}${code}${code}1${code}${yearCode}A000001`
    );
  });

  // Use batch decode (up to 50 VINs at once)
  const batchVins = vinPatterns.slice(0, 50).join(';');
  const batchResults = await fetchNHTSA(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/`
  ).catch(() => []);

  // Since batch POST is complex, let's use a simpler approach:
  // Decode a few common VIN patterns for this make
  const decodePromises = wmis.slice(0, 3).map(async (wmi) => {
    // Try several descriptor codes
    const codes = ['AA1A', 'BA2B', 'CB3C', 'DC4D', 'ED5E'];
    const results: NHTSAResult[] = [];
    
    for (const code of codes.slice(0, 2)) {
      const vin = `${wmi}${code}0${yearCode}A000001`;
      const decoded = await fetchNHTSA(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json&modelyear=${year}`
      );
      if (decoded.length > 0 && decoded[0].Make) {
        const r = decoded[0];
        // Only include if it matches our target make/model
        const decodedMake = String(r.Make ?? '').toUpperCase();
        const decodedModel = String(r.Model ?? '').toUpperCase();
        if (decodedMake === makeUpper || decodedModel.toUpperCase().includes(model.toUpperCase())) {
          results.push(r);
        }
      }
    }
    return results;
  });

  const allResults = (await Promise.all(decodePromises)).flat();

  const trims = new Set<string>();
  const engines = new Set<string>();
  const drivetrains = new Set<string>();
  const bodyStyles = new Set<string>();

  for (const r of allResults) {
    if (r.Trim && typeof r.Trim === 'string' && r.Trim !== 'Not Applicable') trims.add(r.Trim);
    const dispL = r.DisplacementL ? parseFloat(String(r.DisplacementL)) : null;
    const cyls = r.EngineCylinders ? String(r.EngineCylinders) : null;
    if (dispL && cyls) {
      engines.add(`${Math.round(dispL * 10) / 10}L ${cyls}cyl`);
    }
    if (r.DriveType && typeof r.DriveType === 'string' && r.DriveType !== 'Not Applicable') {
      drivetrains.add(r.DriveType);
    }
    if (r.BodyClass && typeof r.BodyClass === 'string' && r.BodyClass !== 'Not Applicable') {
      bodyStyles.add(r.BodyClass);
    }
  }

  return {
    trims: [...trims].sort(),
    engines: [...engines].sort(),
    drivetrains: [...drivetrains].sort(),
    bodyStyles: [...bodyStyles].sort(),
  };
}

function getYearCode(year: number): string {
  // NHTSA year codes: 2010=A, 2011=B, ..., 2039=9 etc
  const codes = '0123456789ABCDEFGHJKLMNPRSTVWXY';
  const base = 2000;
  const idx = (year - base) % 30;
  return codes[idx] ?? 'A';
}

import { getTrimOptions, getEngineOptions } from '@/lib/vehicle-options';

export default function SmartVehicleForm({ form, onChange, smartSuggest = true }: Props) {
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const set = useCallback((k: keyof VehicleFormData, v: string) => {
    onChange({ ...form, [k]: v });
  }, [form, onChange]);

  const trimOptions = getTrimOptions(form.make, form.model);
  const engineOptions = getEngineOptions(form.make, form.model);

  // Fetch makes when year changes
  useEffect(() => {
    if (!smartSuggest || !form.year || form.year.length !== 4) {
      setMakes([]);
      return;
    }
    let cancelled = false;
    setLoadingMakes(true);
    fetchNHTSA(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json`
    ).then((results) => {
      if (cancelled) return;
      const names = results
        .map((r) => String(r.MakeName ?? ''))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const unique = [...new Set(names.map((n) => n.toUpperCase()))].map(
        (n) => n.charAt(0) + n.slice(1).toLowerCase()
      );
      setMakes(unique);
      setLoadingMakes(false);
    });
    return () => { cancelled = true; };
  }, [form.year, smartSuggest]);

  // Fetch models when make changes
  useEffect(() => {
    if (!smartSuggest || !form.year || !form.make) {
      setModels([]);
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    fetchNHTSA(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(form.make)}/modelyear/${form.year}?format=json`
    ).then((results) => {
      if (cancelled) return;
      const names = results.map((r) => String(r.Model_Name ?? '')).filter(Boolean).sort();
      setModels([...new Set(names)]);
      setLoadingModels(false);
    });
    return () => { cancelled = true; };
  }, [form.year, form.make, smartSuggest]);

  const handleModelSelect = useCallback((model: string) => {
    onChange({ ...form, model, trim: '', engine: '', transmission: '', drivetrain: '', body_style: '' });
  }, [form, onChange]);

  const handleYearChange = useCallback((year: string) => {
    onChange({ ...form, year, make: '', model: '', trim: '', engine: '', transmission: '', drivetrain: '', body_style: '' });
  }, [form, onChange]);

  const handleMakeChange = useCallback((make: string) => {
    onChange({ ...form, make, model: '', trim: '', engine: '', transmission: '', drivetrain: '', body_style: '' });
  }, [form, onChange]);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Year */}
      <div className="space-y-1">
        <Label className="text-xs">Year *</Label>
        {smartSuggest ? (
          <Select value={form.year} onValueChange={handleYearChange}>
            <SelectTrigger className="bg-popover"><SelectValue placeholder="Select year" /></SelectTrigger>
            <SelectContent className="max-h-60">
              {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input value={form.year} onChange={(e) => set('year', e.target.value)} placeholder="2024" className="bg-popover" />
        )}
      </div>

      {/* Make */}
      <div className="space-y-1">
        <Label className="text-xs">Make *</Label>
        {smartSuggest && makes.length > 0 ? (
          <div className="relative">
            <Select value={form.make} onValueChange={handleMakeChange}>
              <SelectTrigger className="bg-popover">
                <SelectValue placeholder={loadingMakes ? "Loading..." : "Select make"} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {makes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            {loadingMakes && <Loader2 className="absolute right-8 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="Ford" className="bg-popover" />
        )}
      </div>

      {/* Model */}
      <div className="space-y-1">
        <Label className="text-xs">Model *</Label>
        {smartSuggest && models.length > 0 ? (
          <div className="relative">
            <Select value={form.model} onValueChange={handleModelSelect}>
              <SelectTrigger className="bg-popover">
                <SelectValue placeholder={loadingModels ? "Loading..." : "Select model"} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            {loadingModels && <Loader2 className="absolute right-8 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Transit Connect" className="bg-popover" />
        )}
      </div>

      {/* Trim */}
      <div className="space-y-1">
        <Label className="text-xs">Trim</Label>
        {smartSuggest && form.make && trimOptions.length > 0 ? (
          <Select value={form.trim} onValueChange={(v) => set('trim', v)}>
            <SelectTrigger className="bg-popover">
              <SelectValue placeholder="Select trim" />
            </SelectTrigger>
            <SelectContent>
              {trimOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input value={form.trim} onChange={(e) => set('trim', e.target.value)} placeholder="XLT" className="bg-popover" />
        )}
      </div>

      {/* Engine */}
      <div className="col-span-2 space-y-1">
        <Label className="text-xs">Engine</Label>
        {smartSuggest && form.make && engineOptions.length > 0 ? (
          <Select value={form.engine} onValueChange={(v) => set('engine', v)}>
            <SelectTrigger className="bg-popover">
              <SelectValue placeholder="Select engine" />
            </SelectTrigger>
            <SelectContent>
              {engineOptions.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input value={form.engine} onChange={(e) => set('engine', e.target.value)} placeholder="2.5L 4cyl" className="bg-popover" />
        )}
      </div>

      {/* Transmission */}
      <div className="space-y-1">
        <Label className="text-xs">Transmission</Label>
        <Select value={form.transmission} onValueChange={(v) => set('transmission', v)}>
          <SelectTrigger className="bg-popover"><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {['Automatic', 'Manual', 'CVT', 'DCT'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Drivetrain */}
      <div className="space-y-1">
        <Label className="text-xs">Drivetrain</Label>
        <Select value={form.drivetrain} onValueChange={(v) => set('drivetrain', v)}>
          <SelectTrigger className="bg-popover"><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {['FWD', 'RWD', 'AWD', '4WD'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Nickname */}
      <div className="space-y-1">
        <Label className="text-xs">Nickname</Label>
        <Input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="Daily Driver" className="bg-popover" />
      </div>

      {/* Mileage */}
      <div className="space-y-1">
        <Label className="text-xs">Mileage</Label>
        <Input
          value={form.mileage ? Number(form.mileage).toLocaleString() : ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            set('mileage', raw);
          }}
          placeholder="45,000"
          inputMode="numeric"
          className="bg-popover"
        />
      </div>

      {/* Color */}
      <div className="space-y-1">
        <Label className="text-xs">Color</Label>
        <Input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Oxford White" className="bg-popover" />
      </div>
    </div>
  );
}
