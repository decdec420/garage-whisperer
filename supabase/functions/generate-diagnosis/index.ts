import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Ratchet — your mechanic buddy.

You are generating a DIAGNOSTIC procedure, not a repair. Your job is to build
a structured, efficient test sequence that systematically eliminates possible
causes and confirms the root cause of the reported symptom on this specific vehicle.

You think like a master diagnostic technician: most people describe the symptom,
not the cause. Find the actual cause through logical, efficient testing —
starting with the most statistically common failure for this vehicle and mileage,
using the simplest tests first, escalating only when needed.

Return ONLY a single valid JSON object. No markdown. No explanation. No text before
or after. Start with { and end with }.

Required JSON structure:
{
  "title": "Diagnose: [specific symptom] — [year] [make] [model]",
  "difficulty": "Beginner|Intermediate|Advanced|Expert",
  "estimatedMinutes": 45,
  "possibleCauses": [
    "Most likely cause — specific (e.g. 'Weak or failed battery' not 'electrical issue')",
    "Second most likely",
    "Third",
    "Less common but possible"
  ],
  "safetyWarnings": ["Safety warning specific to this diagnostic process"],
  "tools": [
    {"name": "Tool name", "spec": "Exact size/type or null", "required": true}
  ],
  "steps": [
    {
      "number": 1,
      "title": "Verb first — what to check (e.g. 'Test battery resting voltage')",
      "description": "Detailed instructions for this specific test on this specific vehicle.",
      "systemTesting": "System being tested (e.g. Battery/Electrical, Fuel, Ignition)",
      "expectedResult": "Exactly what you see/measure if HEALTHY. Specific numbers required.",
      "failureIndicator": "Exactly what you see/measure if this IS the problem. Specific.",
      "accessPath": {
        "required": true,
        "steps": [
          "First component to remove — exact fastener: 1x 10mm clamp",
          "Second component — exact fasteners: 3x 10mm bolts",
          "Target component now accessible"
        ],
        "note": "Commonly missed thing on this specific vehicle"
      },
      "componentHardware": {
        "fasteners": [
          {"count": 2, "size": "14mm", "type": "bolt",
           "location": "upper — accessible from top once access path cleared"},
          {"count": 2, "size": "14mm", "type": "bolt",
           "location": "lower — accessible from underneath"}
        ],
        "totalCount": "2 bolts",
        "note": "These 2 bolts are the ONLY fasteners on the component itself"
      },
      "accessHardware": {
        "components": [
          {
            "name": "Air intake hose",
            "fasteners": [{"count": 1, "size": "10mm", "type": "clamp"}]
          },
          {
            "name": "Air box assembly",
            "fasteners": [{"count": 3, "size": "10mm", "type": "bolt"}]
          },
          {
            "name": "Intake manifold brace bracket",
            "fasteners": [{"count": 1, "size": "12mm", "type": "bolt"}],
            "note": "Easy to miss — looks like engine bolt, not manifold bolt"
          }
        ],
        "note": "These fasteners belong to ACCESS PATH components, NOT to the target component. Never call these 'starter bolts' or combine them with component hardware count."
      },
      "torqueSpecs": [],
      "subSteps": ["Individual action", "Next action"],
      "tip": "Vehicle-specific insight or null",
      "safetyNote": "Step-level safety warning or null",
      "estimatedMinutes": 5,
      "eliminates": ["Exact string from possibleCauses ruled out if test PASSES"],
      "confirms": ["Exact string from possibleCauses confirmed if test FAILS"]
    }
  ]
}

CRITICAL HARDWARE RULE — the most important precision rule:
COMPONENT HARDWARE = fasteners that hold THIS part to the vehicle.
ACCESS HARDWARE = fasteners on OTHER components you move to REACH it.
These are ALWAYS in separate fields. NEVER combined. NEVER added together.

Correct for K24 Accord starter:
  componentHardware.totalCount: "2 bolts" (the 2 bolts that hold the starter)
  accessHardware: air intake (1 clamp) + air box (3 bolts) + manifold bracket (1 bolt)

Wrong (what every generic source does):
  "The starter has 5 bolts" — this is false and causes stripped threads

If you don't know the exact count for this specific vehicle: say so explicitly.
Tell the user to count and photograph every fastener before removing anything.
Never guess fastener counts.

STEP ORDERING RULES:
- Most common failure for THIS vehicle at THIS mileage first
- Simple tests before complex: visual → electrical → teardown
- Basic tools before specialty tools
- Flag when a scan tool is required vs basic OBD reader

FIRST STEP: Always visual inspection when symptom has visible indicators
LAST STEP: Always "Confirm root cause and plan next steps"

SOUND-BASED DIAGNOSIS:
When symptom includes a sound (knock, tick, rattle, grind, squeal, whine,
clunk, hiss, click, rumble, pop, screech) — Step 1 must characterize the
sound precisely to distinguish between similar-sounding failures:
- Tick vs knock: tick speeds with RPM at all temps, knock is worst cold or under load
- Rattle vs clunk: rattle is rapid/multiple, clunk is single heavy impact
- Squeal vs screech: squeal is consistent belt/brake, screech is acute metal contact

CONDITION-BASED ORDERING:
Reorder possible causes based on WHEN the symptom occurs:
- Cold start only → thermal issues, oil pressure delay, battery/starter
- Under acceleration → fuel delivery, ignition, motor mounts, drivetrain
- Braking only → brakes, wheel bearings, front suspension
- Turning only → CV axles, power steering, wheel bearings, struts
- Highway speed → wheel balance, tire, driveshaft, wheel bearing
- Idling → vacuum leaks, idle air control, fuel pressure, injectors

SYSTEM INTERDEPENDENCY — flag in tip field:
- A/C compressor seizure causes belt slip that looks like alternator failure
- Misfires cause catalytic damage — don't drive on confirmed misfires
- P0420 on high-mileage Hondas is almost never the converter itself

TONE: Write like a knowledgeable friend, not a manual. Direct, plain English.
If there's a common mistake on this test for this vehicle, say it clearly.`;

// --- Charm.li / factory manual helpers (copied from generate-project) ---

const R = "Repair%20and%20Diagnosis/";

const JOB_KEYWORD_MAP: Record<string, string | string[]> = {
  "front brake pad": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
  "rear brake pad": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  "brake pads": [
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  ],
  "brake": `${R}Brakes%20and%20Traction%20Control`,
  "starter": `${R}Starting%20and%20Charging/Starter/Service%20and%20Repair`,
  "alternator": `${R}Starting%20and%20Charging/Generator/Alternator/Service%20and%20Repair`,
  "battery": `${R}Starting%20and%20Charging/Battery/Service%20and%20Repair`,
  "won't start": `${R}Starting%20and%20Charging`,
  "no start": `${R}Starting%20and%20Charging`,
  "crank": `${R}Starting%20and%20Charging`,
  "click": `${R}Starting%20and%20Charging`,
  "catalytic converter": `${R}Powertrain%20Management/Emission%20Control%20Systems/Catalytic%20Converter/Service%20and%20Repair`,
  "oxygen sensor": `${R}Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair`,
  "o2 sensor": `${R}Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair`,
  "check engine": `${R}Powertrain%20Management`,
  "misfire": `${R}Powertrain%20Management/Ignition%20System`,
  "rough idle": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction`,
  "idle": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction`,
  "stall": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction`,
  "overheat": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System`,
  "coolant": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System`,
  "thermostat": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Thermostat/Service%20and%20Repair`,
  "radiator": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator/Service%20and%20Repair`,
  "water pump": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Water%20Pump/Service%20and%20Repair`,
  "vtec": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Actuators%20and%20Solenoids%20-%20Engine/Variable%20Valve%20Timing%20Solenoid`,
  "oil leak": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication`,
  "oil": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication`,
  "transmission": `${R}Transmission%20and%20Drivetrain`,
  "vibration": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount/Service%20and%20Repair`,
  "engine mount": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount/Service%20and%20Repair`,
  "ac": `${R}Heating%20and%20Air%20Conditioning`,
  "air conditioning": `${R}Heating%20and%20Air%20Conditioning`,
  "fuel": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction`,
  "spark plug": `${R}Powertrain%20Management/Ignition%20System/Spark%20Plug/Service%20and%20Repair`,
  "ignition": `${R}Powertrain%20Management/Ignition%20System`,
  "serpentine belt": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt/Service%20and%20Repair`,
  "drive belt": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt/Service%20and%20Repair`,
  "noise": `${R}Engine%2C%20Cooling%20and%20Exhaust`,
  "power steering": `${R}Steering%20and%20Suspension/Steering/Power%20Steering/Service%20and%20Repair`,
  "abs": `${R}Brakes%20and%20Traction%20Control/Anti-Lock%20Brakes`,
  "wheel bearing": `${R}Steering%20and%20Suspension/Front%20Suspension/Wheel%20Bearing/Service%20and%20Repair`,
  "suspension": `${R}Steering%20and%20Suspension`,
  "strut": `${R}Steering%20and%20Suspension/Front%20Suspension/Strut/Service%20and%20Repair`,
};

function matchJobKeyword(job: string): string | string[] | null {
  const lower = job.toLowerCase();
  let best: string | string[] | null = null;
  let bestLen = 0;
  for (const [kw, path] of Object.entries(JOB_KEYWORD_MAP)) {
    if (lower.includes(kw) && kw.length > bestLen) { best = path; bestLen = kw.length; }
  }
  return best;
}

const STANDARD_DISPLACEMENTS = [1.0, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 3.0, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 4.0, 4.2, 4.3, 4.6, 4.7, 5.0, 5.3, 5.4, 5.7, 6.0, 6.2, 6.4, 6.6, 6.7, 7.0, 7.3];

function roundDisplacement(raw: number): string {
  let closest = STANDARD_DISPLACEMENTS[0];
  let minDiff = Math.abs(raw - closest);
  for (const std of STANDARD_DISPLACEMENTS) {
    const diff = Math.abs(raw - std);
    if (diff < minDiff) { closest = std; minDiff = diff; }
  }
  return closest.toFixed(1);
}

function titleCaseMake(make: string): string {
  if (make.length <= 3) return make.toUpperCase();
  return make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
}

function formatEngineForCharm(engine: string | null, model: string): string {
  if (!engine) return model;
  const dm = engine.match(/(\d+\.?\d*)\s*L/i);
  const rawD = dm ? parseFloat(dm[1]) : null;
  const d = rawD ? roundDisplacement(rawD) : null;
  let c = '';
  if (/V\s*6|V6/i.test(engine)) c = 'V6';
  else if (/V\s*8|V8/i.test(engine)) c = 'V8';
  else if (/I\s*4|L4|4[\s-]?cyl|inline[\s-]?4/i.test(engine)) c = 'L4';
  else if (/I\s*6|L6|inline[\s-]?6/i.test(engine)) c = 'L6';
  if (d && c) return `${model} ${c}-${d}L`;
  if (d) return `${model} ${d}L`;
  return model;
}

function extractImages(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[1];
    if (src.includes('charm.li/images') || (src.includes('/images/') && !src.includes('/icons/'))) {
      images.push(src.startsWith('http') ? src : `https://charm.li${src.startsWith('/') ? '' : '/'}${src}`);
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
  if (vehicle.year < 1982 || vehicle.year > 2013) return null;
  const pathResult = matchJobKeyword(symptom);
  if (!pathResult) return null;

  const paths = Array.isArray(pathResult) ? pathResult : [pathResult];
  const charmModel = formatEngineForCharm(vehicle.engine, vehicle.model);
  const encodedModel = encodeURIComponent(charmModel);

  let allImages: string[] = [];
  let allText = '';
  let allTorqueSpecs: any[] = [];
  const fetchedUrls: string[] = [];

  for (const path of paths) {
    const charmUrl = `https://charm.li/${titleCaseMake(vehicle.make)}/${vehicle.year}/${encodedModel}/${path}/`;

    const { data: cached } = await supabase.from("charm_cache").select("*").eq("charm_url", charmUrl).single();
    if (cached) {
      const fetchedAt = new Date(cached.fetched_at);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      if (fetchedAt > cutoff && (cached.procedure_text?.length > 50 || (cached.images?.length > 0))) {
        allText += `\n\n--- FACTORY PROCEDURE (${decodeURIComponent(path.split('/').pop() || path)}) ---\n${cached.procedure_text || ''}`;
        allImages.push(...(cached.images || []));
        allTorqueSpecs.push(...(cached.torque_specs || []));
        fetchedUrls.push(charmUrl);
        continue;
      }
    }

    try {
      console.log(`Fetching charm.li: ${charmUrl}`);
      const resp = await fetch(charmUrl, { headers: { "User-Agent": "RatchetApp/1.0" } });
      if (!resp.ok) { console.log(`Charm.li ${resp.status} for ${charmUrl}`); continue; }
      const html = await resp.text();

      const images = extractImages(html);
      const procedureText = extractProcedureText(html);
      const torqueSpecs = extractTorqueSpecs(procedureText);

      if (procedureText.length < 50 && images.length === 0) continue;

      if (cached) {
        await supabase.from("charm_cache").update({ images, procedure_text: procedureText, torque_specs: torqueSpecs, fetched_at: new Date().toISOString() }).eq("id", cached.id);
      } else {
        await supabase.from("charm_cache").insert({ charm_url: charmUrl, images, procedure_text: procedureText, torque_specs: torqueSpecs });
      }

      allText += `\n\n--- FACTORY PROCEDURE (${decodeURIComponent(path.split('/').pop() || path)}) ---\n${procedureText}`;
      allImages.push(...images);
      allTorqueSpecs.push(...torqueSpecs);
      fetchedUrls.push(charmUrl);
    } catch (e) {
      console.error(`Charm fetch failed for ${charmUrl}:`, e);
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { vehicleId, symptom, diagnosisId } = await req.json();

    // --- Input validation ---
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!vehicleId || !UUID_RE.test(vehicleId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing vehicleId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!symptom || typeof symptom !== "string" || symptom.trim().length === 0 || symptom.length > 500) {
      return new Response(JSON.stringify({ error: "symptom must be 1-500 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (diagnosisId && !UUID_RE.test(diagnosisId)) {
      return new Response(JSON.stringify({ error: "Invalid diagnosisId format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicleId)
      .eq("user_id", userId)
      .single();

    if (vErr || !vehicle) {
      return new Response(JSON.stringify({ error: "Vehicle not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // --- Fetch factory manual data ---
    const charmData = await fetchCharmData(supabase, vehicle, symptom);

    let manualData: any = null;
    try {
      const manualResp = await fetch(`${supabaseUrl}/functions/v1/fetch-manual-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
        body: JSON.stringify({ jobKeyword: symptom, vehicleYear: vehicle.year }),
      });
      if (manualResp.ok) {
        manualData = await manualResp.json();
        if (!manualData?.found) manualData = null;
      }
    } catch (e) {
      console.error("Manual data fetch failed (non-fatal):", e);
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

    let factorySystemAddition = '';
    if (hasFactoryData && mergedText.length > 0) {
      const torqueLines = mergedTorque
        .map((ts: any) => `${ts.context}: ${ts.value} ${ts.unit}`)
        .join('\n');

      const imageList = mergedImages.map((url: string, idx: number) =>
        `[Image ${idx}]: ${url}`
      ).join('\n');

      factorySystemAddition = `\n\n## ${vehicle.make} Factory Service Manual — Reference Data

The following factory data is available for reference during diagnostic steps:

FACTORY PROCEDURE TEXT:
${mergedText.join('\n\n').slice(0, 16000)}

${torqueLines ? `CONFIRMED TORQUE SPECS FROM FACTORY MANUAL:\n${torqueLines}` : ''}

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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + factorySystemAddition },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    let plan: any;
    try {
      plan = JSON.parse(content);
    } catch {
      const retryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                SYSTEM_PROMPT + factorySystemAddition +
                "\n\nCRITICAL: Return ONLY raw JSON. No markdown fences. No explanation. Start with { and end with }. Nothing else.",
            },
            { role: "user", content: userMessage },
          ],
        }),
      });
      const retryData = await retryResp.json();
      let rc = retryData.choices?.[0]?.message?.content || "";
      rc = rc
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      plan = JSON.parse(rc);
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
        if (typeof s.factoryImageIndex === 'number' && s.factoryImageIndex >= 0 && s.factoryImageIndex < stepImages.length) {
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

    // Link to diagnosis session — use "name" field (not "cause")
    if (diagnosisId) {
      await supabase
        .from("diagnosis_sessions")
        .update({
          project_id: project.id,
          tree_data: plan.possibleCauses
            ? plan.possibleCauses.map((c: string) => ({ name: c, status: "untested" }))
            : [],
        })
        .eq("id", diagnosisId);
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
        charmData: hasFactoryData ? {
          charmUrl: factorySourceUrl,
          imageCount: mergedImages.length,
          hasFactoryData: true,
        } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-diagnosis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
