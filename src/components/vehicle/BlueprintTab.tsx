import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import {
  Search, X, Plus, Minus, AlertTriangle, Clock,
  Box, ChevronRight, ChevronDown, Wrench, MessageCircle,
  Zap, Shield, Fuel, Disc, Cable, Sofa, Car as CarIcon, Loader2, BookOpen, ExternalLink
} from 'lucide-react';
import { componentToJobKeyword } from '@/lib/charm-url';

// ── Zone definitions with top-down car positions (percentages) ──
interface ZoneDefinition {
  id: string;
  name: string;
  icon: any;
  x: number; y: number; w: number; h: number; // percentages of car bounding box
  components: ComponentDef[];
}

interface ComponentDef {
  name: string;
  description: string;
  lifespan: string;
  symptoms: string[];
  diyCost: string;
  shopCost: string;
  difficulty: string;
  commonIssue?: boolean;
  issueNote?: string;
  relatedDtcs?: string[];
}

const ZONES: ZoneDefinition[] = [
  {
    id: 'engine', name: 'Engine Bay', icon: Zap,
    x: 25, y: 2, w: 50, h: 28,
    components: [
      { name: 'Engine Block (2.4L i-VTEC K24)', description: 'The main engine assembly — 2.4L inline-4 producing 177hp.', lifespan: '200,000+ mi', symptoms: ['Knocking', 'Oil consumption', 'Loss of power'], diyCost: '$2,500–$4,000', shopCost: '$4,500–$7,000', difficulty: 'Expert' },
      { name: 'VTC Actuator', description: 'Variable Timing Control actuator adjusts cam timing. Extremely common failure on K24 engines.', lifespan: '80,000–120,000 mi', symptoms: ['Rattling on cold start', 'Check engine light P2646/P2647', 'Rough idle when cold'], diyCost: '$80–$150', shopCost: '$300–$500', difficulty: 'Advanced', commonIssue: true, issueNote: 'Common failure on K24 engines after 100k miles', relatedDtcs: ['P2646', 'P2647'] },
      { name: 'Timing Chain + Tensioner', description: 'Drives camshaft timing from the crankshaft.', lifespan: '150,000–200,000 mi', symptoms: ['Rattling at startup', 'Timing codes', 'Engine misfires'], diyCost: '$150–$300', shopCost: '$800–$1,200', difficulty: 'Expert' },
      { name: 'Valve Cover + Gasket', description: 'Seals the top of the engine. Gasket deteriorates over time.', lifespan: '80,000–120,000 mi', symptoms: ['Oil leak on exhaust manifold', 'Burning oil smell', 'Oil on spark plugs'], diyCost: '$25–$50', shopCost: '$200–$350', difficulty: 'Intermediate', commonIssue: true, issueNote: 'Very common leak point on high-mileage K24s' },
      { name: 'Thermostat + Housing', description: 'Regulates engine coolant temperature.', lifespan: '100,000+ mi', symptoms: ['Overheating', 'Slow to warm up', 'Temp gauge fluctuation'], diyCost: '$20–$40', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'Water Pump', description: 'Circulates coolant through the engine and radiator.', lifespan: '90,000–120,000 mi', symptoms: ['Coolant leak', 'Overheating', 'Whining noise from front'], diyCost: '$50–$100', shopCost: '$400–$600', difficulty: 'Intermediate' },
      { name: 'Oil Pan + Drain Plug', description: 'Holds engine oil. Drain plug used for oil changes.', lifespan: 'Lifetime (gasket: 100k mi)', symptoms: ['Oil leak underneath', 'Low oil level'], diyCost: '$30–$60', shopCost: '$200–$350', difficulty: 'Intermediate' },
      { name: 'Alternator', description: 'Generates electricity to charge the battery and power electronics.', lifespan: '100,000–150,000 mi', symptoms: ['Dim lights', 'Battery not charging', 'Whining noise'], diyCost: '$150–$250', shopCost: '$400–$600', difficulty: 'Intermediate' },
      { name: 'Starter Motor', description: 'Electric motor that cranks the engine to start it.', lifespan: '100,000–150,000 mi', symptoms: ['Click but no crank', 'Intermittent starting', 'Grinding on start'], diyCost: '$100–$180', shopCost: '$350–$500', difficulty: 'Intermediate' },
      { name: 'Power Steering Pump', description: 'Provides hydraulic pressure for power steering assist.', lifespan: '100,000+ mi', symptoms: ['Whining when turning', 'Stiff steering', 'Power steering fluid leak'], diyCost: '$80–$150', shopCost: '$300–$500', difficulty: 'Intermediate' },
      { name: 'AC Compressor', description: 'Compresses refrigerant for the air conditioning system.', lifespan: '120,000+ mi', symptoms: ['No cold air', 'Clutch not engaging', 'Rattling from compressor'], diyCost: '$200–$350', shopCost: '$600–$900', difficulty: 'Advanced' },
      { name: 'Air Intake + Throttle Body', description: 'Controls airflow into the engine.', lifespan: '150,000+ mi (cleaning needed)', symptoms: ['Rough idle', 'Poor acceleration', 'Check engine light'], diyCost: '$15–$30 (cleaning)', shopCost: '$100–$200', difficulty: 'Beginner' },
      { name: 'Fuel Injectors (×4)', description: 'Spray precise amounts of fuel into each cylinder.', lifespan: '100,000+ mi', symptoms: ['Rough idle', 'Misfires', 'Poor fuel economy'], diyCost: '$100–$200', shopCost: '$300–$500', difficulty: 'Intermediate' },
      { name: 'Oxygen Sensor (Upstream)', description: 'Measures exhaust oxygen before the catalytic converter for fuel mixture.', lifespan: '80,000–100,000 mi', symptoms: ['Check engine P0131/P0135', 'Poor fuel economy', 'Rough idle'], diyCost: '$30–$80', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'VTEC Solenoid', description: 'Controls the VTEC valve timing system engagement.', lifespan: '100,000+ mi', symptoms: ['VTEC not engaging', 'Check engine light', 'Oil leak at solenoid'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Beginner' },
    ],
  },
  {
    id: 'transmission', name: 'Transmission / Drivetrain', icon: Zap,
    x: 38, y: 30, w: 24, h: 35,
    components: [
      { name: 'Automatic Transmission (5-speed)', description: 'Transfers power from engine to wheels through gear ratios.', lifespan: '150,000–200,000 mi', symptoms: ['Slipping gears', 'Hard shifts', 'Transmission fluid leak'], diyCost: '$2,000–$3,500 (rebuild)', shopCost: '$3,500–$5,500', difficulty: 'Expert' },
      { name: 'Transmission Fluid + Filter', description: 'Lubricates and cools transmission internals.', lifespan: '30,000–60,000 mi (fluid)', symptoms: ['Dark/burnt fluid', 'Shift issues', 'Overheating'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'CV Axles (Left + Right)', description: 'Transmit power from transmission to front wheels.', lifespan: '100,000–150,000 mi', symptoms: ['Clicking when turning', 'Vibration at speed', 'Grease leak from boot'], diyCost: '$60–$120 each', shopCost: '$250–$400 each', difficulty: 'Intermediate' },
      { name: 'Motor Mounts', description: 'Secure engine/transmission to the chassis, absorb vibration.', lifespan: '80,000–120,000 mi', symptoms: ['Excessive vibration', 'Clunking on acceleration', 'Engine movement visible'], diyCost: '$30–$80 each', shopCost: '$200–$400 each', difficulty: 'Intermediate', commonIssue: true, issueNote: 'Front and side mounts commonly fail on Accords' },
    ],
  },
  {
    id: 'front-susp-l', name: 'Front Suspension (Left)', icon: Disc,
    x: 2, y: 8, w: 22, h: 22,
    components: [
      { name: 'Strut Assembly', description: 'Combined shock absorber and spring supporting the front left corner.', lifespan: '80,000–100,000 mi', symptoms: ['Bouncy ride', 'Nose dive on braking', 'Clunking over bumps'], diyCost: '$80–$150', shopCost: '$300–$450', difficulty: 'Intermediate' },
      { name: 'Lower Control Arm + Bushing', description: 'Connects wheel hub to the chassis, allows suspension travel.', lifespan: '100,000+ mi', symptoms: ['Clunking over bumps', 'Uneven tire wear', 'Wandering steering'], diyCost: '$50–$100', shopCost: '$200–$350', difficulty: 'Intermediate' },
      { name: 'Stabilizer Bar Link', description: 'Connects sway bar to the strut to reduce body roll.', lifespan: '60,000–80,000 mi', symptoms: ['Rattling over bumps', 'Clunking in turns'], diyCost: '$15–$30', shopCost: '$100–$150', difficulty: 'Beginner' },
      { name: 'Wheel Bearing', description: 'Allows the wheel to spin freely on the hub.', lifespan: '100,000+ mi', symptoms: ['Humming noise at speed', 'Growling that changes with steering', 'Wheel play'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Advanced' },
    ],
  },
  {
    id: 'front-susp-r', name: 'Front Suspension (Right)', icon: Disc,
    x: 76, y: 8, w: 22, h: 22,
    components: [
      { name: 'Strut Assembly', description: 'Combined shock absorber and spring supporting the front right corner.', lifespan: '80,000–100,000 mi', symptoms: ['Bouncy ride', 'Nose dive on braking', 'Clunking over bumps'], diyCost: '$80–$150', shopCost: '$300–$450', difficulty: 'Intermediate' },
      { name: 'Lower Control Arm + Bushing', description: 'Connects wheel hub to the chassis.', lifespan: '100,000+ mi', symptoms: ['Clunking', 'Uneven tire wear'], diyCost: '$50–$100', shopCost: '$200–$350', difficulty: 'Intermediate' },
      { name: 'Stabilizer Bar Link', description: 'Connects sway bar to strut.', lifespan: '60,000–80,000 mi', symptoms: ['Rattling over bumps'], diyCost: '$15–$30', shopCost: '$100–$150', difficulty: 'Beginner' },
      { name: 'Wheel Bearing', description: 'Allows wheel to spin freely.', lifespan: '100,000+ mi', symptoms: ['Humming noise at speed'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Advanced' },
    ],
  },
  {
    id: 'exhaust', name: 'Exhaust System', icon: Zap,
    x: 40, y: 20, w: 20, h: 75,
    components: [
      { name: 'Exhaust Manifold', description: 'Collects exhaust gases from all 4 cylinders.', lifespan: '150,000+ mi', symptoms: ['Exhaust leak ticking', 'Smell in cabin'], diyCost: '$80–$150', shopCost: '$300–$500', difficulty: 'Advanced' },
      { name: 'Catalytic Converter (Upstream)', description: 'Primary catalyst reducing emissions.', lifespan: '100,000–150,000 mi', symptoms: ['Check engine P0420', 'Rotten egg smell', 'Reduced power'], diyCost: '$150–$400', shopCost: '$500–$1,200', difficulty: 'Advanced' },
      { name: 'Catalytic Converter (Downstream)', description: 'Secondary catalyst — very common failure on 8th gen Accords.', lifespan: '80,000–120,000 mi', symptoms: ['P0420 code', 'Failed emissions', 'Sulfur smell'], diyCost: '$100–$300', shopCost: '$400–$900', difficulty: 'Intermediate', commonIssue: true, issueNote: 'Extremely common failure on 2008-2012 Accords', relatedDtcs: ['P0420'] },
      { name: 'Oxygen Sensor (Downstream)', description: 'Monitors catalytic converter efficiency.', lifespan: '80,000–100,000 mi', symptoms: ['P0136/P0141', 'Poor fuel economy'], diyCost: '$25–$60', shopCost: '$120–$200', difficulty: 'Beginner' },
      { name: 'Flex Pipe', description: 'Flexible exhaust joint allowing engine movement.', lifespan: '100,000+ mi', symptoms: ['Exhaust leak', 'Loud exhaust'], diyCost: '$40–$80', shopCost: '$150–$300', difficulty: 'Intermediate' },
      { name: 'Muffler', description: 'Reduces exhaust noise.', lifespan: '80,000–120,000 mi', symptoms: ['Loud exhaust', 'Rattling', 'Rust holes'], diyCost: '$50–$120', shopCost: '$150–$300', difficulty: 'Beginner' },
      { name: 'Exhaust Hangers', description: 'Rubber mounts securing the exhaust to the undercarriage.', lifespan: '80,000+ mi', symptoms: ['Exhaust rattling', 'Dragging exhaust'], diyCost: '$5–$15 each', shopCost: '$50–$100', difficulty: 'Beginner' },
    ],
  },
  {
    id: 'brakes-fl', name: 'Brake (Front Left)', icon: Disc,
    x: 2, y: 2, w: 12, h: 12,
    components: [
      { name: 'Brake Pads', description: 'Friction material that presses against rotor.', lifespan: '30,000–50,000 mi', symptoms: ['Squealing', 'Grinding', 'Longer stopping distance'], diyCost: '$20–$50', shopCost: '$100–$200', difficulty: 'Beginner' },
      { name: 'Brake Rotor', description: 'Disc that pads clamp against.', lifespan: '50,000–70,000 mi', symptoms: ['Pulsating pedal', 'Scoring visible'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'Brake Caliper', description: 'Hydraulic clamp housing the pads.', lifespan: '100,000+ mi', symptoms: ['Pulling to one side', 'Uneven pad wear'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Intermediate' },
    ],
  },
  {
    id: 'brakes-fr', name: 'Brake (Front Right)', icon: Disc,
    x: 86, y: 2, w: 12, h: 12,
    components: [
      { name: 'Brake Pads', description: 'Friction material.', lifespan: '30,000–50,000 mi', symptoms: ['Squealing', 'Grinding'], diyCost: '$20–$50', shopCost: '$100–$200', difficulty: 'Beginner' },
      { name: 'Brake Rotor', description: 'Disc surface.', lifespan: '50,000–70,000 mi', symptoms: ['Pulsating pedal'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Beginner' },
    ],
  },
  {
    id: 'brakes-rl', name: 'Brake (Rear Left)', icon: Disc,
    x: 2, y: 82, w: 12, h: 12,
    components: [
      { name: 'Brake Pads (Rear)', description: 'Rear friction material — thinner than front.', lifespan: '40,000–60,000 mi', symptoms: ['Squealing', 'Reduced braking'], diyCost: '$20–$40', shopCost: '$100–$180', difficulty: 'Beginner' },
      { name: 'Brake Rotor (Rear)', description: 'Rear disc.', lifespan: '60,000–80,000 mi', symptoms: ['Pulsating'], diyCost: '$25–$50', shopCost: '$120–$200', difficulty: 'Beginner' },
    ],
  },
  {
    id: 'brakes-rr', name: 'Brake (Rear Right)', icon: Disc,
    x: 86, y: 82, w: 12, h: 12,
    components: [
      { name: 'Brake Pads (Rear)', description: 'Rear friction material.', lifespan: '40,000–60,000 mi', symptoms: ['Squealing'], diyCost: '$20–$40', shopCost: '$100–$180', difficulty: 'Beginner' },
      { name: 'Brake Rotor (Rear)', description: 'Rear disc.', lifespan: '60,000–80,000 mi', symptoms: ['Pulsating'], diyCost: '$25–$50', shopCost: '$120–$200', difficulty: 'Beginner' },
    ],
  },
  {
    id: 'electrical', name: 'Electrical / Fuse Box', icon: Cable,
    x: 5, y: 20, w: 18, h: 15,
    components: [
      { name: 'Fuse Box (Under-hood)', description: 'Houses fuses and relays for engine bay components.', lifespan: 'Lifetime', symptoms: ['Blown fuses', 'Intermittent electrical issues'], diyCost: '$1–$5 per fuse', shopCost: '$50–$100', difficulty: 'Beginner' },
      { name: 'Battery', description: '12V lead-acid battery.', lifespan: '3–5 years', symptoms: ['Slow cranking', 'No start', 'Dim lights'], diyCost: '$80–$150', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'Wiring Harness', description: 'Main electrical wiring connecting all systems.', lifespan: 'Lifetime', symptoms: ['Intermittent issues', 'Rodent damage'], diyCost: 'Varies', shopCost: '$500+', difficulty: 'Expert' },
    ],
  },
  {
    id: 'fuel', name: 'Fuel System', icon: Fuel,
    x: 70, y: 60, w: 25, h: 25,
    components: [
      { name: 'Fuel Tank', description: '18.5-gallon fuel tank.', lifespan: 'Lifetime', symptoms: ['Fuel smell', 'Leaking'], diyCost: '$200–$400', shopCost: '$500–$800', difficulty: 'Advanced' },
      { name: 'Fuel Pump', description: 'Electric pump inside the tank that pressurizes fuel.', lifespan: '100,000+ mi', symptoms: ['No start', 'Sputtering at high speed', 'Whining from rear'], diyCost: '$80–$150', shopCost: '$400–$600', difficulty: 'Intermediate' },
      { name: 'Fuel Filter', description: 'Filters contaminants from fuel (integrated with pump on this model).', lifespan: '100,000+ mi', symptoms: ['Hesitation', 'Hard starting'], diyCost: '$20–$40', shopCost: '$100–$200', difficulty: 'Intermediate' },
    ],
  },
  {
    id: 'cabin', name: 'Cabin / Interior', icon: Sofa,
    x: 22, y: 35, w: 56, h: 30,
    components: [
      { name: 'Cabin Air Filter', description: 'Filters air entering the HVAC system.', lifespan: '15,000–20,000 mi', symptoms: ['Musty smell', 'Weak airflow', 'Foggy windows'], diyCost: '$10–$20', shopCost: '$40–$80', difficulty: 'Beginner' },
      { name: 'Blower Motor', description: 'Fan that pushes air through the vents.', lifespan: '100,000+ mi', symptoms: ['No airflow', 'Squealing from dash', 'Intermittent fan'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Intermediate' },
      { name: 'Window Regulator', description: 'Mechanism that raises and lowers the power window.', lifespan: '100,000+ mi', symptoms: ['Window won\'t go up/down', 'Grinding noise', 'Slow movement'], diyCost: '$30–$60', shopCost: '$200–$350', difficulty: 'Intermediate' },
    ],
  },
  {
    id: 'rear-susp-l', name: 'Rear Suspension (Left)', icon: Disc,
    x: 2, y: 72, w: 22, h: 18,
    components: [
      { name: 'Shock Absorber', description: 'Dampens rear suspension movement.', lifespan: '80,000–100,000 mi', symptoms: ['Bouncy rear end', 'Poor handling', 'Bottoming out'], diyCost: '$40–$80', shopCost: '$200–$300', difficulty: 'Intermediate' },
      { name: 'Coil Spring', description: 'Supports vehicle weight at the rear.', lifespan: '150,000+ mi', symptoms: ['Sagging rear', 'Uneven ride height'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Advanced' },
    ],
  },
  {
    id: 'rear-susp-r', name: 'Rear Suspension (Right)', icon: Disc,
    x: 76, y: 72, w: 22, h: 18,
    components: [
      { name: 'Shock Absorber', description: 'Dampens rear suspension.', lifespan: '80,000–100,000 mi', symptoms: ['Bouncy rear', 'Poor handling'], diyCost: '$40–$80', shopCost: '$200–$300', difficulty: 'Intermediate' },
      { name: 'Coil Spring', description: 'Supports rear weight.', lifespan: '150,000+ mi', symptoms: ['Sagging'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Advanced' },
    ],
  },
  {
    id: 'body', name: 'Body Panels', icon: CarIcon,
    x: 0, y: 0, w: 100, h: 100,
    components: [
      { name: 'Hood', description: 'Front body panel covering engine bay.', lifespan: 'Lifetime', symptoms: ['Rust', 'Dents', 'Latch issues'], diyCost: '$200–$500', shopCost: '$500–$1,000+', difficulty: 'Intermediate' },
      { name: 'Fenders', description: 'Side panels above the front wheels.', lifespan: 'Lifetime', symptoms: ['Rust', 'Collision damage'], diyCost: '$100–$300', shopCost: '$400–$800', difficulty: 'Intermediate' },
      { name: 'Door Panels', description: 'Side body panels with window mechanisms.', lifespan: 'Lifetime', symptoms: ['Rust', 'Dents', 'Seal leaks'], diyCost: '$200–$500', shopCost: '$500–$1,200', difficulty: 'Intermediate' },
    ],
  },
];

const DIFF_COLORS: Record<string, string> = {
  Beginner: 'bg-success/20 text-success',
  Intermediate: 'bg-primary/20 text-primary',
  Advanced: 'bg-warning/20 text-warning',
  Expert: 'bg-destructive/20 text-destructive',
};

interface BlueprintTabProps {
  vehicleId: string;
  vehicle: any;
}

export default function BlueprintTab({ vehicleId, vehicle }: BlueprintTabProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { openRatchetPanel } = useAppStore();
  const [selectedZone, setSelectedZone] = useState<ZoneDefinition | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [generatingComponent, setGeneratingComponent] = useState<string | null>(null);
  const [charmSheet, setCharmSheet] = useState<{ compName: string; data: any } | null>(null);
  const [loadingCharm, setLoadingCharm] = useState<string | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const engineLabel = vehicle.engine || 'K24';

  // Fetch DTCs for issue overlay
  const { data: dtcRecords = [] } = useQuery({
    queryKey: ['dtc-records', vehicleId],
    queryFn: async () => {
      const { data } = await supabase.from('dtc_records').select('*').eq('vehicle_id', vehicleId).eq('status', 'active');
      return data || [];
    },
  });

  // Fetch recent repairs/maintenance for "recent work" overlay
  const { data: recentMaintenance = [] } = useQuery({
    queryKey: ['recent-maintenance', vehicleId],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data } = await supabase.from('maintenance_logs').select('*').eq('vehicle_id', vehicleId).gte('date', sixMonthsAgo.toISOString().split('T')[0]);
      return data || [];
    },
  });

  const { data: recentRepairs = [] } = useQuery({
    queryKey: ['recent-repairs', vehicleId],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data } = await supabase.from('repair_logs').select('*').eq('vehicle_id', vehicleId).gte('date', sixMonthsAgo.toISOString().split('T')[0]);
      return data || [];
    },
  });

  // Search filtering
  const searchLower = search.toLowerCase();
  const matchingZoneIds = useMemo(() => {
    if (!searchLower) return new Set<string>();
    const ids = new Set<string>();
    ZONES.forEach(z => {
      if (z.name.toLowerCase().includes(searchLower)) ids.add(z.id);
      z.components.forEach(c => {
        if (c.name.toLowerCase().includes(searchLower) || c.description.toLowerCase().includes(searchLower)) {
          ids.add(z.id);
        }
      });
    });
    return ids;
  }, [searchLower]);

  // Zone issue detection
  const zoneHasIssue = useCallback((zoneId: string) => {
    const zone = ZONES.find(z => z.id === zoneId);
    if (!zone) return false;
    return zone.components.some(c =>
      c.relatedDtcs?.some(dtc => dtcRecords.some((r: any) => r.code === dtc)) || c.commonIssue
    );
  }, [dtcRecords]);

  const hasRecentWork = recentMaintenance.length > 0 || recentRepairs.length > 0;

  // Renderable zones (exclude body which is background)
  const renderZones = ZONES.filter(z => z.id !== 'body');

  return (
    <div className="mt-4 space-y-4">
      {/* Phase banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-2.5 flex items-center gap-2">
        <Box className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">Phase 1 — Interactive schematic. Full 3D model coming soon.</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a part or system..."
          className="pl-10 h-11 bg-card border-border rounded-xl"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Overlay toggles */}
      <div className="flex items-center gap-2">
        <Button variant={showIssues ? 'default' : 'outline'} size="sm"
          className={showIssues ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          onClick={() => setShowIssues(!showIssues)}>
          <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Issues
        </Button>
        <Button variant={showRecent ? 'default' : 'outline'} size="sm"
          className={showRecent ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
          onClick={() => setShowRecent(!showRecent)}>
          <Clock className="h-3.5 w-3.5 mr-1" /> Recent Work
        </Button>
      </div>

      {/* Diagram canvas */}
      <div className="relative rounded-xl border border-border overflow-hidden"
        style={{
          background: '#0a0a0a',
          backgroundImage: 'radial-gradient(circle, #1a1a1a 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          minHeight: isMobile ? 350 : 500,
        }}>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm"
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* SVG container */}
        <div ref={svgContainerRef} className="w-full h-full flex items-center justify-center overflow-auto p-6"
          style={{ minHeight: isMobile ? 350 : 500 }}>
          <svg
            viewBox="0 0 400 600"
            className="transition-transform duration-200"
            style={{ width: `${Math.min(380, 300) * zoom}px`, height: `${450 * zoom}px`, maxWidth: '100%' }}
          >
            {/* Car body outline - top-down sedan */}
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Car body shape */}
            <path
              d="M 100,30 Q 100,15 120,10 L 280,10 Q 300,15 300,30 
                 L 310,60 Q 315,70 315,80 L 318,200 
                 Q 320,220 318,240 L 315,440 Q 315,480 310,500 
                 L 300,540 Q 300,560 280,565 L 120,565 
                 Q 100,560 100,540 L 90,500 Q 85,480 85,440 
                 L 82,240 Q 80,220 82,200 L 85,80 
                 Q 85,70 90,60 Z"
              fill="none"
              stroke="#3f3f46"
              strokeWidth="1.5"
            />

            {/* Windshield */}
            <path d="M 115,120 L 130,80 L 270,80 L 285,120 Z" fill="none" stroke="#3f3f46" strokeWidth="1" />

            {/* Rear window */}
            <path d="M 120,420 L 130,460 L 270,460 L 280,420 Z" fill="none" stroke="#3f3f46" strokeWidth="1" />

            {/* Side mirrors */}
            <ellipse cx="72" cy="140" rx="10" ry="6" fill="none" stroke="#3f3f46" strokeWidth="1" />
            <ellipse cx="328" cy="140" rx="10" ry="6" fill="none" stroke="#3f3f46" strokeWidth="1" />

            {/* Wheels */}
            {[[75, 95], [325, 95], [75, 490], [325, 490]].map(([cx, cy], i) => (
              <g key={i}>
                <rect x={cx - 18} y={cy - 28} width="36" height="56" rx="6" fill="none" stroke="#3f3f46" strokeWidth="1.5" />
                <circle cx={cx} cy={cy} r="14" fill="none" stroke="#27272a" strokeWidth="1" />
              </g>
            ))}

            {/* Door lines */}
            <line x1="85" y1="200" x2="315" y2="200" stroke="#27272a" strokeWidth="0.5" />
            <line x1="85" y1="380" x2="315" y2="380" stroke="#27272a" strokeWidth="0.5" />

            {/* Headlights */}
            <ellipse cx="120" cy="30" rx="15" ry="8" fill="none" stroke="#3f3f46" strokeWidth="1" />
            <ellipse cx="280" cy="30" rx="15" ry="8" fill="none" stroke="#3f3f46" strokeWidth="1" />

            {/* Taillights */}
            <rect x="105" y="555" width="30" height="8" rx="3" fill="none" stroke="#3f3f46" strokeWidth="1" />
            <rect x="265" y="555" width="30" height="8" rx="3" fill="none" stroke="#3f3f46" strokeWidth="1" />

            {/* Center exhaust line */}
            <line x1="200" y1="50" x2="200" y2="575" stroke="#1a1a1a" strokeWidth="1" strokeDasharray="4 4" />

            {/* Clickable zones */}
            {renderZones.map(zone => {
              const isHovered = hoveredZone === zone.id;
              const isSelected = selectedZone?.id === zone.id;
              const isSearchMatch = searchLower && matchingZoneIds.has(zone.id);
              const hasIssue = showIssues && zoneHasIssue(zone.id);

              // Map percentage coords to SVG viewBox
              const zx = (zone.x / 100) * 400;
              const zy = (zone.y / 100) * 600;
              const zw = (zone.w / 100) * 400;
              const zh = (zone.h / 100) * 600;

              let fill = 'transparent';
              let stroke = 'transparent';
              let strokeW = 0;

              if (isSelected) {
                fill = 'rgba(249,115,22,0.15)';
                stroke = '#f97316';
                strokeW = 2;
              } else if (isSearchMatch) {
                fill = 'rgba(249,115,22,0.12)';
                stroke = 'rgba(249,115,22,0.5)';
                strokeW = 1.5;
              } else if (hasIssue) {
                fill = 'rgba(239,68,68,0.1)';
                stroke = 'rgba(239,68,68,0.4)';
                strokeW = 1;
              } else if (showRecent && hasRecentWork) {
                fill = 'rgba(59,130,246,0.06)';
              } else if (isHovered) {
                fill = 'rgba(249,115,22,0.08)';
                stroke = 'rgba(249,115,22,0.4)';
                strokeW = 1;
              }

              return (
                <g key={zone.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  onClick={() => setSelectedZone(zone)}>
                  <rect
                    x={zx} y={zy} width={zw} height={zh}
                    rx={4}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeW}
                    className="transition-all duration-150"
                  />
                  {/* Zone label */}
                  <text
                    x={zx + zw / 2}
                    y={zy + zh / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="select-none pointer-events-none"
                    fill={isSelected || isSearchMatch ? '#f97316' : isHovered ? '#f97316' : hasIssue ? '#ef4444' : '#52525b'}
                    fontSize={isSelected ? 10 : 9}
                    fontFamily="Inter, sans-serif"
                    fontWeight={isSelected ? 600 : 400}
                  >
                    {zone.name.length > 20 ? zone.name.slice(0, 18) + '…' : zone.name}
                  </text>
                  {/* Issue dot */}
                  {hasIssue && (
                    <circle cx={zx + zw - 6} cy={zy + 6} r={4} fill="#ef4444" className="animate-pulse" />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Zone Detail Panel */}
      {selectedZone && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSelectedZone(null)} />

          {/* Panel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl animate-slide-up flex flex-col"
            style={{ height: '75vh' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <selectedZone.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{selectedZone.name}</h3>
                  <p className="text-xs text-muted-foreground">{vehicleLabel} · {engineLabel}</p>
                </div>
              </div>
              <button onClick={() => setSelectedZone(null)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Component list — scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' as any }}>
              <div className="p-4 space-y-2">
                {selectedZone.components.map((comp, i) => {
                  const isExpanded = expandedComponent === `${selectedZone.id}-${i}`;
                  const compKey = `${selectedZone.id}-${i}`;
                  const hasDtc = comp.relatedDtcs?.some(dtc => dtcRecords.some((r: any) => r.code === dtc));

                  return (
                    <div key={compKey} className="rounded-xl border border-border bg-[#1a1a1a] overflow-hidden">
                      <button className="w-full p-4 flex items-center gap-3 text-left min-h-[56px]"
                        onClick={() => setExpandedComponent(isExpanded ? null : compKey)}>
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          hasDtc ? 'bg-destructive' : comp.commonIssue ? 'bg-warning' : 'bg-success'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{comp.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{comp.description}</p>
                        </div>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                          <p className="text-sm text-foreground/80">{comp.description}</p>

                          {comp.issueNote && (
                            <div className="rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
                              <p className="text-xs text-warning font-medium">⚠ {comp.issueNote}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-xs text-muted-foreground">Typical Lifespan</span>
                              <p className="text-foreground font-medium">{comp.lifespan}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Difficulty</span>
                              <Badge className={`text-xs ${DIFF_COLORS[comp.difficulty] || ''}`}>{comp.difficulty}</Badge>
                            </div>
                          </div>

                          <div>
                            <span className="text-xs text-muted-foreground">Common Failure Symptoms</span>
                            <ul className="mt-1 space-y-1">
                              {comp.symptoms.map((s, si) => (
                                <li key={si} className="text-sm text-foreground/80 flex items-center gap-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" /> {s}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-success/10 border border-success/20 px-3 py-2">
                              <span className="text-xs text-success">DIY Cost</span>
                              <p className="text-sm font-medium text-foreground">{comp.diyCost}</p>
                            </div>
                            <div className="rounded-lg bg-secondary px-3 py-2">
                              <span className="text-xs text-muted-foreground">Shop Cost</span>
                              <p className="text-sm font-medium text-foreground">{comp.shopCost}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 pt-1">
                            {generatingComponent === compKey ? (
                              <div className="space-y-2">
                                <Button size="sm" className="w-full bg-primary text-primary-foreground" disabled>
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Building your plan...
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">
                                  Ratchet is generating a project for {comp.name} on your {vehicleLabel}...
                                </p>
                              </div>
                            ) : (
                              <Button size="sm" className="w-full bg-primary text-primary-foreground"
                                onClick={async () => {
                                  setGeneratingComponent(compKey);
                                  try {
                                    // Infer action
                                    const action = comp.commonIssue
                                      ? 'Inspect and replace if needed'
                                      : 'Replace';
                                    const jobDescription = `${action} ${comp.name} on ${vehicleLabel}${vehicle.engine ? ` ${vehicle.engine}` : ''}`;

                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session) throw new Error('Not authenticated');

                                    const resp = await supabase.functions.invoke('generate-project', {
                                      body: { vehicleId, jobDescription },
                                    });

                                    if (resp.error) throw resp.error;
                                    const result = resp.data;
                                    if (result?.error) throw new Error(result.error);

                                    const projectId = result?.project?.id;
                                    if (!projectId) throw new Error('No project returned');

                                    toast.success(`Project created — Step-by-step plan ready for ${comp.name}`, { duration: 2000 });
                                    setSelectedZone(null);
                                    setTimeout(() => {
                                      navigate(`/garage/${vehicleId}/projects/${projectId}`);
                                    }, 500);
                                  } catch (err: any) {
                                    console.error('Project generation failed:', err);
                                    toast.error(err?.message || "Couldn't generate the plan right now. Try again?");
                                  } finally {
                                    setGeneratingComponent(null);
                                  }
                                }}>
                                <Wrench className="h-3.5 w-3.5 mr-1" /> Start Project
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="w-full border-primary/40 text-primary"
                              onClick={() => {
                                const symptomsText = comp.symptoms.length ? `Common failure symptoms listed: ${comp.symptoms.join(', ')}.` : '';
                                const mileageText = vehicle.mileage ? `My car has ${vehicle.mileage.toLocaleString()} miles.` : '';
                                setSelectedZone(null);
                                openRatchetPanel(
                                  `I'm looking at the ${comp.name} on my ${vehicleLabel} in the Blueprint. It shows: ${comp.description} ${symptomsText} ${mileageText} Should I replace this, and what should I know before starting?`
                                );
                              }}>
                              <MessageCircle className="h-3.5 w-3.5 mr-1" /> Ask Ratchet First
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Bottom fade gradient */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
          </div>
        </>
      )}
    </div>
  );
}
