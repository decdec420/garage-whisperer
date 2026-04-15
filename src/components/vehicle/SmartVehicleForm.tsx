import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChevronDown, Lock } from 'lucide-react';
import { getTrimOptions, getEngineOptions, getDrivetrainOptions, getTransmissionOptions } from '@/lib/vehicle-options';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

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

/** Combobox that allows both selection from a list AND free text entry */
function ComboboxField({
  value,
  onChange,
  options,
  placeholder,
  emptyText = 'No matches — type your own',
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // When user types in the search, also set the value for free-text entry
  const handleSearchChange = (s: string) => {
    setSearch(s);
  };

  const handleSelect = (selected: string) => {
    onChange(selected);
    setSearch('');
    setOpen(false);
  };

  // On blur of the search input, if user typed something not in list, use it
  const commitFreeText = () => {
    if (search && !options.some((o) => o.toLowerCase() === search.toLowerCase())) {
      onChange(search);
    }
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-popover px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
            {value || placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            ref={inputRef}
            placeholder={`Search or type custom...`}
            value={search}
            onValueChange={handleSearchChange}
            onBlur={commitFreeText}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && search) {
                e.preventDefault();
                onChange(search);
                setSearch('');
                setOpen(false);
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              <span className="text-xs text-muted-foreground">{emptyText}</span>
              {search && (
                <button
                  type="button"
                  className="mt-1 block w-full text-left text-xs text-primary hover:underline"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(search);
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  Use "{search}"
                </button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => handleSelect(opt)}
                  className="cursor-pointer"
                >
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


export default function SmartVehicleForm({ form, onChange, smartSuggest = true }: Props) {
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const set = useCallback((k: keyof VehicleFormData, v: string) => {
    onChange({ ...form, [k]: v });
  }, [form, onChange]);

  const trimOptions = getTrimOptions(form.make, form.model);
  const engineOptions = getEngineOptions(form.make, form.model, form.trim);
  const drivetrainOptions = getDrivetrainOptions(form.make, form.model);
  const transmissionOptions = getTransmissionOptions(form.make, form.model);

  // Progressive disclosure: which fields are "unlocked"
  const hasYear = !!form.year && form.year.length === 4;
  const hasMake = hasYear && !!form.make;
  const hasModel = hasMake && !!form.model;

  // Auto-select drivetrain/transmission when only one option
  useEffect(() => {
    if (hasModel && drivetrainOptions.length === 1 && form.drivetrain !== drivetrainOptions[0]) {
      onChange({ ...form, drivetrain: drivetrainOptions[0] });
    }
  }, [hasModel, drivetrainOptions, form.drivetrain]);

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

  const handleTrimChange = useCallback((trim: string) => {
    onChange({ ...form, trim, engine: '' });
  }, [form, onChange]);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* ── STEP 1: Year ── */}
      <div className="space-y-1 col-span-2">
        <Label className="text-xs">Year *</Label>
        {smartSuggest ? (
          <Select value={form.year} onValueChange={handleYearChange}>
            <SelectTrigger className="bg-popover h-11 text-base"><SelectValue placeholder="What year?" /></SelectTrigger>
            <SelectContent className="max-h-60">
              {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input value={form.year} onChange={(e) => set('year', e.target.value)} placeholder="2024" className="bg-popover" />
        )}
      </div>

      {/* ── STEP 2: Make ── */}
      <div className={cn("space-y-1 col-span-2 transition-opacity", !hasYear && "opacity-40 pointer-events-none")}>
        <Label className="text-xs">Make *</Label>
        {!hasYear ? (
          <div className="flex items-center gap-2 h-11 px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Select year first
          </div>
        ) : smartSuggest && makes.length > 0 ? (
          <div className="relative">
            <ComboboxField
              value={form.make}
              onChange={handleMakeChange}
              options={makes}
              placeholder={loadingMakes ? "Loading makes..." : "Search or select make"}
              emptyText="Not listed? Type your own"
            />
            {loadingMakes && <Loader2 className="absolute right-8 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="Ford" className="bg-popover" />
        )}
      </div>

      {/* ── STEP 3: Model ── */}
      <div className={cn("space-y-1 col-span-2 transition-opacity", !hasMake && "opacity-40 pointer-events-none")}>
        <Label className="text-xs">Model *</Label>
        {!hasMake ? (
          <div className="flex items-center gap-2 h-11 px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Select make first
          </div>
        ) : smartSuggest && models.length > 0 ? (
          <div className="relative">
            <ComboboxField
              value={form.model}
              onChange={handleModelSelect}
              options={models}
              placeholder={loadingModels ? "Loading models..." : "Search or select model"}
              emptyText="Not listed? Type your own"
            />
            {loadingModels && <Loader2 className="absolute right-8 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Mustang" className="bg-popover" />
        )}
      </div>

      {/* ── Once model is selected, show the detail fields ── */}
      {hasModel && (
        <>
          {/* Divider */}
          <div className="col-span-2 border-t border-border my-1" />
          <p className="col-span-2 text-xs text-muted-foreground -mb-1">Narrow it down — helps us pull the right manuals & specs</p>

          {/* Trim */}
          <div className="space-y-1">
            <Label className="text-xs">Trim</Label>
            {smartSuggest && trimOptions.length > 0 ? (
              <ComboboxField
                value={form.trim}
                onChange={handleTrimChange}
                options={trimOptions}
                placeholder="Select trim"
                emptyText="Not listed? Type your own"
              />
            ) : (
              <Input value={form.trim} onChange={(e) => set('trim', e.target.value)} placeholder="XLT" className="bg-popover" />
            )}
          </div>

          {/* Engine */}
          <div className="space-y-1">
            <Label className="text-xs">Engine</Label>
            {smartSuggest && engineOptions.length > 0 ? (
              <ComboboxField
                value={form.engine}
                onChange={(v) => set('engine', v)}
                options={engineOptions}
                placeholder="Select engine"
                emptyText="Not listed? Type your own"
              />
            ) : (
              <Input value={form.engine} onChange={(e) => set('engine', e.target.value)} placeholder="2.5L 4cyl" className="bg-popover" />
            )}
          </div>

          {/* Transmission */}
          <div className="space-y-1">
            <Label className="text-xs">Transmission</Label>
            {smartSuggest && transmissionOptions.length > 0 ? (
              <ComboboxField
                value={form.transmission}
                onChange={(v) => set('transmission', v)}
                options={transmissionOptions}
                placeholder="Select transmission"
                emptyText="Not listed? Type your own"
              />
            ) : (
              <Select value={form.transmission} onValueChange={(v) => set('transmission', v)}>
                <SelectTrigger className="bg-popover"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {['Automatic', 'Manual', 'CVT', 'DCT'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Drivetrain — REQUIRED */}
          <div className="space-y-1">
            <Label className="text-xs">Drivetrain *</Label>
            {drivetrainOptions.length === 1 ? (
              <div className="flex items-center h-9 px-3 rounded-md border border-primary/30 bg-primary/5 text-sm font-medium">
                {drivetrainOptions[0]}
                <span className="ml-auto text-xs text-muted-foreground">Auto-detected</span>
              </div>
            ) : (
              <Select value={form.drivetrain} onValueChange={(v) => set('drivetrain', v)}>
                <SelectTrigger className={cn("bg-popover", !form.drivetrain && "border-destructive/50")}>
                  <SelectValue placeholder="Required" />
                </SelectTrigger>
                <SelectContent>
                  {drivetrainOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Divider */}
          <div className="col-span-2 border-t border-border my-1" />

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
        </>
      )}
    </div>
  );
}
