import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";



const SYSTEM_PROMPT = `You are Ratchet — your mechanic buddy.

You are building a DIAGNOSTIC procedure. Your job is to find the actual cause
through systematic testing, starting with what a seasoned mechanic would check first.

Return ONLY valid JSON. No markdown. No explanation. Start with { end with }.

---

## THE 7 REASONING FRAMEWORKS — ACTIVE ON EVERY DIAGNOSIS

### 1. Physical Verification Principle
Before listing any possible cause, verify the failure mechanism physically produces
the described symptom. If a component cannot physically make that sound, smell, or
behavior — it does not appear in possibleCauses. Period.

VTC actuator cannot produce grinding. It physically rattles via oil-pressure vane
mechanism. Starter Bendix gear mesh IS grinding. Physical verification eliminates
VTC from a grinding symptom before any other analysis runs.

### 2. Systems Cascade Theory
Find root causes, not downstream symptoms. Every possibleCause should be a root
cause, not a secondary effect.

WRONG possibleCause: "Catalytic converter failure"
RIGHT possibleCause: "VTEC solenoid gasket leak fouling downstream O2 sensor"
The converter is the symptom. The gasket is the cause.

When listing possibleCauses, always ask: "What would cause THIS to fail?"
If the answer is another component, that other component is the real cause.

Flag cascade chains in the tip field of relevant steps.

### 3. Thermal Dynamics as Diagnostic Dimension
Temperature behavior is a primary diagnostic filter, not secondary context.

COLD-ONLY symptoms = different failure category than HOT-ONLY symptoms.
Include temperature-specific test conditions in step descriptions.
"Test this when the engine is cold" vs "Test after 15 minutes of driving"
are completely different diagnostic moments.

Use thermal behavior to split possibleCauses into categories when relevant.

### 4. Bayesian Elimination
Each test step recalculates the probability distribution across all possibleCauses.
The "eliminates" and "confirms" fields on each step drive this.

When battery tests good on a click-no-start, starter probability jumps from 30%
to 70%. The eliminates/confirms fields must accurately reflect these shifts.

Every step must have meaningful eliminates and/or confirms entries.
A step that doesn't change the probability distribution is a wasted step.

### 5. Information-Cost Ordering
Steps are ordered by: highest diagnostic information per dollar and minute spent.

The hierarchy: Look → Listen → Smell → Feel → Measure → Scan → Disassemble.

Free visual inspection before $0 multimeter test.
$0 multimeter test before $50 scan tool diagnosis.
$50 scan tool before $200 teardown inspection.

A step that costs nothing and eliminates 2 causes comes before a step that
costs $100 and eliminates 1 cause. Always.

### 6. Module Architecture Reasoning (2015+ vehicles)
On CAN-bus vehicles, one root cause can trigger codes across multiple modules.

When the symptom includes multiple codes across different systems on a 2015+ vehicle:
- possibleCauses should include "CAN-bus communication fault" and "Power/ground integrity"
- First diagnostic steps should check shared infrastructure before module-specific testing
- The tip field should note: "Multiple module codes often = single root cause"

### 7. Sensor Plausibility Reasoning
When the symptom involves sensor data or codes, include a plausibility check step.

If a sensor reading violates physics (MAF reading 2g/s at WOT, coolant temp -40°F
in summer, O2 stuck at 0.45V), the sensor or circuit is the first suspect.

Include sensor plausibility checks as early steps when DTC codes are part of the symptom.
Cross-reference the reading against what's physically possible.

---

## INPUT NORMALIZATION

Real people describe problems vaguely. Normalize before diagnosing:

"Car won't start" → Classify: crank-no-start, click-no-start, no-crank-no-start, or starts-then-dies
"Making a noise" → Classify by sound type using the routing matrix below
"Running rough" → Classify: idle-only, under-load, all-conditions, cold-only, hot-only
"Check engine light" → Codes are required. Without codes, test by symptom.
"Feels weird" → Classify: vibration, pulling, resistance, intermittent

When the symptom description is ambiguous, generate the diagnostic plan for the
most likely interpretation but note the ambiguity in the first step's description.

---

## SOUND-FIRST DIAGNOSTIC ROUTING — ALWAYS RUNS BEFORE ANYTHING ELSE

The sound type is the primary diagnostic signal. It identifies which system to
investigate first. Vehicle-specific patterns and condition context narrow the
diagnosis WITHIN that system. They never override the sound-based routing.

GRINDING → MECHANICAL GEAR MESH OR METAL-TO-METAL CONTACT
This sound means something is being destroyed right now.
Priority order by condition:
  ON STARTUP/CRANKING: Starter Bendix drive gear or ring gear/flexplate teeth.
  This is cause #1 always. Not VTC actuator (rattle, not grind). Not timing chain
  (rattle/whir, not grind). Those make completely different sounds.
  WHILE DRIVING: Wheel bearing (speed-proportional) or brake pad through to rotor.
  WHEN TURNING: CV axle joint or wheel bearing under load.
  INTERMITTENT: Debris in brake system, worn gear teeth engaging irregularly.

RATTLE → LOOSE MASS, CHAIN TENSION, WORN MOUNTS
Distinct from grinding. Multiple rapid impacts, not sustained metal contact.
  COLD START, CLEARS IN SECONDS: Timing chain tensioner starved of cold oil pressure.
  On K24/K-series: VTC actuator is the specific component.
  RATTLE UNDER HOOD CONSTANT: Heat shield loose on exhaust. Positional.
  RATTLE OVER BUMPS: Sway bar end link, loose brake caliper, strut mount.
  RATTLE FROM DASHBOARD: Interior trim. Not engine.

KNOCK → INTERNAL COMBUSTION OR BEARING FAILURE
The most serious sound category. Treat with urgency until proven otherwise.
  DEEP KNOCK, WORSENS UNDER LOAD: Rod bearing or main bearing. Stop driving now.
  LIGHT KNOCK, CLEARS WHEN WARM: Piston slap. Common on high-mileage engines.
  KNOCK ON THROTTLE TIP-IN: Detonation. Check timing, fuel octane, carbon buildup.
  KNOCK AT IDLE ONLY: Collapsed lifter, worn cam lobe.

TICK → VALVETRAIN. ALWAYS VALVETRAIN FIRST.
  TICK AT ALL TEMPS, SPEEDS WITH RPM: Valve clearance out of spec.
  TICK WITH P2646/P2647: VTEC solenoid or oil pressure switch circuit. Different fix.
  TICK ONLY ON COLD START: Normal cold oil viscosity. Check level. Usually benign.
  INJECTOR TICK ON DIRECT INJECTION: Normal. Do not chase it.

CLICK ON KEY TURN → STARTING SYSTEM ONLY
  SINGLE LOUD CLICK: Solenoid firing, motor not spinning.
  Battery first always — 3x more common than starter failure.
  RAPID CLICKING: Battery voltage collapsing under load. Battery, not starter.
  NO CLICK: Upstream of solenoid. Neutral safety switch, ignition switch, fuse.

SQUEAL → BELT FRICTION OR BRAKE WEAR INDICATOR
WHINE → ROTATING COMPONENT UNDER LOAD
CLUNK → SUSPENSION, DRIVETRAIN, OR MOTOR MOUNT
HISS → PRESSURIZED FLUID OR VACUUM ESCAPING
RUMBLE → ROTATING MASS. ALWAYS SPEED-PROPORTIONAL IF BEARING.

---

APPLYING THE ROUTING MATRIX — MANDATORY SEQUENCE:

Step 1: Identify sound type from symptom.
Step 2: Matrix identifies PRIMARY SYSTEM.
Step 3: Vehicle-specific knowledge narrows cause WITHIN that system.
Step 4: Condition (cold start, under load, when turning) further narrows.
Step 5: Generate possibleCauses with PRIMARY SYSTEM's most likely cause first.

The matrix is not a suggestion. It is the first filter.
A vehicle-specific common failure NEVER overrides sound-based routing.

---

## GRACEFUL DEGRADATION — UNKNOWN VEHICLES

When you don't have specific data for a vehicle platform:

1. Acknowledge it in the title or first step description.
2. Sound-first routing still applies — physics doesn't change by platform.
3. Use general mechanical principles with explicit uncertainty markers.
4. In componentHardware/accessHardware, use "Verify on your vehicle" instead of guessing counts.
5. Omit torque specs rather than guess them. Note "Consult FSM" instead.
6. Flag in tip fields where platform-specific knowledge would change the approach.

Honest uncertainty > confident wrong answer. Always.

---

## HARDWARE SEPARATION RULE — NON-NEGOTIABLE

COMPONENT HARDWARE = fasteners that hold THIS PART to the vehicle
ACCESS HARDWARE = fasteners on OTHER components you move to REACH it
NEVER COMBINE. NEVER ADD TOGETHER.

Correct for K24 starter:
  componentHardware: 2x 14mm bolts (that's all that holds the starter)
  accessHardware: air intake (1 clamp) + air box (3 bolts) + manifold bracket (1 bolt)

If exact counts are unknown for this specific vehicle:
Say so explicitly. Tell them to count and photograph before removing.
Never guess fastener counts. Wrong counts cause stripped threads and lost bolts.

---

## JSON STRUCTURE

{
  "title": "Diagnose: [symptom] — [year] [make] [model]",
  "difficulty": "Beginner|Intermediate|Advanced|Expert",
  "estimatedMinutes": 45,
  "possibleCauses": ["Most likely first — physically verified, root cause, specific not generic"],
  "safetyWarnings": ["Specific to this diagnostic process"],
  "tools": [{"name": "", "spec": "", "required": true}],
  "steps": [{
    "number": 1,
    "title": "Verb first",
    "description": "Specific to this vehicle. Actual locations. Real access paths.",
    "systemTesting": "System being tested",
    "expectedResult": "Specific numbers. Not vague.",
    "failureIndicator": "Specific numbers. Not vague.",
    "accessPath": {
      "required": true/false,
      "steps": ["1. First thing to move with exact fastener"],
      "note": "Commonly missed thing on this vehicle"
    },
    "componentHardware": {
      "fasteners": [{"count": 2, "size": "14mm", "type": "bolt", "location": "upper"}],
      "totalCount": "2 bolts",
      "note": "These are the ONLY fasteners on the component itself"
    },
    "accessHardware": {
      "components": [{"name": "Air box", "fasteners": [{"count": 3, "size": "10mm", "type": "bolt"}]}],
      "note": "These belong to ACCESS PATH components. Not part of [component]."
    },
    "torqueSpecs": [],
    "subSteps": ["Individual action"],
    "tip": "The thing only experience teaches you. Include cascade warnings here. null if none.",
    "safetyNote": "Step-level safety. null if none.",
    "estimatedMinutes": 5,
    "eliminates": ["Exact string from possibleCauses ruled out if test PASSES"],
    "confirms": ["Exact string from possibleCauses confirmed if test FAILS"]
  }]
}

CRITICAL: possibleCauses strings must match eliminates/confirms strings EXACTLY.
The UI uses string matching to update the diagnostic tree.

---

## STEP ORDERING RULES

1. Sound-first routing determines the primary system
2. Information-Cost Ordering: cheapest/fastest high-info test first
3. Most common failure within that system at this vehicle's mileage
4. Visual → electrical → mechanical → teardown progression
5. Tools the user likely has before specialty tools
6. Flag clearly when a scan tool is required vs basic OBD reader

FIRST STEP: Visual inspection when symptom has visual indicators.
For click-no-start: Battery voltage test is ALWAYS step 1.
LAST STEP: "Confirm root cause and plan next steps"

Every step must have meaningful eliminates and/or confirms entries.
A step that doesn't change the diagnostic picture is a wasted step.

---

## CONDITION-BASED NARROWING (applies WITHIN the sound-based system)

- Cold start: thermal issues, cold oil pressure, metal tolerance changes (Thermal Dynamics)
- Under acceleration: load-bearing components, fuel delivery, mounts
- Braking only: brake system, wheel bearings under deceleration load
- Turning only: CV joints, power steering, wheel bearings under lateral load
- Highway speed: wheel balance, tire condition, driveshaft, high-speed bearings
- Idling: vacuum, idle air control, fuel pressure at low demand

---

## SYSTEM INTERDEPENDENCIES (flag in tip field — Systems Cascade)

- AC compressor seizure → belt slip → looks like alternator failure
- Misfires → catalytic converter damage from unburned fuel. Don't drive on misfires.
- P0420 on Honda: rarely the converter. Check downstream O2 and exhaust leaks first.
- VTEC solenoid leak → oil on downstream O2 sensor → false lean codes
- Motor mount wear → changed CV axle angle → premature CV wear
- Coolant leak → overheat → head gasket — find the source, not the symptom

---

## TONE IN ALL TEXT FIELDS

Knowledgeable friend, not a manual. Direct. Plain English.
If there's a common mistake on this specific test on this specific vehicle, say it.
If a count is commonly wrong in generic sources, say the correct count and explain why.
Lead with the most likely cause. Don't hedge when the answer is clear.`;

// --- Charm.li / factory manual helpers (copied from generate-project) ---

const R = "Repair%20and%20Diagnosis/";

const JOB_KEYWORD_MAP: Record<string, string | string[]> = {
  "front brake pad": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
  "rear brake pad": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  "brake pads": [
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  ],
  brake: `${R}Brakes%20and%20Traction%20Control`,
  starter: `${R}Starting%20and%20Charging/Starter/Service%20and%20Repair`,
  alternator: `${R}Starting%20and%20Charging/Generator/Alternator/Service%20and%20Repair`,
  battery: `${R}Starting%20and%20Charging/Battery/Service%20and%20Repair`,
  "won't start": `${R}Starting%20and%20Charging`,
  "no start": `${R}Starting%20and%20Charging`,
  crank: `${R}Starting%20and%20Charging`,
  click: `${R}Starting%20and%20Charging`,
  "catalytic converter": `${R}Powertrain%20Management/Emission%20Control%20Systems/Catalytic%20Converter/Service%20and%20Repair`,
  "oxygen sensor": `${R}Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair`,
  "o2 sensor": `${R}Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair`,
  "check engine": `${R}Powertrain%20Management`,
  misfire: `${R}Powertrain%20Management/Ignition%20System`,
  "rough idle": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction`,
  idle: `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction`,
  stall: `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction`,
  overheat: `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System`,
  coolant: `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System`,
  thermostat: `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Thermostat/Service%20and%20Repair`,
  radiator: `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator/Service%20and%20Repair`,
  "water pump": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Water%20Pump/Service%20and%20Repair`,
  vtec: `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Actuators%20and%20Solenoids%20-%20Engine/Variable%20Valve%20Timing%20Solenoid`,
  "oil leak": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication`,
  oil: `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication`,
  transmission: `${R}Transmission%20and%20Drivetrain`,
  vibration: `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount/Service%20and%20Repair`,
  "engine mount": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount/Service%20and%20Repair`,
  ac: `${R}Heating%20and%20Air%20Conditioning`,
  "air conditioning": `${R}Heating%20and%20Air%20Conditioning`,
  fuel: `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction`,
  "spark plug": `${R}Powertrain%20Management/Ignition%20System/Spark%20Plug/Service%20and%20Repair`,
  ignition: `${R}Powertrain%20Management/Ignition%20System`,
  "serpentine belt": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt/Service%20and%20Repair`,
  "drive belt": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt/Service%20and%20Repair`,
  noise: `${R}Engine%2C%20Cooling%20and%20Exhaust`,
  "power steering": `${R}Steering%20and%20Suspension/Steering/Power%20Steering/Service%20and%20Repair`,
  abs: `${R}Brakes%20and%20Traction%20Control/Anti-Lock%20Brakes`,
  "wheel bearing": `${R}Steering%20and%20Suspension/Front%20Suspension/Wheel%20Bearing/Service%20and%20Repair`,
  suspension: `${R}Steering%20and%20Suspension`,
  strut: `${R}Steering%20and%20Suspension/Front%20Suspension/Strut/Service%20and%20Repair`,
};

function matchJobKeyword(job: string): string | string[] | null {
  const lower = job.toLowerCase();
  let best: string | string[] | null = null;
  let bestLen = 0;
  for (const [kw, path] of Object.entries(JOB_KEYWORD_MAP)) {
    if (lower.includes(kw) && kw.length > bestLen) {
      best = path;
      bestLen = kw.length;
    }
  }
  return best;
}

const STANDARD_DISPLACEMENTS = [
  1.0, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 3.0, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 4.0,
  4.2, 4.3, 4.6, 4.7, 5.0, 5.3, 5.4, 5.7, 6.0, 6.2, 6.4, 6.6, 6.7, 7.0, 7.3,
];

function roundDisplacement(raw: number): string {
  let closest = STANDARD_DISPLACEMENTS[0];
  let minDiff = Math.abs(raw - closest);
  for (const std of STANDARD_DISPLACEMENTS) {
    const diff = Math.abs(raw - std);
    if (diff < minDiff) {
      closest = std;
      minDiff = diff;
    }
  }
  return closest.toFixed(1);
}

function titleCaseMake(make: string): string {
  if (make.length <= 3) return make.toUpperCase();
  return make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
}

function normalizeDrivetrain(dt: string | null | undefined): string | null {
  if (!dt) return null;
  const u = dt.toUpperCase().replace(/[\s-]/g, '');
  if (u === 'FWD' || u.includes('FRONTWHEEL')) return 'FWD';
  if (u === 'RWD' || u.includes('REARWHEEL')) return 'RWD';
  if (u === 'AWD' || u.includes('ALLWHEEL')) return 'AWD';
  if (u === '4WD' || u === '4X4' || u.includes('FOURWHEEL')) return '4WD';
  if (u === '2WD' || u === '2X4' || u.includes('TWOWHEEL')) return '2WD';
  return null;
}

function formatEngineForManual(engine: string | null, model: string, drivetrain?: string | null): string {
  const dt = normalizeDrivetrain(drivetrain);
  if (!engine) return dt ? `${model} ${dt}` : model;
  const dm = engine.match(/(\d+\.?\d*)\s*L/i);
  const rawD = dm ? parseFloat(dm[1]) : null;
  const d = rawD ? roundDisplacement(rawD) : null;
  let c = '';
  if (/V\s*6|V6/i.test(engine)) c = 'V6';
  else if (/V\s*8|V8/i.test(engine)) c = 'V8';
  else if (/I\s*4|L4|4[\s-]?cyl|inline[\s-]?4/i.test(engine)) c = 'L4';
  else if (/I\s*6|L6|inline[\s-]?6/i.test(engine)) c = 'L6';
  let enginePart = '';
  if (d && c) enginePart = `${c}-${d}L`;
  else if (d) enginePart = `${d}L`;
  const parts = [model];
  if (dt) parts.push(dt);
  if (enginePart) parts.push(enginePart);
  return parts.join(' ');
}

function extractImages(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[1];
    if (src.includes('lemon-manuals.la/images') || src.includes('/images/') && !src.includes('/icons/')) {
      images.push(src.startsWith('http') ? src : `https://lemon-manuals.la${src.startsWith('/') ? '' : '/'}${src}`);
    }
  }
  return [...new Set(images)];
}

function extractProcedureText(html: string): string {
  let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  const parts: string[] = [];
  const cRe = /<(?:p|li|td|div|span|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|li|td|div|span|h[1-6])>/gi;
  let m;
  while ((m = cRe.exec(cleaned)) !== null) {
    const t = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (t.length > 5) parts.push(t);
  }
  return [...new Set(parts)].join('\n');
}

function extractTorqueSpecs(text: string): any[] {
  const specs: any[] = [];
  const tRe = /(\d+(?:\.\d+)?)\s*(ft[\s·.-]?lb[s]?|N[\s·.-]?m)/gi;
  let m;
  while ((m = tRe.exec(text)) !== null) {
    const start = Math.max(0, m.index - 60);
    const ctx = text.slice(start, m.index).replace(/\n/g, ' ').trim();
    specs.push({ value: m[1], unit: m[2].replace(/[\s·.-]/g, ' ').trim(), context: ctx.split('.').pop()?.trim() || '' });
  }
  return specs;
}

async function fetchCharmData(supabase: any, vehicle: any, symptom: string) {
  if (vehicle.year < 1960 || vehicle.year > 2025) return null;
  const pathResult = matchJobKeyword(symptom);
  if (!pathResult) return null;

  const paths = Array.isArray(pathResult) ? pathResult : [pathResult];
  const manualModel = formatEngineForManual(vehicle.engine, vehicle.model, vehicle.drivetrain);
  const encodedModel = encodeURIComponent(manualModel);

  let allImages: string[] = [];
  let allText = '';
  let allTorqueSpecs: any[] = [];
  const fetchedUrls: string[] = [];

  for (const path of paths) {
    const manualUrl = `https://lemon-manuals.la/${titleCaseMake(vehicle.make)}/${vehicle.year}/${encodedModel}/${path}/`;

    const { data: cached } = await supabase.from("charm_cache").select("*").eq("charm_url", manualUrl).single();
    if (cached) {
      const fetchedAt = new Date(cached.fetched_at);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      if (fetchedAt > cutoff && (cached.procedure_text?.length > 50 || cached.images?.length > 0)) {
        allText += `\n\n--- FACTORY PROCEDURE (${decodeURIComponent(path.split('/').pop() || path)}) ---\n${cached.procedure_text || ''}`;
        allImages.push(...(cached.images || []));
        allTorqueSpecs.push(...(cached.torque_specs || []));
        fetchedUrls.push(manualUrl);
        continue;
      }
    }

    try {
      console.log(`Fetching lemon-manuals: ${manualUrl}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(manualUrl, { signal: controller.signal, headers: { "User-Agent": "RatchetApp/1.0" } });
      clearTimeout(timer);
      if (!resp.ok) { console.log(`lemon-manuals ${resp.status} for ${manualUrl}`); continue; }
      const html = await resp.text();

      const images = extractImages(html);
      const procedureText = extractProcedureText(html);
      const torqueSpecs = extractTorqueSpecs(procedureText);

      if (procedureText.length < 50 && images.length === 0) continue;

      if (cached) {
        await supabase.from("charm_cache").update({ images, procedure_text: procedureText, torque_specs: torqueSpecs, fetched_at: new Date().toISOString() }).eq("id", cached.id);
      } else {
        await supabase.from("charm_cache").insert({ charm_url: manualUrl, images, procedure_text: procedureText, torque_specs: torqueSpecs });
      }

      allText += `\n\n--- FACTORY PROCEDURE (${decodeURIComponent(path.split('/').pop() || path)}) ---\n${procedureText}`;
      allImages.push(...images);
      allTorqueSpecs.push(...torqueSpecs);
      fetchedUrls.push(manualUrl);
    } catch (e) {
      console.error(`Manual fetch failed for ${manualUrl}:`, e);
      continue;
    }
  }

  if (fetchedUrls.length === 0) return null;
  allImages = [...new Set(allImages)];

  return {
    charmUrl: fetchedUrls[0],
    charmUrls: fetchedUrls,
    images: allImages,
    procedureText: allText.trim(),
    torqueSpecs: allTorqueSpecs,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { vehicleId, symptom, diagnosisId } = await req.json();

    // --- Input validation ---
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!vehicleId || !UUID_RE.test(vehicleId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing vehicleId" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (!symptom || typeof symptom !== "string" || symptom.trim().length === 0 || symptom.length > 500) {
      return new Response(JSON.stringify({ error: "symptom must be 1-500 characters" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (diagnosisId && !UUID_RE.test(diagnosisId)) {
      return new Response(JSON.stringify({ error: "Invalid diagnosisId format" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicleId)
      .eq("user_id", userId)
      .single();

    if (vErr || !vehicle) {
      return new Response(JSON.stringify({ error: "Vehicle not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 20 AI-generated diagnoses per user per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentDiagnoses } = await supabase
      .from("diagnosis_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("created_at", oneDayAgo);
    if ((recentDiagnoses ?? 0) >= 20) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 20 diagnoses per day." }), {
        status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (diagnosisId) {
      const { data: diagnosisSession } = await supabase
        .from("diagnosis_sessions")
        .select("id")
        .eq("id", diagnosisId)
        .eq("user_id", userId)
        .eq("vehicle_id", vehicleId)
        .single();

      if (!diagnosisSession) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // --- Parallel fetch: pattern cache + history + charm data + manual data ---
    const symptomLower = symptom.toLowerCase().trim();
    const makeLower = vehicle.make.toLowerCase();
    const modelLower = vehicle.model.toLowerCase();

    const manualAbortCtrl = new AbortController();
    const manualTimeout = setTimeout(() => manualAbortCtrl.abort(), 25000);

    const [patternsResult, historyResult, charmDataResult, manualDataResult] = await Promise.all([
      // 1. Pattern cache
      supabase
        .from("diagnostic_patterns")
        .select("*")
        .ilike("vehicle_make", makeLower)
        .ilike("vehicle_model", modelLower)
        .order("confidence_score", { ascending: false })
        .limit(10)
        .then((r: any) => r.data || []),

      // 2. Vehicle history
      supabase
        .from("diagnosis_sessions")
        .select("symptom, confirmed_cause, status, confidence_score")
        .eq("vehicle_id", vehicleId)
        .eq("user_id", userId)
        .in("status", ["concluded", "completed"])
        .order("created_at", { ascending: false })
        .limit(10)
        .then((r: any) => r.data || [])
        .catch(() => []),

      // 3. Charm/lemon data (direct fetch)
      fetchCharmData(supabase, vehicle, symptom).catch(() => null),

      // 4. Manual data (sub-page crawl via edge function)
      fetch(`${supabaseUrl}/functions/v1/fetch-manual-data`, {
        method: "POST",
        signal: manualAbortCtrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          jobKeyword: symptom,
          vehicleYear: vehicle.year,
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.model,
          vehicleEngine: vehicle.engine,
          vehicleDrivetrain: vehicle.drivetrain,
        }),
      })
        .then(async (r) => { const d = await r.json(); return d?.found ? d : null; })
        .catch(() => null),
    ]);

    clearTimeout(manualTimeout);

    const matchedPatterns = patternsResult;
    const pastDiagnoses = historyResult;
    const charmData = charmDataResult;
    const manualData = manualDataResult;

    // Process patterns
    const relevantPatterns = (matchedPatterns || []).filter((p: any) => {
      const symMatch = symptomLower.includes(p.symptom_normalized) || 
                       p.symptom_normalized.includes(symptomLower) ||
                       symptomLower.split(/\s+/).some((w: string) => w.length > 3 && p.symptom_normalized.includes(w));
      const yearMatch = (!p.vehicle_year_min || vehicle.year >= p.vehicle_year_min) &&
                        (!p.vehicle_year_max || vehicle.year <= p.vehicle_year_max);
      return symMatch && yearMatch;
    });

    const highConfidence = relevantPatterns.filter((p: any) => p.confidence_score >= 0.9 && p.success_count >= 3);
    const moderateConfidence = relevantPatterns.filter((p: any) => p.confidence_score >= 0.5 && p.confidence_score < 0.9);

    let patternContextBlock = "";
    if (relevantPatterns.length > 0) {
      const topPatterns = relevantPatterns.slice(0, 5);
      const lines = topPatterns.map((p: any) => 
        `- "${p.confirmed_cause}" (${Math.round(p.confidence_score * 100)}% success rate, ${p.success_count} confirmed fixes)`
      );
      patternContextBlock = `\n\n## Ratchet's Diagnostic Memory — Past Confirmed Fixes
The following causes have been CONFIRMED by real users fixing this exact issue on similar vehicles:

${lines.join("\n")}

${highConfidence.length > 0 
  ? `HIGH CONFIDENCE: "${highConfidence[0].confirmed_cause}" has a ${Math.round(highConfidence[0].confidence_score * 100)}% success rate across ${highConfidence[0].success_count} confirmed fixes. Prioritize this as the most likely cause and order your diagnostic steps to test it early. Don't skip other causes — but weight this one heavily.`
  : `Use these as informed priors for your Bayesian elimination. Weight these causes higher in your initial probability distribution, but verify through testing.`}
`;
    }

    // Process history
    let userHistoryBlock = "";
    if (pastDiagnoses && pastDiagnoses.length > 0) {
      const historyLines = pastDiagnoses.map((d: any) => 
        `- Symptom: "${d.symptom}" → ${d.confirmed_cause ? `Confirmed: ${d.confirmed_cause}` : `Status: ${d.status}`}`
      );
      userHistoryBlock = `\n\n## This Vehicle's Diagnostic History
Previous diagnoses on this exact vehicle:
${historyLines.join("\n")}

Use this history to identify patterns. If this vehicle has had repeated electrical issues, check grounds first. If there's a history of oil-related problems, consider systemic causes.`;
    }

    // Merge factory data
    const mergedImages: string[] = [];
    const mergedText: string[] = [];
    const mergedTorque: any[] = [];

    if (manualData) {
      mergedImages.push(...(manualData.images || []));
      if (manualData.procedureText) mergedText.push(manualData.procedureText);
      mergedTorque.push(...(manualData.torqueSpecs || []));
    }
    if (charmData) {
      for (const img of charmData.images) {
        if (!mergedImages.includes(img)) mergedImages.push(img);
      }
      if (charmData.procedureText && !manualData) mergedText.push(charmData.procedureText);
      if (!manualData) mergedTorque.push(...(charmData.torqueSpecs || []));
    }

    const hasFactoryData = mergedText.length > 0 || mergedImages.length > 0;
    const factorySourceUrl = manualData?.sourceUrl || charmData?.charmUrl || null;

    let factorySystemAddition = "";
    if (hasFactoryData && mergedText.length > 0) {
      const torqueLines = mergedTorque.map((ts: any) => `${ts.context}: ${ts.value} ${ts.unit}`).join("\n");

      const imageList = mergedImages.map((url: string, idx: number) => `[Image ${idx}]: ${url}`).join("\n");

      factorySystemAddition = `\n\n## ${vehicle.make} Factory Service Manual — Reference Data

The following factory data is available for reference during diagnostic steps:

FACTORY PROCEDURE TEXT:
${mergedText.join("\n\n").slice(0, 16000)}

${torqueLines ? `CONFIRMED TORQUE SPECS FROM FACTORY MANUAL:\n${torqueLines}` : ""}

FACTORY IMAGES AVAILABLE (${mergedImages.length} total):
${imageList}

IMPORTANT: For each step, set "factoryImageIndex" to the 0-based index of the most relevant factory image above. Match images to steps based on what the image shows (e.g. a wiring diagram goes with the electrical test step, an engine bay photo goes with the visual inspection step). Each image should only be assigned to ONE step. Set null if no image fits.`;
    }

    const userMessage = `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}
Engine: ${vehicle.engine || "Unknown"}
Transmission: ${vehicle.transmission || "Unknown"}
Mileage: ${vehicle.mileage ? vehicle.mileage + " miles" : "Unknown"}

Symptom reported: ${symptom}

Generate a complete diagnostic procedure for this exact vehicle and symptom.
Order tests from most likely cause to least likely for THIS specific vehicle/engine combination.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: SYSTEM_PROMPT + patternContextBlock + userHistoryBlock + factorySystemAddition,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      throw new Error(`Anthropic API error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.content?.[0]?.text || "";
    content = content
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    let plan: any;
    try {
      plan = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ error: "Diagnosis generation failed — please try again." }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Save project
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .insert({
        vehicle_id: vehicleId,
        user_id: userId,
        title: plan.title || `Diagnose: ${symptom}`,
        description: `Diagnostic procedure for: ${symptom}`,
        difficulty: plan.difficulty,
        estimated_minutes: plan.estimatedMinutes,
        safety_warnings: plan.safetyWarnings || [],
        ai_generated: true,
        status: "planning",
      })
      .select()
      .single();

    if (projErr) throw projErr;

    // Insert tools
    if (plan.tools?.length) {
      const tools = plan.tools.map((t: any, i: number) => ({
        project_id: project.id,
        name: t.name,
        spec: t.spec || null,
        required: t.required ?? true,
        sort_order: i,
      }));
      await supabase.from("project_tools").insert(tools);
    }

    // Insert steps with factory image assignment
    if (plan.steps?.length) {
      const stepImages = mergedImages;
      const sourceUrl = factorySourceUrl;

      const steps = plan.steps.map((s: any, idx: number) => {
        let assignedImage: string | null = null;
        if (
          typeof s.factoryImageIndex === "number" &&
          s.factoryImageIndex >= 0 &&
          s.factoryImageIndex < stepImages.length
        ) {
          assignedImage = stepImages[s.factoryImageIndex];
        } else if (stepImages[idx]) {
          assignedImage = stepImages[idx] || null;
        }

        return {
          project_id: project.id,
          step_number: s.number,
          title: s.title,
          description:
            s.description +
            (s.expectedResult ? `\n\n✅ Expected (healthy): ${s.expectedResult}` : "") +
            (s.failureIndicator ? `\n\n❌ Failure indicator: ${s.failureIndicator}` : "") +
            (s.eliminates?.length ? `\n\n🔍 Rules out: ${s.eliminates.join(", ")}` : "") +
            (s.confirms?.length ? `\n\n🎯 Confirms: ${s.confirms.join(", ")}` : ""),
          torque_specs: s.torqueSpecs?.length ? s.torqueSpecs : null,
          sub_steps: s.subSteps?.length ? s.subSteps : null,
          tip: s.tip || null,
          safety_note: s.safetyNote || null,
          estimated_minutes: s.estimatedMinutes || null,
          sort_order: s.number,
          notes: JSON.stringify({
            systemTesting: s.systemTesting || null,
            eliminates: s.eliminates || [],
            confirms: s.confirms || [],
          }),
          charm_image_url: assignedImage,
          charm_source_url: sourceUrl,
          is_factory_verified: hasFactoryData,
        };
      });
      await supabase.from("project_steps").insert(steps);
    }

    if (diagnosisId) {
      await supabase
        .from("diagnosis_sessions")
        .update({
          project_id: project.id,
          tree_data: plan.possibleCauses
            ? plan.possibleCauses.map((c: string) => ({ cause: c, status: "untested" }))
            : [],
        })
        .eq("id", diagnosisId)
        .eq("user_id", userId)
        .eq("vehicle_id", vehicleId);
    }

    // Return full project
    const { data: fullProject } = await supabase.from("projects").select("*").eq("id", project.id).single();
    const { data: savedTools } = await supabase
      .from("project_tools")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order");
    const { data: savedSteps } = await supabase
      .from("project_steps")
      .select("*")
      .eq("project_id", project.id)
      .order("step_number");

    return new Response(
      JSON.stringify({
        project: fullProject,
        tools: savedTools,
        steps: savedSteps,
        projectId: project.id,
        possibleCauses: plan.possibleCauses || [],
        charmData: hasFactoryData
          ? {
              charmUrl: factorySourceUrl,
              imageCount: mergedImages.length,
              hasFactoryData: true,
            }
          : null,
        patternMatch: highConfidence.length > 0
          ? {
              confidence: Math.round(highConfidence[0].confidence_score * 100),
              confirmedFixes: highConfidence[0].success_count,
              topCause: highConfidence[0].confirmed_cause,
            }
          : moderateConfidence.length > 0
          ? {
              confidence: Math.round(moderateConfidence[0].confidence_score * 100),
              confirmedFixes: moderateConfidence[0].success_count,
              topCause: moderateConfidence[0].confirmed_cause,
            }
          : null,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-diagnosis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
