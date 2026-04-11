import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithAuth } from '@/integrations/supabase/functions';
import { useAppStore } from '@/stores/app-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import {
  Search, X, Plus, Minus, AlertTriangle, Clock,
  ChevronRight, ChevronDown, Wrench, MessageCircle,
  Zap, Shield, Fuel, Disc, Cable, Sofa, Car as CarIcon, Loader2, BookOpen, ExternalLink,
  Layers, Activity,
} from 'lucide-react';
import { componentToJobKeyword } from '@/lib/charm-url';
import { isBlueprintSupported } from '@/lib/blueprint-support';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Fastener {
  x: number; y: number; // SVG viewBox coords (0–400, 0–600)
  type: 'bolt' | 'stud' | 'torque' | 'clip';
  spec?: string; // e.g. "M10×1.25"
  torque?: string; // e.g. "33 ft·lbs"
  label?: string;
}

type ZoneLayer = 'powertrain' | 'suspension' | 'electrical' | 'interior' | 'body';

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

interface ZoneDefinition {
  id: string;
  name: string;
  icon: any;
  layer: ZoneLayer;
  x: number; y: number; w: number; h: number; // percentages of viewBox
  components: ComponentDef[];
  fasteners?: Fastener[];
}

// ─── Zone Data ────────────────────────────────────────────────────────────────

const ZONES: ZoneDefinition[] = [
  {
    id: 'engine', name: 'Engine Bay', icon: Zap, layer: 'powertrain',
    x: 25, y: 2, w: 50, h: 28,
    fasteners: [
      // Valve cover bolts (K24 — 8 bolts)
      { x: 142, y: 28, type: 'torque', spec: 'M6', torque: '8.7 ft·lbs', label: 'Valve cover' },
      { x: 160, y: 26, type: 'torque', spec: 'M6', torque: '8.7 ft·lbs', label: 'Valve cover' },
      { x: 180, y: 25, type: 'torque', spec: 'M6', torque: '8.7 ft·lbs', label: 'Valve cover' },
      { x: 200, y: 25, type: 'torque', spec: 'M6', torque: '8.7 ft·lbs', label: 'Valve cover' },
      { x: 220, y: 25, type: 'torque', spec: 'M6', torque: '8.7 ft·lbs', label: 'Valve cover' },
      { x: 240, y: 26, type: 'torque', spec: 'M6', torque: '8.7 ft·lbs', label: 'Valve cover' },
      { x: 258, y: 28, type: 'torque', spec: 'M6', torque: '8.7 ft·lbs', label: 'Valve cover' },
      { x: 150, y: 62, type: 'torque', spec: 'M6', torque: '8.7 ft·lbs', label: 'Valve cover (rear)' },
      // Timing chain cover bolts (left side)
      { x: 115, y: 42, type: 'bolt', spec: 'M8', label: 'TC cover' },
      { x: 113, y: 62, type: 'bolt', spec: 'M8', label: 'TC cover' },
      { x: 113, y: 88, type: 'bolt', spec: 'M8', label: 'TC cover' },
      // Oil drain plug
      { x: 200, y: 155, type: 'torque', spec: 'M14×1.5', torque: '29 ft·lbs', label: 'Oil drain' },
      // VTEC solenoid
      { x: 262, y: 78, type: 'bolt', spec: 'M6', label: 'VTEC solenoid' },
      // Alternator bolts
      { x: 125, y: 110, type: 'torque', spec: 'M10', torque: '33 ft·lbs', label: 'Alternator pivot' },
      { x: 132, y: 130, type: 'bolt', spec: 'M8', label: 'Alternator adjust' },
    ],
    components: [
      { name: 'Engine Block (2.4L i-VTEC K24)', description: 'The main engine assembly — 2.4L inline-4 producing 177hp.', lifespan: '200,000+ mi', symptoms: ['Knocking', 'Oil consumption', 'Loss of power'], diyCost: '$2,500–$4,000', shopCost: '$4,500–$7,000', difficulty: 'Expert' },
      { name: 'VTC Actuator', description: 'Variable Timing Control actuator adjusts cam timing. Extremely common failure on K24 engines.', lifespan: '80,000–120,000 mi', symptoms: ['Rattling on cold start', 'Check engine light P2646/P2647', 'Rough idle when cold'], diyCost: '$80–$150', shopCost: '$300–$500', difficulty: 'Advanced', commonIssue: true, issueNote: 'Common failure on K24 engines after 100k miles', relatedDtcs: ['P2646', 'P2647'] },
      { name: 'Timing Chain + Tensioner', description: 'Drives camshaft timing from the crankshaft.', lifespan: '150,000–200,000 mi', symptoms: ['Rattling at startup', 'Timing codes', 'Engine misfires'], diyCost: '$150–$300', shopCost: '$800–$1,200', difficulty: 'Expert' },
      { name: 'Valve Cover + Gasket', description: 'Seals the top of the engine. Gasket deteriorates over time — very common oil leak on K24.', lifespan: '80,000–120,000 mi', symptoms: ['Oil leak on exhaust manifold', 'Burning oil smell', 'Oil on spark plugs'], diyCost: '$25–$50', shopCost: '$200–$350', difficulty: 'Intermediate', commonIssue: true, issueNote: 'Very common leak point on high-mileage K24s' },
      { name: 'Thermostat + Housing', description: 'Regulates engine coolant temperature.', lifespan: '100,000+ mi', symptoms: ['Overheating', 'Slow to warm up', 'Temp gauge fluctuation'], diyCost: '$20–$40', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'Water Pump', description: 'Circulates coolant through the engine and radiator.', lifespan: '90,000–120,000 mi', symptoms: ['Coolant leak', 'Overheating', 'Whining noise from front'], diyCost: '$50–$100', shopCost: '$400–$600', difficulty: 'Intermediate' },
      { name: 'Oil Pan + Drain Plug', description: 'Holds engine oil. Drain plug used for oil changes.', lifespan: 'Lifetime (gasket: 100k mi)', symptoms: ['Oil leak underneath', 'Low oil level'], diyCost: '$30–$60', shopCost: '$200–$350', difficulty: 'Intermediate' },
      { name: 'Alternator', description: 'Generates electricity to charge the battery and power electronics.', lifespan: '100,000–150,000 mi', symptoms: ['Dim lights', 'Battery not charging', 'Whining noise'], diyCost: '$150–$250', shopCost: '$400–$600', difficulty: 'Intermediate' },
      { name: 'Starter Motor', description: 'Electric motor that cranks the engine to start it.', lifespan: '100,000–150,000 mi', symptoms: ['Click but no crank', 'Intermittent starting', 'Grinding on start'], diyCost: '$100–$180', shopCost: '$350–$500', difficulty: 'Intermediate' },
      { name: 'Power Steering Pump', description: 'Provides hydraulic pressure for power steering assist.', lifespan: '100,000+ mi', symptoms: ['Whining when turning', 'Stiff steering', 'PS fluid leak'], diyCost: '$80–$150', shopCost: '$300–$500', difficulty: 'Intermediate' },
      { name: 'AC Compressor', description: 'Compresses refrigerant for the air conditioning system.', lifespan: '120,000+ mi', symptoms: ['No cold air', 'Clutch not engaging', 'Rattling from compressor'], diyCost: '$200–$350', shopCost: '$600–$900', difficulty: 'Advanced' },
      { name: 'Air Intake + Throttle Body', description: 'Controls airflow into the engine.', lifespan: '150,000+ mi', symptoms: ['Rough idle', 'Poor acceleration', 'Check engine light'], diyCost: '$15–$30 (cleaning)', shopCost: '$100–$200', difficulty: 'Beginner' },
      { name: 'Fuel Injectors (×4)', description: 'Spray precise amounts of fuel into each cylinder.', lifespan: '100,000+ mi', symptoms: ['Rough idle', 'Misfires', 'Poor fuel economy'], diyCost: '$100–$200', shopCost: '$300–$500', difficulty: 'Intermediate' },
      { name: 'Oxygen Sensor (Upstream)', description: 'Measures exhaust oxygen before the catalytic converter for fuel mixture.', lifespan: '80,000–100,000 mi', symptoms: ['Check engine P0131/P0135', 'Poor fuel economy', 'Rough idle'], diyCost: '$30–$80', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'VTEC Solenoid', description: 'Controls the VTEC valve timing system engagement.', lifespan: '100,000+ mi', symptoms: ['VTEC not engaging', 'Check engine light', 'Oil leak at solenoid'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Beginner' },
    ],
  },
  {
    id: 'transmission', name: 'Transmission / Drivetrain', icon: Zap, layer: 'powertrain',
    x: 38, y: 30, w: 24, h: 35,
    fasteners: [
      { x: 185, y: 200, type: 'torque', spec: 'M20', torque: '29 ft·lbs', label: 'Trans drain plug' },
      { x: 200, y: 220, type: 'bolt', spec: 'M10', label: 'Mount bolt' },
      { x: 215, y: 200, type: 'bolt', spec: 'M10', label: 'Mount bolt' },
    ],
    components: [
      { name: 'Automatic Transmission (5-speed)', description: 'Transfers power from engine to wheels through gear ratios.', lifespan: '150,000–200,000 mi', symptoms: ['Slipping gears', 'Hard shifts', 'Transmission fluid leak'], diyCost: '$2,000–$3,500 (rebuild)', shopCost: '$3,500–$5,500', difficulty: 'Expert' },
      { name: 'Transmission Fluid + Filter', description: 'Lubricates and cools transmission internals.', lifespan: '30,000–60,000 mi (fluid)', symptoms: ['Dark/burnt fluid', 'Shift issues', 'Overheating'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'CV Axles (Left + Right)', description: 'Transmit power from transmission to front wheels.', lifespan: '100,000–150,000 mi', symptoms: ['Clicking when turning', 'Vibration at speed', 'Grease leak from boot'], diyCost: '$60–$120 each', shopCost: '$250–$400 each', difficulty: 'Intermediate' },
      { name: 'Motor Mounts', description: 'Secure engine/transmission to the chassis, absorb vibration.', lifespan: '80,000–120,000 mi', symptoms: ['Excessive vibration', 'Clunking on acceleration', 'Engine movement visible'], diyCost: '$30–$80 each', shopCost: '$200–$400 each', difficulty: 'Intermediate', commonIssue: true, issueNote: 'Front and side mounts commonly fail on Accords' },
    ],
  },
  {
    id: 'front-susp-l', name: 'Front Suspension (L)', icon: Disc, layer: 'suspension',
    x: 2, y: 8, w: 22, h: 22,
    fasteners: [
      { x: 32, y: 60, type: 'torque', spec: 'M12', torque: '47 ft·lbs', label: 'Strut top nut' },
      { x: 48, y: 56, type: 'torque', spec: 'M12', torque: '47 ft·lbs', label: 'Strut top nut' },
      { x: 38, y: 50, type: 'torque', spec: 'M12', torque: '47 ft·lbs', label: 'Strut top nut' },
      { x: 68, y: 148, type: 'torque', spec: 'M14', torque: '76 ft·lbs', label: 'LCA front bolt' },
      { x: 28, y: 158, type: 'torque', spec: 'M14', torque: '76 ft·lbs', label: 'LCA rear bolt' },
      { x: 72, y: 118, type: 'bolt', spec: 'M12', label: 'Sway bar link' },
    ],
    components: [
      { name: 'Strut Assembly', description: 'Combined shock absorber and spring supporting the front left corner.', lifespan: '80,000–100,000 mi', symptoms: ['Bouncy ride', 'Nose dive on braking', 'Clunking over bumps'], diyCost: '$80–$150', shopCost: '$300–$450', difficulty: 'Intermediate' },
      { name: 'Lower Control Arm + Bushing', description: 'Connects wheel hub to the chassis, allows suspension travel.', lifespan: '100,000+ mi', symptoms: ['Clunking over bumps', 'Uneven tire wear', 'Wandering steering'], diyCost: '$50–$100', shopCost: '$200–$350', difficulty: 'Intermediate' },
      { name: 'Stabilizer Bar Link', description: 'Connects sway bar to the strut to reduce body roll.', lifespan: '60,000–80,000 mi', symptoms: ['Rattling over bumps', 'Clunking in turns'], diyCost: '$15–$30', shopCost: '$100–$150', difficulty: 'Beginner' },
      { name: 'Wheel Bearing', description: 'Allows the wheel to spin freely on the hub.', lifespan: '100,000+ mi', symptoms: ['Humming noise at speed', 'Growling that changes with steering', 'Wheel play'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Advanced' },
    ],
  },
  {
    id: 'front-susp-r', name: 'Front Suspension (R)', icon: Disc, layer: 'suspension',
    x: 76, y: 8, w: 22, h: 22,
    fasteners: [
      { x: 368, y: 60, type: 'torque', spec: 'M12', torque: '47 ft·lbs', label: 'Strut top nut' },
      { x: 352, y: 56, type: 'torque', spec: 'M12', torque: '47 ft·lbs', label: 'Strut top nut' },
      { x: 362, y: 50, type: 'torque', spec: 'M12', torque: '47 ft·lbs', label: 'Strut top nut' },
      { x: 332, y: 148, type: 'torque', spec: 'M14', torque: '76 ft·lbs', label: 'LCA front bolt' },
      { x: 372, y: 158, type: 'torque', spec: 'M14', torque: '76 ft·lbs', label: 'LCA rear bolt' },
      { x: 328, y: 118, type: 'bolt', spec: 'M12', label: 'Sway bar link' },
    ],
    components: [
      { name: 'Strut Assembly', description: 'Combined shock absorber and spring supporting the front right corner.', lifespan: '80,000–100,000 mi', symptoms: ['Bouncy ride', 'Nose dive on braking', 'Clunking over bumps'], diyCost: '$80–$150', shopCost: '$300–$450', difficulty: 'Intermediate' },
      { name: 'Lower Control Arm + Bushing', description: 'Connects wheel hub to the chassis.', lifespan: '100,000+ mi', symptoms: ['Clunking', 'Uneven tire wear'], diyCost: '$50–$100', shopCost: '$200–$350', difficulty: 'Intermediate' },
      { name: 'Stabilizer Bar Link', description: 'Connects sway bar to strut.', lifespan: '60,000–80,000 mi', symptoms: ['Rattling over bumps'], diyCost: '$15–$30', shopCost: '$100–$150', difficulty: 'Beginner' },
      { name: 'Wheel Bearing', description: 'Allows wheel to spin freely.', lifespan: '100,000+ mi', symptoms: ['Humming noise at speed'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Advanced' },
    ],
  },
  {
    id: 'exhaust', name: 'Exhaust System', icon: Zap, layer: 'powertrain',
    x: 40, y: 18, w: 20, h: 76,
    fasteners: [
      { x: 182, y: 138, type: 'torque', spec: 'M8', torque: '23 ft·lbs', label: 'Manifold stud' },
      { x: 192, y: 136, type: 'torque', spec: 'M8', torque: '23 ft·lbs', label: 'Manifold stud' },
      { x: 202, y: 136, type: 'torque', spec: 'M8', torque: '23 ft·lbs', label: 'Manifold stud' },
      { x: 212, y: 138, type: 'torque', spec: 'M8', torque: '23 ft·lbs', label: 'Manifold stud' },
      { x: 185, y: 230, type: 'bolt', spec: 'M8', label: 'Flex pipe clamp' },
      { x: 215, y: 230, type: 'bolt', spec: 'M8', label: 'Flex pipe clamp' },
      { x: 188, y: 380, type: 'bolt', spec: 'M8', label: 'Midpipe flange' },
      { x: 212, y: 380, type: 'bolt', spec: 'M8', label: 'Midpipe flange' },
      { x: 192, y: 510, type: 'clip', label: 'Muffler hanger' },
      { x: 208, y: 510, type: 'clip', label: 'Muffler hanger' },
    ],
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
    id: 'brakes-fl', name: 'Brake — Front Left', icon: Disc, layer: 'suspension',
    x: 2, y: 2, w: 12, h: 12,
    fasteners: [
      { x: 18, y: 30, type: 'torque', spec: 'M12', torque: '25 ft·lbs', label: 'Caliper slide pin' },
      { x: 18, y: 52, type: 'torque', spec: 'M12', torque: '25 ft·lbs', label: 'Caliper slide pin' },
      { x: 35, y: 40, type: 'stud', label: 'Rotor center screw' },
    ],
    components: [
      { name: 'Brake Pads', description: 'Friction material that presses against rotor.', lifespan: '30,000–50,000 mi', symptoms: ['Squealing', 'Grinding', 'Longer stopping distance'], diyCost: '$20–$50', shopCost: '$100–$200', difficulty: 'Beginner' },
      { name: 'Brake Rotor', description: 'Disc that pads clamp against.', lifespan: '50,000–70,000 mi', symptoms: ['Pulsating pedal', 'Scoring visible'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'Brake Caliper', description: 'Hydraulic clamp housing the pads.', lifespan: '100,000+ mi', symptoms: ['Pulling to one side', 'Uneven pad wear'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Intermediate' },
    ],
  },
  {
    id: 'brakes-fr', name: 'Brake — Front Right', icon: Disc, layer: 'suspension',
    x: 86, y: 2, w: 12, h: 12,
    fasteners: [
      { x: 366, y: 30, type: 'torque', spec: 'M12', torque: '25 ft·lbs', label: 'Caliper slide pin' },
      { x: 366, y: 52, type: 'torque', spec: 'M12', torque: '25 ft·lbs', label: 'Caliper slide pin' },
      { x: 380, y: 40, type: 'stud', label: 'Rotor center screw' },
    ],
    components: [
      { name: 'Brake Pads', description: 'Friction material.', lifespan: '30,000–50,000 mi', symptoms: ['Squealing', 'Grinding'], diyCost: '$20–$50', shopCost: '$100–$200', difficulty: 'Beginner' },
      { name: 'Brake Rotor', description: 'Disc surface.', lifespan: '50,000–70,000 mi', symptoms: ['Pulsating pedal'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'Brake Caliper', description: 'Hydraulic clamp.', lifespan: '100,000+ mi', symptoms: ['Pulling', 'Uneven wear'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Intermediate' },
    ],
  },
  {
    id: 'brakes-rl', name: 'Brake — Rear Left', icon: Disc, layer: 'suspension',
    x: 2, y: 82, w: 12, h: 12,
    fasteners: [
      { x: 18, y: 510, type: 'torque', spec: 'M12', torque: '25 ft·lbs', label: 'Caliper slide pin' },
      { x: 18, y: 530, type: 'torque', spec: 'M12', torque: '25 ft·lbs', label: 'Caliper slide pin' },
    ],
    components: [
      { name: 'Brake Pads (Rear)', description: 'Rear friction material — thinner than front.', lifespan: '40,000–60,000 mi', symptoms: ['Squealing', 'Reduced braking'], diyCost: '$20–$40', shopCost: '$100–$180', difficulty: 'Beginner' },
      { name: 'Brake Rotor (Rear)', description: 'Rear disc.', lifespan: '60,000–80,000 mi', symptoms: ['Pulsating'], diyCost: '$25–$50', shopCost: '$120–$200', difficulty: 'Beginner' },
    ],
  },
  {
    id: 'brakes-rr', name: 'Brake — Rear Right', icon: Disc, layer: 'suspension',
    x: 86, y: 82, w: 12, h: 12,
    fasteners: [
      { x: 366, y: 510, type: 'torque', spec: 'M12', torque: '25 ft·lbs', label: 'Caliper slide pin' },
      { x: 366, y: 530, type: 'torque', spec: 'M12', torque: '25 ft·lbs', label: 'Caliper slide pin' },
    ],
    components: [
      { name: 'Brake Pads (Rear)', description: 'Rear friction material.', lifespan: '40,000–60,000 mi', symptoms: ['Squealing'], diyCost: '$20–$40', shopCost: '$100–$180', difficulty: 'Beginner' },
      { name: 'Brake Rotor (Rear)', description: 'Rear disc.', lifespan: '60,000–80,000 mi', symptoms: ['Pulsating'], diyCost: '$25–$50', shopCost: '$120–$200', difficulty: 'Beginner' },
    ],
  },
  {
    id: 'electrical', name: 'Electrical / Fuse Box', icon: Cable, layer: 'electrical',
    x: 5, y: 20, w: 18, h: 15,
    fasteners: [
      { x: 42, y: 138, type: 'clip', label: 'Fuse box cover' },
      { x: 58, y: 138, type: 'clip', label: 'Fuse box cover' },
      { x: 50, y: 158, type: 'bolt', spec: 'M6', label: 'Battery terminal' },
    ],
    components: [
      { name: 'Fuse Box (Under-hood)', description: 'Houses fuses and relays for engine bay components.', lifespan: 'Lifetime', symptoms: ['Blown fuses', 'Intermittent electrical issues'], diyCost: '$1–$5 per fuse', shopCost: '$50–$100', difficulty: 'Beginner' },
      { name: 'Battery', description: '12V lead-acid battery.', lifespan: '3–5 years', symptoms: ['Slow cranking', 'No start', 'Dim lights'], diyCost: '$80–$150', shopCost: '$150–$250', difficulty: 'Beginner' },
      { name: 'Wiring Harness', description: 'Main electrical wiring connecting all systems.', lifespan: 'Lifetime', symptoms: ['Intermittent issues', 'Rodent damage'], diyCost: 'Varies', shopCost: '$500+', difficulty: 'Expert' },
    ],
  },
  {
    id: 'fuel', name: 'Fuel System', icon: Fuel, layer: 'powertrain',
    x: 60, y: 60, w: 35, h: 25,
    fasteners: [
      { x: 298, y: 400, type: 'torque', spec: 'M8', torque: '8.7 ft·lbs', label: 'Fuel pump lock ring' },
      { x: 320, y: 395, type: 'torque', spec: 'M8', torque: '8.7 ft·lbs', label: 'Fuel pump lock ring' },
      { x: 342, y: 400, type: 'torque', spec: 'M8', torque: '8.7 ft·lbs', label: 'Fuel pump lock ring' },
    ],
    components: [
      { name: 'Fuel Tank', description: '18.5-gallon fuel tank.', lifespan: 'Lifetime', symptoms: ['Fuel smell', 'Leaking'], diyCost: '$200–$400', shopCost: '$500–$800', difficulty: 'Advanced' },
      { name: 'Fuel Pump', description: 'Electric pump inside the tank that pressurizes fuel.', lifespan: '100,000+ mi', symptoms: ['No start', 'Sputtering at high speed', 'Whining from rear'], diyCost: '$80–$150', shopCost: '$400–$600', difficulty: 'Intermediate' },
      { name: 'Fuel Filter', description: 'Filters contaminants from fuel.', lifespan: '100,000+ mi', symptoms: ['Hesitation', 'Hard starting'], diyCost: '$20–$40', shopCost: '$100–$200', difficulty: 'Intermediate' },
    ],
  },
  {
    id: 'cabin', name: 'Cabin / Interior', icon: Sofa, layer: 'interior',
    x: 22, y: 35, w: 56, h: 30,
    components: [
      { name: 'Cabin Air Filter', description: 'Filters air entering the HVAC system.', lifespan: '15,000–20,000 mi', symptoms: ['Musty smell', 'Weak airflow', 'Foggy windows'], diyCost: '$10–$20', shopCost: '$40–$80', difficulty: 'Beginner' },
      { name: 'Blower Motor', description: 'Fan that pushes air through the vents.', lifespan: '100,000+ mi', symptoms: ['No airflow', 'Squealing from dash', 'Intermittent fan'], diyCost: '$30–$60', shopCost: '$150–$250', difficulty: 'Intermediate' },
      { name: 'Window Regulator', description: 'Mechanism that raises and lowers the power window.', lifespan: '100,000+ mi', symptoms: ['Window won\'t go up/down', 'Grinding noise', 'Slow movement'], diyCost: '$30–$60', shopCost: '$200–$350', difficulty: 'Intermediate' },
    ],
  },
  {
    id: 'rear-susp-l', name: 'Rear Suspension (L)', icon: Disc, layer: 'suspension',
    x: 2, y: 72, w: 22, h: 18,
    fasteners: [
      { x: 35, y: 448, type: 'torque', spec: 'M12', torque: '40 ft·lbs', label: 'Shock top nut' },
      { x: 65, y: 520, type: 'torque', spec: 'M14', torque: '47 ft·lbs', label: 'Shock lower bolt' },
      { x: 28, y: 490, type: 'bolt', spec: 'M14', label: 'Trailing arm bolt' },
    ],
    components: [
      { name: 'Shock Absorber', description: 'Dampens rear suspension movement.', lifespan: '80,000–100,000 mi', symptoms: ['Bouncy rear end', 'Poor handling', 'Bottoming out'], diyCost: '$40–$80', shopCost: '$200–$300', difficulty: 'Intermediate' },
      { name: 'Coil Spring', description: 'Supports vehicle weight at the rear.', lifespan: '150,000+ mi', symptoms: ['Sagging rear', 'Uneven ride height'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Advanced' },
    ],
  },
  {
    id: 'rear-susp-r', name: 'Rear Suspension (R)', icon: Disc, layer: 'suspension',
    x: 76, y: 72, w: 22, h: 18,
    fasteners: [
      { x: 365, y: 448, type: 'torque', spec: 'M12', torque: '40 ft·lbs', label: 'Shock top nut' },
      { x: 335, y: 520, type: 'torque', spec: 'M14', torque: '47 ft·lbs', label: 'Shock lower bolt' },
      { x: 372, y: 490, type: 'bolt', spec: 'M14', label: 'Trailing arm bolt' },
    ],
    components: [
      { name: 'Shock Absorber', description: 'Dampens rear suspension.', lifespan: '80,000–100,000 mi', symptoms: ['Bouncy rear', 'Poor handling'], diyCost: '$40–$80', shopCost: '$200–$300', difficulty: 'Intermediate' },
      { name: 'Coil Spring', description: 'Supports rear weight.', lifespan: '150,000+ mi', symptoms: ['Sagging'], diyCost: '$40–$80', shopCost: '$200–$350', difficulty: 'Advanced' },
    ],
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const HUD = {
  cyan: '#00d4ff',
  cyanDim: 'rgba(0,212,255,0.15)',
  cyanGlow: 'rgba(0,212,255,0.4)',
  amber: '#f59e0b',
  red: '#ef4444',
  green: '#10b981',
  bg: '#040d18',
  grid: '#0a1628',
  border: '#0d2035',
  textPrimary: '#e2e8f0',
  textMuted: '#475569',
};

type LayerId = 'all' | 'powertrain' | 'suspension' | 'electrical' | 'interior';

const LAYERS: { id: LayerId; label: string; color: string }[] = [
  { id: 'all', label: 'ALL', color: HUD.cyan },
  { id: 'powertrain', label: 'POWERTRAIN', color: '#f97316' },
  { id: 'suspension', label: 'SUSPENSION', color: '#a78bfa' },
  { id: 'electrical', label: 'ELECTRICAL', color: '#fbbf24' },
  { id: 'interior', label: 'INTERIOR', color: '#34d399' },
];

const DIFF_COLORS: Record<string, string> = {
  Beginner: 'bg-emerald-500/20 text-emerald-400',
  Intermediate: 'bg-blue-500/20 text-blue-400',
  Advanced: 'bg-amber-500/20 text-amber-400',
  Expert: 'bg-red-500/20 text-red-400',
};

// ─── Health Helpers ────────────────────────────────────────────────────────────

function parseMaxMileage(lifespan: string): number | null {
  if (lifespan.toLowerCase().includes('lifetime')) return null;
  if (lifespan.toLowerCase().includes('year')) return null;
  const nums = lifespan.replace(/,/g, '').match(/\d+/g);
  if (!nums) return null;
  return Math.max(...nums.map(Number));
}

function componentHealth(comp: ComponentDef, mileage: number | null): number {
  if (!mileage) return 80;
  const maxMi = parseMaxMileage(comp.lifespan);
  if (!maxMi) return 90;
  const pct = ((maxMi - mileage) / maxMi) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function zoneHealth(zone: ZoneDefinition, mileage: number | null): number {
  const scores = zone.components.map(c => componentHealth(c, mileage));
  return Math.min(...scores);
}

function healthColor(h: number): string {
  if (h <= 15) return HUD.red;
  if (h <= 45) return HUD.amber;
  return HUD.green;
}

function healthLabel(h: number): string {
  if (h === 0) return 'PAST DUE';
  if (h <= 15) return 'CRITICAL';
  if (h <= 45) return 'WATCH';
  if (h <= 70) return 'FAIR';
  return 'GOOD';
}

// Min bar width so the bar is always visible even at 0%
function healthBarWidth(h: number): number {
  return h === 0 ? 4 : h;
}

// ─── Explode Offset ────────────────────────────────────────────────────────────

function explodeOffset(zone: ZoneDefinition, selected: ZoneDefinition | null): { tx: number; ty: number } {
  if (!selected || zone.id === selected.id) return { tx: 0, ty: 0 };
  const selCX = (selected.x + selected.w / 2) / 100 * 400;
  const selCY = (selected.y + selected.h / 2) / 100 * 600;
  const zCX = (zone.x + zone.w / 2) / 100 * 400;
  const zCY = (zone.y + zone.h / 2) / 100 * 600;
  const dx = zCX - selCX;
  const dy = zCY - selCY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { tx: 0, ty: 0 };
  const push = Math.max(0, 1 - dist / 160) * 14;
  return { tx: Math.round((dx / dist) * push), ty: Math.round((dy / dist) * push) };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FastenerDot({ f, hoveredFastener, onHover, onLeave }:
  { f: Fastener; hoveredFastener: Fastener | null; onHover: (f: Fastener) => void; onLeave: () => void }) {
  const isHov = hoveredFastener === f;
  const color = f.type === 'torque' ? HUD.amber : f.type === 'clip' ? '#94a3b8' : HUD.cyan;
  const r = f.type === 'stud' ? 3.5 : 3;

  return (
    <g
      className="cursor-pointer"
      onMouseEnter={() => onHover(f)}
      onMouseLeave={onLeave}
    >
      {f.type === 'torque' && (
        <circle cx={f.x} cy={f.y} r={7} fill="none" stroke={HUD.amber} strokeWidth="0.5" opacity={isHov ? 0.8 : 0.3}
          style={{ animation: 'bp-pulse 2s ease-in-out infinite' }} />
      )}
      {f.type === 'clip' ? (
        <rect x={f.x - 3} y={f.y - 3} width={6} height={6} rx={1}
          fill={isHov ? color : 'transparent'} stroke={color} strokeWidth="1"
          opacity={isHov ? 1 : 0.6} transform={`rotate(45 ${f.x} ${f.y})`} />
      ) : (
        <circle cx={f.x} cy={f.y} r={r}
          fill={isHov ? color : (f.type === 'stud' ? color : 'transparent')}
          stroke={color} strokeWidth="1"
          opacity={isHov ? 1 : 0.65} />
      )}
      {isHov && f.label && (
        <g>
          <rect x={f.x + 8} y={f.y - 14} width={Math.max(60, f.label.length * 5 + (f.torque ? 40 : 0))} height={f.torque ? 28 : 16} rx={3}
            fill="#040d18" stroke={color} strokeWidth="0.8" opacity="0.95" />
          <text x={f.x + 12} y={f.y - 4} fill={color} fontSize="6.5" fontFamily="monospace">{f.label}</text>
          {f.spec && <text x={f.x + 12} y={f.y + 4} fill={HUD.textMuted} fontSize="5.5" fontFamily="monospace">{f.spec}{f.torque ? ` · ${f.torque}` : ''}</text>}
        </g>
      )}
    </g>
  );
}

function RadialMenu({ zone, x, y, onInfo, onProject, onAsk, onManual, onClose, hasCharm }:
  { zone: ZoneDefinition; x: number; y: number; onInfo: () => void; onProject: () => void; onAsk: () => void; onManual: () => void; onClose: () => void; hasCharm: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOpen(true)); return () => cancelAnimationFrame(id); }, []);

  const RADIUS = 60;
  const items = [
    { label: 'INFO', icon: ChevronRight, action: onInfo, angle: -90, color: HUD.cyan, delay: 0 },
    { label: 'PROJECT', icon: Wrench, action: onProject, angle: 0, color: '#f97316', delay: 55 },
    { label: 'RATCHET', icon: MessageCircle, action: onAsk, angle: 90, color: '#34d399', delay: 110 },
    { label: hasCharm ? 'MANUAL' : 'DOCS', icon: BookOpen, action: onManual, angle: 180, color: '#a78bfa', delay: 165 },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[58]" onClick={onClose} />
      <div className="fixed z-[59] pointer-events-none" style={{ left: x, top: y, transform: 'translate(-50%,-50%)' }}>
        {/* Reticle */}
        <div className="absolute" style={{
          left: -12, top: -12, width: 24, height: 24,
          borderRadius: '50%',
          background: `rgba(0,212,255,0.15)`,
          border: `1.5px solid ${HUD.cyan}`,
          boxShadow: `0 0 12px ${HUD.cyanGlow}`,
          transform: open ? 'scale(1)' : 'scale(0)',
          transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          pointerEvents: 'auto',
        }} />
        {items.map(({ label, icon: Icon, action, angle, color, delay }) => {
          const rad = (angle * Math.PI) / 180;
          const tx = Math.cos(rad) * RADIUS;
          const ty = Math.sin(rad) * RADIUS;
          return (
            <div key={label} className="pointer-events-auto absolute flex flex-col items-center gap-0.5"
              style={{
                left: tx - 20, top: ty - 20,
                transform: open ? 'scale(1)' : 'scale(0)',
                transition: `transform 0.28s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
              }}>
              <button
                onClick={e => { e.stopPropagation(); action(); onClose(); }}
                className="h-10 w-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                style={{
                  background: `rgba(${hexRgb(color)},0.18)`,
                  border: `1.5px solid ${color}`,
                  boxShadow: `0 0 12px rgba(${hexRgb(color)},0.35)`,
                }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </button>
              <span className="text-[8px] font-mono tracking-widest" style={{ color, opacity: open ? 1 : 0, transition: `opacity 0.3s ${delay + 120}ms` }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function hexRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function StatusOverview({ mileage }: { mileage: number | null }) {
  const layerZones: Record<string, ZoneDefinition[]> = {
    POWERTRAIN: ZONES.filter(z => z.layer === 'powertrain'),
    SUSPENSION: ZONES.filter(z => z.layer === 'suspension'),
    ELECTRICAL: ZONES.filter(z => z.layer === 'electrical'),
    INTERIOR: ZONES.filter(z => z.layer === 'interior'),
  };
  const layerColors: Record<string, string> = {
    POWERTRAIN: '#f97316',
    SUSPENSION: '#a78bfa',
    ELECTRICAL: '#fbbf24',
    INTERIOR: '#34d399',
  };

  return (
    <div className="p-4 space-y-4" style={{ fontFamily: 'monospace' }}>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4" style={{ color: HUD.cyan }} />
        <span className="text-[11px] font-mono tracking-widest uppercase" style={{ color: HUD.cyan }}>System Health</span>
      </div>
      {Object.entries(layerZones).map(([name, zones]) => {
        const healths = zones.map(z => zoneHealth(z, mileage));
        const avg = healths.length ? Math.round(healths.reduce((a, b) => a + b, 0) / healths.length) : 90;
        const color = healthColor(avg);
        return (
          <div key={name} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] tracking-widest" style={{ color: layerColors[name] }}>{name}</span>
              <span className="text-[10px]" style={{ color }}>{avg}% · {healthLabel(avg)}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${healthBarWidth(avg)}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
            </div>
          </div>
        );
      })}
      <div className="pt-3 border-t space-y-2" style={{ borderColor: HUD.border }}>
        <p className="text-[10px] uppercase tracking-widest" style={{ color: HUD.textMuted }}>Legend</p>
        <div className="flex flex-wrap gap-2">
          {[
            { color: HUD.cyan, label: 'BOLT', shape: 'circle' },
            { color: HUD.amber, label: 'TORQUE-CRITICAL', shape: 'ring' },
            { color: '#94a3b8', label: 'CLIP/HANGER', shape: 'diamond' },
            { color: HUD.cyan, label: 'STUD', shape: 'dot' },
          ].map(({ color, label, shape }) => (
            <div key={label} className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12">
                {shape === 'circle' && <circle cx="6" cy="6" r="3.5" fill="transparent" stroke={color} strokeWidth="1.2" />}
                {shape === 'ring' && <>
                  <circle cx="6" cy="6" r="4.5" fill="transparent" stroke={color} strokeWidth="0.8" opacity="0.4" />
                  <circle cx="6" cy="6" r="2.5" fill="transparent" stroke={color} strokeWidth="1.2" />
                </>}
                {shape === 'diamond' && <rect x="3.5" y="3.5" width="5" height="5" rx="0.5" fill="transparent" stroke={color} strokeWidth="1.2" transform="rotate(45 6 6)" />}
                {shape === 'dot' && <circle cx="6" cy="6" r="3" fill={color} />}
              </svg>
              <span className="text-[8px] font-mono tracking-wider" style={{ color: HUD.textMuted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="pt-2 text-[9px] font-mono leading-relaxed" style={{ color: HUD.textMuted }}>
        <span style={{ color: HUD.amber }}>▸</span> Click any zone to open radial menu<br />
        <span style={{ color: HUD.amber }}>▸</span> Hover zone corners to see fasteners<br />
        <span style={{ color: HUD.amber }}>▸</span> Toggle layers to isolate systems
      </div>
    </div>
  );
}

function DetailPanel({
  zone, vehicle, vehicleId, mileage, dtcRecords,
  onClose, onAsk, onCharm,
  generatingComponent, setGeneratingComponent, queryClient, navigate,
}: any) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#060f1e' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: HUD.border }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(0,212,255,0.12)', border: `1px solid ${HUD.cyanDim}` }}>
            <zone.icon className="h-4 w-4" style={{ color: HUD.cyan }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-mono font-bold uppercase tracking-widest truncate" style={{ color: HUD.cyan }}>{zone.name}</p>
            <p className="text-[10px] font-mono" style={{ color: HUD.textMuted }}>{zone.components.length} COMPONENTS</p>
          </div>
        </div>
        <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5">
          <X className="h-3.5 w-3.5" style={{ color: HUD.textMuted }} />
        </button>
      </div>

      {/* Zone health bar */}
      {(() => {
        const h = zoneHealth(zone, mileage);
        const c = healthColor(h);
        return (
          <div className="px-4 py-2 shrink-0 border-b" style={{ borderColor: HUD.border }}>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-mono tracking-widest" style={{ color: HUD.textMuted }}>ZONE HEALTH</span>
              <span className="text-[9px] font-mono" style={{ color: c }}>{healthLabel(h)} · {h}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full" style={{ width: `${healthBarWidth(h)}%`, background: c, transition: 'width 0.6s ease', boxShadow: `0 0 6px ${c}88` }} />
            </div>
          </div>
        );
      })()}

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch' as any }}>
        {zone.components.map((comp: ComponentDef, i: number) => {
          const key = `${zone.id}-${i}`;
          const isExp = expanded === key;
          const health = componentHealth(comp, mileage);
          const hColor = healthColor(health);
          const hasDtc = comp.relatedDtcs?.some((dtc: string) => dtcRecords.some((r: any) => r.code === dtc));
          const statusColor = hasDtc ? HUD.red : comp.commonIssue ? HUD.amber : hColor;

          return (
            <div key={key} className="rounded-xl overflow-hidden transition-all"
              style={{ border: `1px solid ${isExp ? HUD.cyanDim : HUD.border}`, background: isExp ? 'rgba(0,212,255,0.04)' : '#070e1a' }}>
              <button className="w-full p-3 flex items-center gap-3 text-left"
                onClick={() => setExpanded(isExp ? null : key)}>
                {/* Health indicator */}
                <div className="relative shrink-0">
                  <svg width="28" height="28" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                    <circle cx="14" cy="14" r="11" fill="none" stroke={statusColor} strokeWidth="2"
                      strokeDasharray={`${2 * Math.PI * 11 * Math.max(4, health) / 100} ${2 * Math.PI * 11}`}
                      strokeLinecap="round"
                      transform="rotate(-90 14 14)"
                      style={{ transition: 'stroke-dasharray 0.5s ease', filter: `drop-shadow(0 0 3px ${statusColor}88)` }} />
                    <circle cx="14" cy="14" r="3.5" fill={statusColor} opacity="0.9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: HUD.textPrimary }}>{comp.name}</p>
                  <p className="text-[10px] truncate" style={{ color: HUD.textMuted }}>{comp.lifespan}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(hasDtc || comp.commonIssue) && (
                    <AlertTriangle className="h-3 w-3" style={{ color: hasDtc ? HUD.red : HUD.amber }} />
                  )}
                  {isExp ? <ChevronDown className="h-3.5 w-3.5" style={{ color: HUD.textMuted }} /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: HUD.textMuted }} />}
                </div>
              </button>

              {isExp && (
                <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: HUD.border }}>
                  <p className="text-[11px] leading-relaxed pt-2" style={{ color: '#94a3b8' }}>{comp.description}</p>

                  {comp.issueNote && (
                    <div className="rounded-lg px-3 py-2 text-[10px] font-mono" style={{ background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.2)`, color: HUD.amber }}>
                      ⚠ {comp.issueNote}
                    </div>
                  )}

                  {comp.relatedDtcs && comp.relatedDtcs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {comp.relatedDtcs.map((dtc: string) => (
                        <span key={dtc} className="px-2 py-0.5 rounded text-[9px] font-mono"
                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: HUD.red }}>
                          {dtc}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${HUD.border}` }}>
                      <p className="text-[8px] font-mono tracking-widest mb-1" style={{ color: HUD.textMuted }}>DIFFICULTY</p>
                      <Badge className={cn('text-[9px] font-mono', DIFF_COLORS[comp.difficulty] || '')}>{comp.difficulty}</Badge>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${HUD.border}` }}>
                      <p className="text-[8px] font-mono tracking-widest mb-1" style={{ color: HUD.textMuted }}>HEALTH</p>
                      <span className="text-xs font-mono font-bold" style={{ color: statusColor }}>{health}%</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[8px] font-mono tracking-widest" style={{ color: HUD.textMuted }}>FAILURE SIGNATURES</p>
                    {comp.symptoms.map((s: string, si: number) => (
                      <div key={si} className="flex items-center gap-1.5">
                        <span className="text-[9px]" style={{ color: HUD.cyan }}>▸</span>
                        <span className="text-[11px]" style={{ color: '#94a3b8' }}>{s}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <p className="text-[8px] font-mono tracking-widest" style={{ color: '#10b981' }}>DIY</p>
                      <p className="text-xs font-mono font-bold mt-0.5" style={{ color: HUD.textPrimary }}>{comp.diyCost}</p>
                    </div>
                    <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${HUD.border}` }}>
                      <p className="text-[8px] font-mono tracking-widest" style={{ color: HUD.textMuted }}>SHOP</p>
                      <p className="text-xs font-mono font-bold mt-0.5" style={{ color: HUD.textPrimary }}>{comp.shopCost}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    {vehicle.year >= 1982 && vehicle.year <= 2013 && (
                      <button
                        onClick={() => onCharm(comp, key)}
                        className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-mono tracking-wide transition-all hover:opacity-90"
                        style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
                        <BookOpen className="h-3.5 w-3.5" />
                        FACTORY PROCEDURE
                      </button>
                    )}
                    {generatingComponent === key ? (
                      <button disabled className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-mono"
                        style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316' }}>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        BUILDING PROJECT...
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setGeneratingComponent(key);
                          const action = comp.commonIssue ? 'Inspect and replace if needed' : 'Replace';
                          const jobDescription = `${action} ${comp.name} on ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.engine ? ` ${vehicle.engine}` : ''}`;
                          invokeWithAuth('generate-project', { vehicleId, jobDescription }).then(resp => {
                            if (resp.error) {
                              const isRL = (resp.error as any).status === 429 || resp.error.message?.toLowerCase().includes('rate limit');
                              throw new Error(isRL ? 'Rate limit — max 10 AI projects per day.' : resp.error.message);
                            }
                            const result = resp.data as any;
                            if (result?.error) throw new Error(result.error);
                            const projectId = result?.project?.id;
                            if (!projectId) throw new Error('No project returned');
                            ['projects', 'all-projects', 'active-projects', 'all-project-steps-summary', 'all-project-parts-summary'].forEach(k =>
                              queryClient.invalidateQueries({ queryKey: [k] }));
                            toast.success(`Project created for ${comp.name}`);
                            onClose();
                            setTimeout(() => navigate(`/garage/${vehicleId}/projects/${projectId}`), 400);
                          }).catch((err: any) => {
                            toast.error(err?.message || "Couldn't generate the plan right now.");
                          }).finally(() => setGeneratingComponent(null));
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-mono tracking-wide transition-all hover:opacity-90"
                        style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#f97316' }}>
                        <Wrench className="h-3.5 w-3.5" />
                        START PROJECT
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const sympText = comp.symptoms.length ? `Common failure symptoms: ${comp.symptoms.join(', ')}.` : '';
                        const miText = vehicle.mileage ? `My car has ${vehicle.mileage.toLocaleString()} miles.` : '';
                        onClose();
                        onAsk(`I'm looking at the ${comp.name} on my ${vehicle.year} ${vehicle.make} ${vehicle.model} in the Blueprint. ${comp.description} ${sympText} ${miText} Should I replace this, and what should I know before starting?`);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-mono tracking-wide transition-all hover:opacity-90"
                      style={{ background: 'rgba(0,212,255,0.08)', border: `1px solid ${HUD.cyanDim}`, color: HUD.cyan }}>
                      <MessageCircle className="h-3.5 w-3.5" />
                      ASK RATCHET
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface BlueprintTabProps { vehicleId: string; vehicle: any; }

export default function BlueprintTab({ vehicleId, vehicle }: BlueprintTabProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openRatchetPanel } = useAppStore();

  const [selectedZone, setSelectedZone] = useState<ZoneDefinition | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<LayerId>('all');
  const [search, setSearch] = useState('');
  const [showFasteners, setShowFasteners] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [radialMenu, setRadialMenu] = useState<{ zone: ZoneDefinition; x: number; y: number } | null>(null);
  const [hoveredFastener, setHoveredFastener] = useState<Fastener | null>(null);
  const [generatingComponent, setGeneratingComponent] = useState<string | null>(null);
  const [charmSheet, setCharmSheet] = useState<{ compName: string; data: any } | null>(null);
  const [loadingCharm, setLoadingCharm] = useState<string | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const [lineDrawn, setLineDrawn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const mileage: number | null = vehicle.mileage || null;
  const isSupported = isBlueprintSupported(vehicle);

  // Inject CSS keyframes once
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'bp-keyframes';
    if (!document.getElementById('bp-keyframes')) {
      style.textContent = `
        @keyframes bp-scan { 0%{opacity:1;transform:translateY(0)} 85%{opacity:1} 100%{opacity:0;transform:translateY(620px)} }
        @keyframes bp-march { to { stroke-dashoffset: -14; } }
        @keyframes bp-pulse { 0%,100%{opacity:0.3;r:7} 50%{opacity:0.8;r:9} }
        @keyframes bp-glow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes bp-fadein { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
      `;
      document.head.appendChild(style);
    }
    return () => {};
  }, []);

  // Scan on mount
  useEffect(() => {
    const t = setTimeout(() => setScanDone(true), 1400);
    return () => clearTimeout(t);
  }, []);

  // Callout line animation on zone select
  useEffect(() => {
    setLineDrawn(false);
    if (selectedZone) {
      const t = setTimeout(() => setLineDrawn(true), 60);
      return () => clearTimeout(t);
    }
  }, [selectedZone?.id]);

  // Supabase queries
  const { data: dtcRecords = [] } = useQuery({
    queryKey: ['dtc-records', vehicleId],
    queryFn: async () => {
      const { data } = await supabase.from('dtc_records').select('*').eq('vehicle_id', vehicleId).eq('status', 'active');
      return data || [];
    },
  });

  const { data: recentMaintenance = [] } = useQuery({
    queryKey: ['recent-maintenance', vehicleId],
    queryFn: async () => {
      const d = new Date(); d.setMonth(d.getMonth() - 6);
      const { data } = await supabase.from('maintenance_logs').select('*').eq('vehicle_id', vehicleId).gte('date', d.toISOString().split('T')[0]);
      return data || [];
    },
  });

  // Search
  const searchLower = search.toLowerCase();
  const matchingZoneIds = useMemo(() => {
    if (!searchLower) return new Set<string>();
    const ids = new Set<string>();
    ZONES.forEach(z => {
      if (z.name.toLowerCase().includes(searchLower)) { ids.add(z.id); return; }
      z.components.forEach(c => {
        if (c.name.toLowerCase().includes(searchLower) || c.description.toLowerCase().includes(searchLower)) ids.add(z.id);
      });
    });
    return ids;
  }, [searchLower]);

  const zoneHasActiveDtc = useCallback((zone: ZoneDefinition) => {
    return zone.components.some(c => c.relatedDtcs?.some(dtc => dtcRecords.some((r: any) => r.code === dtc)));
  }, [dtcRecords]);

  const handleZoneClick = (zone: ZoneDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    // Use client coords so RadialMenu can use position:fixed — escapes all overflow:hidden parents
    setRadialMenu({ zone, x: e.clientX, y: e.clientY });
  };

  const handleCharm = async (comp: ComponentDef, compKey: string) => {
    setLoadingCharm(compKey);
    try {
      const keyword = componentToJobKeyword(comp.name);
      const resp = await invokeWithAuth('fetch-charm-data', {
        make: vehicle.make, year: vehicle.year, model: vehicle.model, engine: vehicle.engine || null, jobKeyword: keyword,
      });
      if (resp.error) throw resp.error;
      const data = resp.data as any;
      if (data?.found) {
        setCharmSheet({ compName: comp.name, data });
      } else {
        toast.info('No factory procedure available for this component');
      }
    } catch {
      toast.error('Could not load factory procedure');
    } finally {
      setLoadingCharm(null);
    }
  };

  const renderZones = ZONES.filter(z => z.id !== 'body');

  const SVG_W = 400;
  const SVG_H = 600;
  const svgPixelW = isMobile ? Math.min(window.innerWidth - 32, 340) * zoom : 360 * zoom;
  const svgPixelH = svgPixelW * SVG_H / SVG_W;

  if (!isSupported) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center"
        style={{ background: '#040d18', borderColor: HUD.border }}>
        <CarIcon className="h-12 w-12" style={{ color: HUD.textMuted }} />
        <div className="space-y-1">
          <p className="font-semibold" style={{ color: HUD.textPrimary }}>Blueprint not available for this vehicle</p>
          <p className="text-sm" style={{ color: HUD.textMuted }}>
            Interactive schematics are currently available for 2008–2012 Honda Accord (K24).
          </p>
          <p className="text-sm" style={{ color: HUD.textMuted }}>
            Support for <span style={{ color: HUD.textPrimary }}>{vehicleLabel}</span> is coming soon.
          </p>
        </div>
        <button onClick={() => openRatchetPanel()} className="mt-2 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-mono transition-all"
          style={{ background: 'rgba(0,212,255,0.12)', border: `1px solid ${HUD.cyanDim}`, color: HUD.cyan }}>
          <MessageCircle className="h-4 w-4" />
          Ask Ratchet about this vehicle
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: HUD.textMuted }} />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search systems, components, symptoms..."
          className="pl-10 h-10 text-sm font-mono border rounded-xl focus:ring-0"
          style={{ background: '#060f1e', borderColor: HUD.border, color: HUD.textPrimary, caretColor: HUD.cyan }} />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: HUD.textMuted }}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Layer toggles */}
      <div className="flex flex-wrap gap-1.5">
        {LAYERS.map(l => (
          <button key={l.id} onClick={() => setActiveLayer(l.id)}
            className="px-2.5 py-1 rounded-lg text-[9px] font-mono tracking-widest uppercase transition-all"
            style={{
              background: activeLayer === l.id ? `rgba(${hexRgb(l.color)},0.2)` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeLayer === l.id ? l.color : HUD.border}`,
              color: activeLayer === l.id ? l.color : HUD.textMuted,
              boxShadow: activeLayer === l.id ? `0 0 8px rgba(${hexRgb(l.color)},0.3)` : 'none',
            }}>
            {l.label}
          </button>
        ))}
        <button onClick={() => setShowFasteners(f => !f)}
          className="px-2.5 py-1 rounded-lg text-[9px] font-mono tracking-widest uppercase transition-all ml-auto"
          style={{
            background: showFasteners ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${showFasteners ? HUD.amber : HUD.border}`,
            color: showFasteners ? HUD.amber : HUD.textMuted,
            boxShadow: showFasteners ? `0 0 8px rgba(245,158,11,0.25)` : 'none',
          }}>
          ◎ FASTENERS
        </button>
      </div>

      {/* Main blueprint area */}
      <div className={cn('flex gap-0 rounded-xl border', isMobile ? 'flex-col' : 'flex-row')}
        style={{ background: HUD.bg, borderColor: HUD.border, minHeight: isMobile ? 400 : 560, overflow: 'visible' }}>

        {/* SVG Column */}
        <div ref={containerRef} className="relative shrink-0 flex items-center justify-center"
          style={{
            width: isMobile ? '100%' : 420,
            minHeight: isMobile ? 400 : 560,
            backgroundImage: `radial-gradient(circle, ${HUD.grid} 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
          onClick={() => { setRadialMenu(null); }}>

          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
            {[{ icon: Plus, fn: () => setZoom(z => Math.min(2.5, z + 0.2)) }, { icon: Minus, fn: () => setZoom(z => Math.max(0.5, z - 0.2)) }].map(({ icon: Icon, fn }, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); fn(); }}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-all hover:opacity-90"
                style={{ background: 'rgba(0,212,255,0.1)', border: `1px solid ${HUD.cyanDim}`, color: HUD.cyan }}>
                <Icon className="h-3 w-3" />
              </button>
            ))}
            <button onClick={e => { e.stopPropagation(); setZoom(1); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[8px] font-mono transition-all hover:opacity-90"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${HUD.border}`, color: HUD.textMuted }}>
              1:1
            </button>
          </div>

          {/* SVG */}
          <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ width: svgPixelW, height: svgPixelH, maxWidth: '100%', overflow: 'visible', transition: 'width 0.2s, height 0.2s' }}>
            <defs>
              <filter id="hud-glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="hud-glow-red">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="car-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d1f35" />
                <stop offset="100%" stopColor="#070e1a" />
              </linearGradient>
            </defs>

            {/* ─── Car body ────────────────────────── */}
            {/* Outer shell */}
            <path
              d="M 100,30 Q 100,15 120,10 L 280,10 Q 300,15 300,30
                 L 310,60 Q 318,72 318,85 L 320,200
                 Q 322,222 320,242 L 316,445 Q 315,478 310,500
                 L 300,542 Q 298,560 280,565 L 120,565
                 Q 102,560 100,542 L 90,500 Q 85,478 84,445
                 L 80,242 Q 78,222 80,200 L 82,85
                 Q 82,72 90,60 Z"
              fill="url(#car-fill)" stroke="#1a2e48" strokeWidth="1.5" />

            {/* Windshield */}
            <path d="M 118,118 L 132,78 L 268,78 L 282,118 Z" fill="rgba(0,212,255,0.04)" stroke="#1a3050" strokeWidth="1" />
            {/* A-pillar lines */}
            <line x1="118" y1="118" x2="132" y2="78" stroke="#0d2038" strokeWidth="0.8" />
            <line x1="282" y1="118" x2="268" y2="78" stroke="#0d2038" strokeWidth="0.8" />

            {/* Rear window */}
            <path d="M 120,428 L 132,462 L 268,462 L 280,428 Z" fill="rgba(0,212,255,0.03)" stroke="#1a3050" strokeWidth="1" />

            {/* Roof panel */}
            <path d="M 118,118 L 282,118 L 280,428 L 120,428 Z" fill="rgba(0,0,0,0.15)" stroke="none" />

            {/* Front hood crease lines */}
            <line x1="200" y1="12" x2="200" y2="80" stroke="#0d2038" strokeWidth="0.6" strokeDasharray="3 4" />
            <path d="M 140,20 Q 170,15 200,14 Q 230,15 260,20" fill="none" stroke="#1a3050" strokeWidth="0.6" />

            {/* Trunk crease */}
            <path d="M 140,558 Q 170,562 200,563 Q 230,562 260,558" fill="none" stroke="#1a3050" strokeWidth="0.6" />

            {/* Door lines */}
            <line x1="84" y1="200" x2="100" y2="200" stroke="#1a2e48" strokeWidth="0.5" />
            <line x1="100" y1="200" x2="300" y2="200" stroke="#1a2e48" strokeWidth="0.8" />
            <line x1="300" y1="200" x2="316" y2="200" stroke="#1a2e48" strokeWidth="0.5" />
            <line x1="84" y1="390" x2="100" y2="390" stroke="#1a2e48" strokeWidth="0.5" />
            <line x1="100" y1="390" x2="300" y2="390" stroke="#1a2e48" strokeWidth="0.8" />

            {/* Door handles — front */}
            <rect x="88" y="270" width="8" height="3" rx="1.5" fill="none" stroke="#1a3050" strokeWidth="0.8" />
            <rect x="304" y="270" width="8" height="3" rx="1.5" fill="none" stroke="#1a3050" strokeWidth="0.8" />
            {/* Door handles — rear */}
            <rect x="88" y="340" width="8" height="3" rx="1.5" fill="none" stroke="#1a3050" strokeWidth="0.8" />
            <rect x="304" y="340" width="8" height="3" rx="1.5" fill="none" stroke="#1a3050" strokeWidth="0.8" />

            {/* Side mirrors */}
            <path d="M 74,136 Q 68,138 68,144 Q 68,150 74,152 L 82,148 L 82,140 Z" fill="none" stroke="#1a3050" strokeWidth="1" />
            <path d="M 326,136 Q 332,138 332,144 Q 332,150 326,152 L 318,148 L 318,140 Z" fill="none" stroke="#1a3050" strokeWidth="1" />

            {/* Seats (interior visible through windows) */}
            {/* Front seats */}
            <rect x="140" y="200" width="42" height="55" rx="6" fill="rgba(13,30,50,0.8)" stroke="#0d2038" strokeWidth="0.8" />
            <rect x="218" y="200" width="42" height="55" rx="6" fill="rgba(13,30,50,0.8)" stroke="#0d2038" strokeWidth="0.8" />
            {/* Center console */}
            <rect x="186" y="210" width="28" height="38" rx="4" fill="rgba(7,14,26,0.9)" stroke="#0d2038" strokeWidth="0.8" />
            {/* Steering wheel */}
            <circle cx="158" cy="195" r="10" fill="none" stroke="#0d2038" strokeWidth="1.2" />
            <line x1="148" y1="195" x2="168" y2="195" stroke="#0d2038" strokeWidth="0.8" />
            <line x1="158" y1="185" x2="158" y2="205" stroke="#0d2038" strokeWidth="0.8" />
            {/* Rear seats */}
            <rect x="120" y="380" width="160" height="55" rx="6" fill="rgba(13,30,50,0.8)" stroke="#0d2038" strokeWidth="0.8" />

            {/* Headlights */}
            <path d="M 108,20 L 135,14 L 135,36 L 108,40 Z" fill="rgba(0,212,255,0.06)" stroke={HUD.cyan} strokeWidth="0.8" opacity="0.6" />
            <path d="M 292,20 L 265,14 L 265,36 L 292,40 Z" fill="rgba(0,212,255,0.06)" stroke={HUD.cyan} strokeWidth="0.8" opacity="0.6" />
            {/* Headlight DRL line */}
            <line x1="112" y1="28" x2="133" y2="24" stroke={HUD.cyan} strokeWidth="0.6" opacity="0.4" />
            <line x1="288" y1="28" x2="267" y2="24" stroke={HUD.cyan} strokeWidth="0.6" opacity="0.4" />

            {/* Taillights */}
            <path d="M 108,548 L 130,555 L 130,565 L 108,560 Z" fill="rgba(239,68,68,0.12)" stroke="#ef4444" strokeWidth="0.8" opacity="0.5" />
            <path d="M 292,548 L 270,555 L 270,565 L 292,560 Z" fill="rgba(239,68,68,0.12)" stroke="#ef4444" strokeWidth="0.8" opacity="0.5" />

            {/* Wheels */}
            {([[82, 98], [318, 98], [82, 492], [318, 492]] as [number,number][]).map(([cx, cy], i) => (
              <g key={i}>
                <rect x={cx - 18} y={cy - 30} width="36" height="60" rx="7" fill="#060f1e" stroke="#1a2e48" strokeWidth="1.5" />
                {/* Tire tread */}
                <rect x={cx - 18} y={cy - 30} width="36" height="60" rx="7" fill="none" stroke="#0d1f35" strokeWidth="3" />
                {/* Wheel center */}
                <circle cx={cx} cy={cy} r="12" fill="#08121e" stroke="#1a3050" strokeWidth="1" />
                {/* Lug pattern */}
                {[0, 72, 144, 216, 288].map(a => {
                  const rad = (a - 90) * Math.PI / 180;
                  return <circle key={a} cx={cx + Math.cos(rad) * 6.5} cy={cy + Math.sin(rad) * 6.5} r="1.8" fill="#1a3050" />;
                })}
                <circle cx={cx} cy={cy} r="3" fill="#1a3050" />
              </g>
            ))}

            {/* Center driveline axis */}
            <line x1="200" y1="45" x2="200" y2="578" stroke={HUD.grid} strokeWidth="0.5" strokeDasharray="6 5" />

            {/* ─── Clickable zones ──────────────────── */}
            {renderZones.map((zone, zIdx) => {
              const isSelected = selectedZone?.id === zone.id;
              const isHovered = hoveredZone === zone.id;
              const isMatch = searchLower ? matchingZoneIds.has(zone.id) : false;
              const hasDtc = zoneHasActiveDtc(zone);
              const hasIssue = zone.components.some(c => c.commonIssue);
              const health = zoneHealth(zone, mileage);
              const hColor = healthColor(health);
              const layerMatch = activeLayer === 'all' || zone.layer === activeLayer;
              const { tx, ty } = explodeOffset(zone, selectedZone);

              const zx = (zone.x / 100) * SVG_W;
              const zy = (zone.y / 100) * SVG_H;
              const zw = (zone.w / 100) * SVG_W;
              const zh = (zone.h / 100) * SVG_H;

              let fillColor = 'transparent';
              let strokeColor = 'transparent';
              let strokeW = 0;
              let glowFilter = '';

              if (isSelected) {
                fillColor = 'rgba(0,212,255,0.12)';
                strokeColor = HUD.cyan;
                strokeW = 1.5;
                glowFilter = 'url(#hud-glow-cyan)';
              } else if (isMatch) {
                fillColor = 'rgba(0,212,255,0.1)';
                strokeColor = 'rgba(0,212,255,0.6)';
                strokeW = 1;
              } else if (hasDtc) {
                fillColor = 'rgba(239,68,68,0.1)';
                strokeColor = HUD.red;
                strokeW = 1;
                glowFilter = 'url(#hud-glow-red)';
              } else if (isHovered && layerMatch) {
                fillColor = 'rgba(0,212,255,0.08)';
                strokeColor = 'rgba(0,212,255,0.5)';
                strokeW = 1;
              } else if (layerMatch) {
                strokeColor = health < 30 ? `rgba(239,68,68,0.35)` : health < 55 ? `rgba(245,158,11,0.3)` : 'rgba(0,212,255,0.18)';
                strokeW = 0.8;
              }

              const opacity = !layerMatch ? 0.12 : 1;

              return (
                <g key={zone.id}
                  className="cursor-pointer"
                  style={{
                    transform: `translate(${tx}px, ${ty}px)`,
                    transition: 'transform 0.35s cubic-bezier(0.34,1.2,0.64,1)',
                    opacity,
                  } as React.CSSProperties}
                  onMouseEnter={() => { if (layerMatch) setHoveredZone(zone.id); }}
                  onMouseLeave={() => setHoveredZone(null)}
                  onClick={e => { if (layerMatch) handleZoneClick(zone, e); }}
                  filter={glowFilter || undefined}
                >
                  {/* Zone rect */}
                  <rect x={zx} y={zy} width={zw} height={zh} rx={4}
                    fill={fillColor} stroke={strokeColor} strokeWidth={strokeW}
                    strokeDasharray={isSelected || hasDtc ? 'none' : '4 3'}
                    className="transition-all duration-150" />

                  {/* Health bar under zone */}
                  {layerMatch && (
                    <rect x={zx} y={zy + zh - 2} width={zw * health / 100} height={2} rx={1}
                      fill={hColor} opacity={isSelected ? 0.8 : 0.4} />
                  )}

                  {/* Issue pulse dot */}
                  {(hasDtc || (hasIssue && health < 50)) && layerMatch && (
                    <circle cx={zx + zw - 6} cy={zy + 6} r={4} fill={hasDtc ? HUD.red : HUD.amber}
                      style={{ animation: 'bp-glow 1.5s ease-in-out infinite' }} />
                  )}

                  {/* Zone label */}
                  <text
                    x={zx + zw / 2} y={zy + zh / 2}
                    textAnchor="middle" dominantBaseline="middle"
                    className="select-none pointer-events-none"
                    fill={isSelected ? HUD.cyan : isMatch ? HUD.cyan : hasDtc ? HUD.red : isHovered ? HUD.cyan : hColor === HUD.red ? HUD.red : hColor === HUD.amber ? HUD.amber : HUD.textMuted}
                    fontSize={zw > 80 ? 8.5 : 7}
                    fontFamily="'SF Mono', 'Fira Code', monospace"
                    fontWeight={isSelected ? 700 : 400}
                    letterSpacing="0.05em"
                    style={{ opacity: layerMatch ? 1 : 0.4 }}
                  >
                    {zone.name.length > 22 ? zone.name.slice(0, 20) + '…' : zone.name}
                  </text>

                  {/* Layer indicator dot */}
                  {activeLayer === 'all' && layerMatch && (
                    <circle cx={zx + 6} cy={zy + 6} r={2.5}
                      fill={LAYERS.find(l => l.id === zone.layer)?.color || HUD.cyan}
                      opacity={0.6} />
                  )}
                </g>
              );
            })}

            {/* ─── Fastener markers ─────────────────── */}
            {showFasteners && renderZones.map(zone => {
              const layerMatch = activeLayer === 'all' || zone.layer === activeLayer;
              if (!layerMatch || !zone.fasteners) return null;
              return zone.fasteners.map((f, fi) => (
                <FastenerDot key={`${zone.id}-f${fi}`} f={f}
                  hoveredFastener={hoveredFastener}
                  onHover={setHoveredFastener}
                  onLeave={() => setHoveredFastener(null)} />
              ));
            })}

            {/* ─── Callout line (desktop, selected zone) ────── */}
            {!isMobile && selectedZone && (() => {
              const cx = (selectedZone.x + selectedZone.w / 2) / 100 * SVG_W;
              const cy = (selectedZone.y + selectedZone.h / 2) / 100 * SVG_H;
              const lineLen = SVG_W - cx;
              return (
                <g>
                  {/* Horizontal line to right edge */}
                  <line x1={cx} y1={cy} x2={SVG_W} y2={cy}
                    stroke={HUD.cyan} strokeWidth="1"
                    strokeDasharray="4 3"
                    strokeDashoffset={lineDrawn ? '0' : `${lineLen}`}
                    style={{ transition: `stroke-dashoffset 0.5s ease-out`, animation: lineDrawn ? 'bp-march 0.8s linear infinite' : 'none' }}
                    opacity={lineDrawn ? 0.6 : 0} />
                  {/* Source dot at zone center */}
                  <circle cx={cx} cy={cy} r={3} fill={HUD.cyan} opacity={lineDrawn ? 0.9 : 0}
                    style={{ transition: 'opacity 0.3s ease 0.2s' }} />
                  {/* Endpoint diamond at SVG edge */}
                  <rect x={SVG_W - 5} y={cy - 5} width={10} height={10} rx={1}
                    fill={HUD.bg} stroke={HUD.cyan} strokeWidth="1"
                    transform={`rotate(45 ${SVG_W} ${cy})`}
                    opacity={lineDrawn ? 1 : 0}
                    style={{ transition: 'opacity 0.3s ease 0.4s' }} />
                </g>
              );
            })()}

            {/* ─── Scan line on mount ────────────────── */}
            {!scanDone && (
              <g style={{ animation: 'bp-scan 1.3s ease-out forwards' }}>
                <rect x={0} y={-4} width={SVG_W} height={8} fill="none"
                  stroke={HUD.cyan} strokeWidth="1" opacity="0.6" />
                <rect x={0} y={0} width={SVG_W} height={3}
                  fill={`url(#scan-grad)`} opacity="0.15" />
                <defs>
                  <linearGradient id="scan-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={HUD.cyan} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={HUD.cyan} stopOpacity="0" />
                  </linearGradient>
                </defs>
              </g>
            )}

          </svg>

          {/* Radial Menu */}
          {radialMenu && (
            <RadialMenu
              zone={radialMenu.zone}
              x={radialMenu.x}
              y={radialMenu.y}
              hasCharm={vehicle.year >= 1982 && vehicle.year <= 2013}
              onClose={() => setRadialMenu(null)}
              onInfo={() => { setSelectedZone(radialMenu.zone); setRadialMenu(null); }}
              onProject={() => {
                setSelectedZone(radialMenu.zone);
                setRadialMenu(null);
              }}
              onAsk={() => {
                openRatchetPanel(`Tell me about the ${radialMenu.zone.name} on my ${vehicleLabel}. What are the most important things to know about maintaining and diagnosing this system${mileage ? ` at ${mileage.toLocaleString()} miles` : ''}?`);
                setRadialMenu(null);
              }}
              onManual={() => {
                setSelectedZone(radialMenu.zone);
                setRadialMenu(null);
              }}
            />
          )}
        </div>

        {/* ─── Desktop right panel ──────────────── */}
        {!isMobile && (
          <div className="flex-1 border-l" style={{ borderColor: HUD.border, minWidth: 260, maxWidth: 380, overflow: 'hidden' }}>

            {selectedZone ? (
              <DetailPanel
                zone={selectedZone}
                vehicle={vehicle}
                vehicleId={vehicleId}
                mileage={mileage}
                dtcRecords={dtcRecords}
                onClose={() => setSelectedZone(null)}
                onAsk={(msg: string) => openRatchetPanel(msg)}
                onCharm={handleCharm}
                generatingComponent={generatingComponent}
                setGeneratingComponent={setGeneratingComponent}
                queryClient={queryClient}
                navigate={navigate}
              />
            ) : (
              <StatusOverview mileage={mileage} />
            )}
          </div>
        )}
      </div>

      {/* ─── Mobile bottom sheet ──────────────────── */}
      {isMobile && selectedZone && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelectedZone(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl overflow-hidden"
            style={{ height: '78vh', background: '#060f1e', border: `1px solid ${HUD.border}`, borderBottom: 'none', animation: 'bp-fadein 0.25s ease-out' }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: HUD.border }} />
            </div>
            <DetailPanel
              zone={selectedZone}
              vehicle={vehicle}
              vehicleId={vehicleId}
              mileage={mileage}
              dtcRecords={dtcRecords}
              onClose={() => setSelectedZone(null)}
              onAsk={(msg: string) => { setSelectedZone(null); openRatchetPanel(msg); }}
              onCharm={handleCharm}
              generatingComponent={generatingComponent}
              setGeneratingComponent={setGeneratingComponent}
              queryClient={queryClient}
              navigate={navigate}
            />
          </div>
        </>
      )}

      {/* ─── Charm Sheet ─────────────────────────── */}
      {charmSheet && (
        <>
          <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setCharmSheet(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-2xl overflow-hidden flex flex-col"
            style={{ height: '82vh', background: '#060f1e', border: `1px solid ${HUD.border}`, borderBottom: 'none' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: HUD.border }} />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b shrink-0" style={{ borderColor: HUD.border }}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)' }}>
                  <BookOpen className="h-4.5 w-4.5" style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <p className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>Factory Service Manual</p>
                  <p className="text-[10px] font-mono" style={{ color: HUD.textMuted }}>{charmSheet.compName} · {vehicleLabel}</p>
                </div>
              </div>
              <button onClick={() => setCharmSheet(null)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5">
                <X className="h-4 w-4" style={{ color: HUD.textMuted }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {charmSheet.data.images?.length > 0 && (
                <div className="space-y-3">
                  {charmSheet.data.images.slice(0, 10).map((img: string, i: number) => (
                    <div key={i} className="rounded-xl overflow-hidden border" style={{ background: '#0a0a0a', borderColor: HUD.border }}>
                      <img src={img} alt={`Factory diagram ${i + 1}`} className="w-full block"
                        style={{ maxHeight: 300, objectFit: 'contain', padding: 12 }} loading="lazy" />
                    </div>
                  ))}
                </div>
              )}
              {charmSheet.data.procedureText && (
                <div className="space-y-1">
                  {charmSheet.data.procedureText.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{line}</p>
                  ))}
                </div>
              )}
              {charmSheet.data.torqueSpecs?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-mono tracking-widest uppercase" style={{ color: HUD.textMuted }}>Torque Specifications</p>
                  <div className="flex flex-wrap gap-2">
                    {charmSheet.data.torqueSpecs.map((ts: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-sm"
                        style={{ background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.3)`, color: HUD.amber }}>
                        🔩 {ts.context ? `${ts.context}: ` : ''}{ts.value} {ts.unit}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
                <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: '#a78bfa' }} />
                <span className="text-[10px] font-mono" style={{ color: HUD.textMuted }}>Source: Operation CHARM (charm.li) — Factory Service Manual</span>
                {charmSheet.data.charmUrl && (
                  <a href={charmSheet.data.charmUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-[10px] font-mono flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: '#a78bfa' }}>
                    charm.li <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-mono font-bold transition-all hover:opacity-90"
                style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#f97316' }}
                onClick={() => {
                  const jobDescription = `Replace ${charmSheet.compName} on ${vehicleLabel}${vehicle.engine ? ` ${vehicle.engine}` : ''}`;
                  const compName = charmSheet.compName;
                  setCharmSheet(null);
                  setSelectedZone(null);
                  toast.info('Generating project from factory procedure...');
                  invokeWithAuth('generate-project', { vehicleId, jobDescription }).then(resp => {
                    if (resp.error) throw resp.error;
                    const result = resp.data as any;
                    if (result?.error) throw new Error(result.error);
                    const projectId = result?.project?.id;
                    if (projectId) {
                      ['projects', 'all-projects', 'active-projects', 'all-project-steps-summary', 'all-project-parts-summary']
                        .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
                      toast.success('Project created from factory procedure!');
                      navigate(`/garage/${vehicleId}/projects/${projectId}`);
                    }
                  }).catch((err: any) => toast.error(err?.message || "Couldn't create project"));
                }}>
                <Wrench className="h-4 w-4" />
                CREATE PROJECT FROM THIS
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
