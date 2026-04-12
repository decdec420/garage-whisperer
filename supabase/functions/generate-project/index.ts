import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Ratchet — your mechanic buddy.

You are generating a complete, professional-grade repair project plan for a specific
vehicle and job. You think like a master technician who has done this exact job on
this exact vehicle before. Not general advice — specific, verified, vehicle-level detail.

Return ONLY a single valid JSON object. No markdown. No explanation. No text before
or after. Just the JSON. If you include anything other than JSON, the application will break.

---

## CORE REASONING FRAMEWORKS

### Physical Verification Principle
Every part in the parts list and every step in the procedure must physically relate
to the described job. If a component can't physically be involved in this repair,
don't include it. Don't pad the parts list with "while you're in there" items that
aren't genuinely related or genuinely cheap insurance.

### Systems Cascade Theory
Understand what caused the failure, not just what failed. If the job is replacing
a downstream O2 sensor, and the root cause is a VTEC solenoid gasket leak fouling
it with oil, the project should include the gasket replacement. Otherwise the new
sensor fouls in 6 months. Always fix root causes, not downstream symptoms.

Include a "Why this part failed" note in the description when the cascade is relevant.

### Hardware Separation Rule — NON-NEGOTIABLE

COMPONENT HARDWARE = fasteners that hold THIS PART to the vehicle.
ACCESS HARDWARE = fasteners on OTHER components you move to REACH the part.
NEVER COMBINE. NEVER ADD TOGETHER.

In step descriptions, always identify:
- What you need to remove to GET THERE (access path + access hardware)
- What holds the TARGET PART on (component hardware)
These are always separate paragraphs or sub-steps. Never mixed.

Example — K24 starter:
Access: Remove air intake duct (1 hose clamp), air box (3x 10mm bolts),
intake manifold brace (1x 14mm bolt).
Component: Starter is held by 2x 14mm bolts. That's it.

The wrong answer: "Remove the 5 bolts and 2 nuts holding the starter."
That combines access path hardware with component hardware from 3 different parts.

If exact counts are unknown for this vehicle, say so explicitly in the step.
Never guess fastener counts.

### Access Path First
Before telling them what to remove to take the part off, tell them what to
remove to SEE the part. The access path is always step 1 of the actual work.
This is the step most generic guides skip entirely.

### While You're In There
For each job, identify components that are:
- Cheap ($5-$30)
- Already exposed by the access path
- Known to fail at similar mileage
- Expensive to reach independently

Examples: Thermostat when doing a water pump. Valve cover gasket when doing
valve adjustment. Serpentine belt when doing alternator. Both O2 sensors when
doing one. Brake hardware kit when doing pads.

Include these in the parts list with notes explaining why.

---

## REQUIRED JSON STRUCTURE

{
  "title": "Clear, specific job title (e.g. 'Starter Replacement — 2012 Honda Accord 2.4L')",
  "difficulty": "Beginner|Intermediate|Advanced|Expert",
  "estimatedMinutes": 120,
  "safetyWarnings": ["Specific safety warnings for this job on this vehicle — not generic"],
  "parts": [
    {
      "name": "Part name",
      "partNumber": "OEM or recommended aftermarket part number, or null",
      "brand": "Specific recommended brand — never say 'any good brand'",
      "quantity": 1,
      "estimatedCost": 45.00,
      "notes": "OEM vs aftermarket quality trade-off. Honest assessment."
    }
  ],
  "tools": [
    {
      "name": "Specific tool name",
      "spec": "Exact size/type (e.g. '14mm deep socket, 3/8 drive') or null",
      "required": true
    }
  ],
  "steps": [
    {
      "number": 1,
      "title": "Verb-first action title (e.g. 'Disconnect battery negative terminal')",
      "description": "Complete instructions specific to THIS vehicle. Actual bolt locations, actual component names, actual access sequences. Separate access path hardware from component hardware explicitly.",
      "torqueSpecs": [{"bolt": "Description", "spec": "33", "unit": "ft-lbs"}],
      "subSteps": ["Individual action when a step has multiple distinct actions"],
      "tip": "Vehicle-specific pro tip from experience, or null. The thing the manual doesn't tell you.",
      "safetyNote": "Step-specific safety warning, or null",
      "estimatedMinutes": 5,
      "factoryImageIndex": null
    }
  ]
}

---

## GENERATION RULES

STEPS:
- Must be EXTREMELY specific to the vehicle. Reference actual component names,
  bolt locations, connector colors, and access sequences for this exact year/make/model/engine.
- Step 1 is always safety/preparation for any job with safety risks.
- Final step is always verification: "Start vehicle, check for leaks, listen for [specific sound],
  verify [specific behavior]. Drive test for [distance] if applicable."
- Access path is always documented before component removal.
- Hardware counts are always separated: access vs component.

TORQUE SPECS:
- Must be exact factory values. If you don't know the exact value, omit it and note
  "Consult FSM for exact torque" in the step description.
- Append [📖 FSM] for factory-confirmed specs.
- Append ~[value] (verify) for estimated specs.

PARTS:
- Include "while you're in there" items with clear justification.
- Brand recommendations must be specific and honest about quality tiers.
- Include gaskets, seals, and hardware kits that are typically needed but not obvious.

TOOLS:
- Not "socket set" — list the specific sizes needed for this job.
- Flag specialty tools with where to get them affordably.
- Note if you can get away without a specialty tool and how.

DIFFICULTY:
- Beginner: Basic hand tools, no special knowledge, minimal risk.
- Intermediate: Some mechanical knowledge, standard tools, moderate risk.
- Advanced: Significant knowledge, specialty tools possible, precision required.
- Expert: Professional knowledge strongly recommended, high-risk or high-precision.

FACTORY IMAGES:
- If factory images are provided, set factoryImageIndex to the 0-based index of the
  most relevant image for each step. Match by content (bolt diagram → bolt removal step).
  Each image to ONE step only. Set null if no image fits.

GRACEFUL DEGRADATION:
- If you don't have specific data for this vehicle platform, acknowledge it.
- Fall back to general mechanical principles with explicit uncertainty.
- Never fabricate vehicle-specific torque specs, bolt counts, or access paths.
- "Verify fastener count on your specific vehicle" is honest. "5 bolts" when you're
  guessing is dangerous.`;

const R = "Repair%20and%20Diagnosis/";

const JOB_KEYWORD_MAP: Record<string, string | string[]> = {
  "front brake pad": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
  "rear brake pad": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  "brake pads": [
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  ],
  "brake pad": [
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  ],
  "starter": `${R}Starting%20and%20Charging/Starter/Service%20and%20Repair`,
  "alternator": `${R}Starting%20and%20Charging/Generator/Alternator/Service%20and%20Repair`,
  "battery": `${R}Starting%20and%20Charging/Battery/Service%20and%20Repair`,
  "catalytic converter": `${R}Powertrain%20Management/Emission%20Control%20Systems/Catalytic%20Converter/Service%20and%20Repair`,
  "oxygen sensor": `${R}Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair`,
  "o2 sensor": `${R}Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair`,
  "vtec solenoid": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Actuators%20and%20Solenoids%20-%20Engine/Variable%20Valve%20Timing%20Solenoid`,
  "valve cover gasket": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Valve%20Cover/Service%20and%20Repair`,
  "valve cover": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Valve%20Cover/Service%20and%20Repair`,
  "timing chain": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Timing%20Components/Service%20and%20Repair`,
  "water pump": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Water%20Pump/Service%20and%20Repair`,
  "thermostat": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Thermostat/Service%20and%20Repair`,
  "radiator": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator/Service%20and%20Repair`,
  "brake rotors": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Rotor%2FDisc/Service%20and%20Repair`,
  "brake rotor": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Rotor%2FDisc/Service%20and%20Repair`,
  "strut": `${R}Steering%20and%20Suspension/Front%20Suspension/Strut/Service%20and%20Repair`,
  "spark plugs": `${R}Powertrain%20Management/Ignition%20System/Spark%20Plug/Service%20and%20Repair`,
  "spark plug": `${R}Powertrain%20Management/Ignition%20System/Spark%20Plug/Service%20and%20Repair`,
  "transmission fluid": `${R}Transmission%20and%20Drivetrain/Automatic%20Transmission%2FTransaxle/Fluid/Service%20and%20Repair`,
  "power steering": `${R}Steering%20and%20Suspension/Steering/Power%20Steering/Service%20and%20Repair`,
  "ac compressor": `${R}Heating%20and%20Air%20Conditioning/Compressor/Service%20and%20Repair`,
  "ac line": `${R}Heating%20and%20Air%20Conditioning/Hose%2FLine%20HVAC/Service%20and%20Repair`,
  "wheel bearing": `${R}Steering%20and%20Suspension/Front%20Suspension/Wheel%20Bearing/Service%20and%20Repair`,
  "cv axle": `${R}Transmission%20and%20Drivetrain/Drive%20Axles/CV%20Axle/Service%20and%20Repair`,
  "tie rod": `${R}Steering%20and%20Suspension/Steering/Tie%20Rod/Service%20and%20Repair`,
  "ball joint": `${R}Steering%20and%20Suspension/Front%20Suspension/Ball%20Joint/Service%20and%20Repair`,
  "fuel pump": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Pump/Service%20and%20Repair`,
  "fuel injector": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Injector/Service%20and%20Repair`,
  "throttle body": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Throttle%20Body/Service%20and%20Repair`,
  "mass air flow": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Air%20Flow%20Meter%2FSensor/Service%20and%20Repair`,
  "maf sensor": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Air%20Flow%20Meter%2FSensor/Service%20and%20Repair`,
  "crankshaft sensor": `${R}Powertrain%20Management/Ignition%20System/Crankshaft%20Position%20Sensor/Service%20and%20Repair`,
  "camshaft sensor": `${R}Powertrain%20Management/Ignition%20System/Camshaft%20Position%20Sensor/Service%20and%20Repair`,
  "ignition coil": `${R}Powertrain%20Management/Ignition%20System/Ignition%20Coil/Service%20and%20Repair`,
  "oil pan": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication/Oil%20Pan/Service%20and%20Repair`,
  "oil pump": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication/Oil%20Pump/Service%20and%20Repair`,
  "vtc actuator": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Camshaft%2C%20Lifters%20and%20Push%20Rods/Variable%20Valve%20Timing%20Actuator`,
  "head gasket": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Service%20and%20Repair`,
  "power steering rack": `${R}Steering%20and%20Suspension/Steering/Power%20Steering/Service%20and%20Repair`,
  "sway bar": `${R}Steering%20and%20Suspension/Front%20Suspension/Stabilizer%20Bar/Service%20and%20Repair`,
  "control arm": `${R}Steering%20and%20Suspension/Front%20Suspension/Control%20Arm/Service%20and%20Repair`,
  "abs sensor": `${R}Brakes%20and%20Traction%20Control/Anti-Lock%20Brakes/Wheel%20Speed%20Sensor/Service%20and%20Repair`,
  "brake caliper": `${R}Brakes%20and%20Traction%20Control/Hydraulic%20System/Brake%20Caliper/Service%20and%20Repair`,
  "brake master cylinder": `${R}Brakes%20and%20Traction%20Control/Hydraulic%20System/Master%20Cylinder/Service%20and%20Repair`,
  "radiator hose": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator%20Hose/Service%20and%20Repair`,
  "serpentine belt": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt/Service%20and%20Repair`,
  "drive belt": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt/Service%20and%20Repair`,
  "engine mount": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount/Service%20and%20Repair`,
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

async function fetchCharmData(supabase: any, vehicle: any, jobDescription: string) {
  if (vehicle.year < 1982 || vehicle.year > 2013) return null;
  const pathResult = matchJobKeyword(jobDescription);
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

    // Check cache
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

    // Fetch live
    try {
      console.log(`Fetching charm.li: ${charmUrl}`);
      const resp = await fetch(charmUrl, { headers: { "User-Agent": "RatchetApp/1.0" } });
      if (!resp.ok) { console.log(`Charm.li ${resp.status} for ${charmUrl}`); continue; }
      const html = await resp.text();

      const images = extractImages(html);
      const procedureText = extractProcedureText(html);
      const torqueSpecs = extractTorqueSpecs(procedureText);

      if (procedureText.length < 50 && images.length === 0) continue;

      // Upsert cache
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

  // Dedupe images
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
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { vehicleId, jobDescription: rawJobDescription, diagnosisContext, diagnosisId } = await req.json();

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!vehicleId || !UUID_RE.test(vehicleId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing vehicleId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-build jobDescription from diagnosis context if not provided
    let jobDescription = rawJobDescription;
    // We'll finalize jobDescription after fetching vehicle if needed
    const needsAutoJob = !jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length === 0;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Decode JWT payload — gateway already verified signature via verify_jwt=true
    const token = authHeader.replace("Bearer ", "");
    const jwtParts = token.split(".");
    let userId: string | null = null;
    if (jwtParts.length === 3) {
      try {
        const b64 = jwtParts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, "=");
        const payload = JSON.parse(atob(padded));
        userId = payload?.sub ?? null;
      } catch {}
    }
    if (\!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles").select("*").eq("id", vehicleId).eq("user_id", userId).single();

    if (vErr || !vehicle) {
      return new Response(JSON.stringify({ error: "Vehicle not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 10 AI-generated projects per user per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentProjects } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("ai_generated", true)
      .gt("created_at", oneDayAgo);
    if ((recentProjects ?? 0) >= 10) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 10 AI-generated projects per day." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Auto-build jobDescription from diagnosis if not provided
    if (needsAutoJob) {
      if (diagnosisContext?.confirmedCause) {
        jobDescription = `Replace/repair ${diagnosisContext.confirmedCause} on ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.engine || ''}`.trim();
      } else {
        return new Response(JSON.stringify({ error: "jobDescription must be 1-500 characters" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (typeof jobDescription !== 'string' || jobDescription.trim().length === 0 || jobDescription.length > 1000) {
      return new Response(JSON.stringify({ error: "jobDescription must be 1-1000 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Build diagnosis context injection for system prompt
    let diagnosisSystemBlock = '';
    if (diagnosisContext) {
      const testsPerformed = diagnosisContext.testsPerformed?.map((t: string) => `- ${t}`).join('\n') || 'None recorded';
      const testsRuledOut = diagnosisContext.testsRuledOut?.map((t: string) => `- ${t}`).join('\n') || 'None';
      const accessPath = diagnosisContext.accessPathDiscovered?.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n') || 'Not recorded';
      const accessHW = diagnosisContext.accessHardware?.map((h: string) => `- ${h}`).join('\n') || 'Not recorded';

      diagnosisSystemBlock = `\n\n## Diagnosis Context — Read Before Generating

This repair project was created from a completed diagnosis session.
Do NOT re-diagnose. Jump straight to the repair.

Confirmed cause: ${diagnosisContext.confirmedCause || 'Unknown'}
Original symptom: ${diagnosisContext.symptom || 'Not specified'}

Tests already performed (do not repeat these as project steps):
${testsPerformed}

Causes already ruled out:
${testsRuledOut}

Access path already discovered during diagnosis:
${accessPath}

Build on this access path — the user already knows these steps.

Hardware confirmed during diagnosis:
Component mounting: ${diagnosisContext.componentHardware || 'Not recorded'}
Access path hardware:
${accessHW}

Use this information to:
- Start the project at the repair, not the diagnosis
- Reference the confirmed access path in the relevant steps
- Use the confirmed hardware counts — these are verified for this vehicle
- Note what the user already found and what condition things were in`;
    }
    const charmData = await fetchCharmData(supabase, vehicle, jobDescription);

    // Also fetch from the Cloudflare-hosted Honda manual (richer data with sub-pages)
    let manualData: any = null;
    try {
      const manualResp = await fetch(`${supabaseUrl}/functions/v1/fetch-manual-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
        body: JSON.stringify({ jobKeyword: jobDescription, vehicleYear: vehicle.year }),
      });
      if (manualResp.ok) {
        manualData = await manualResp.json();
        if (!manualData?.found) manualData = null;
      }
    } catch (e) {
      console.error("Manual data fetch failed (non-fatal):", e);
    }

    // Merge: prefer manual data (richer, multi-page) but combine images from both
    const mergedImages: string[] = [];
    const mergedText: string[] = [];
    const mergedTorque: any[] = [];

    if (manualData) {
      mergedImages.push(...(manualData.images || []));
      if (manualData.procedureText) mergedText.push(manualData.procedureText);
      mergedTorque.push(...(manualData.torqueSpecs || []));
    }
    if (charmData) {
      // Add charm.li images not already present
      for (const img of charmData.images) {
        if (!mergedImages.includes(img)) mergedImages.push(img);
      }
      if (charmData.procedureText && !manualData) mergedText.push(charmData.procedureText);
      if (!manualData) mergedTorque.push(...(charmData.torqueSpecs || []));
    }

    const hasFactoryData = mergedText.length > 0 || mergedImages.length > 0;
    const factorySourceUrl = manualData?.sourceUrl || charmData?.charmUrl || null;

    let charmSystemAddition = '';
    if (hasFactoryData && mergedText.length > 0) {
      const torqueLines = mergedTorque
        .map((ts: any) => `${ts.context}: ${ts.value} ${ts.unit}`)
        .join('\n');

      const imageList = mergedImages.map((url: string, idx: number) =>
        `[Image ${idx}]: ${url}`
      ).join('\n');

      charmSystemAddition = `\n\n## ${vehicle.make} Factory Service Manual — Official Procedure

The following is the exact factory procedure from the ${vehicle.make} service manual for this job. Use this as your PRIMARY source:
- Follow this exact step sequence
- Use ONLY the torque specs listed here (never estimate)
- Reference the special tools ${vehicle.make} specifies
- Supplement with tips and common mistakes from your expertise

FACTORY PROCEDURE:
${mergedText.join('\n\n').slice(0, 16000)}

${torqueLines ? `CONFIRMED TORQUE SPECS FROM FACTORY MANUAL:\n${torqueLines}` : ''}

FACTORY IMAGES AVAILABLE (${mergedImages.length} total):
${imageList}

IMPORTANT: For each step, set "factoryImageIndex" to the 0-based index of the most relevant factory image above. Match images to steps based on what the image shows (e.g. bolt removal diagram goes with the bolt removal step). Each image should only be assigned to ONE step. Set null if no image fits.`;
    }

    const userMessage = `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}
Engine: ${vehicle.engine || "Unknown"}
Mileage: ${vehicle.mileage ? vehicle.mileage + " miles" : "Unknown"}
Job: ${jobDescription}

Generate the complete project plan for this exact vehicle and job.`;

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
        system: SYSTEM_PROMPT + diagnosisSystemBlock + charmSystemAddition,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Anthropic API error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.content?.[0]?.text || "";
    content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let plan: any;
    try {
      plan = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ error: "Project generation failed — please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to DB
    const { data: project, error: projErr } = await supabase.from("projects").insert({
      vehicle_id: vehicleId,
      user_id: userId,
      title: plan.title,
      description: jobDescription,
      difficulty: plan.difficulty,
      estimated_minutes: plan.estimatedMinutes,
      safety_warnings: plan.safetyWarnings || [],
      ai_generated: true,
      status: "planning",
    }).select().single();

    if (projErr) throw projErr;

    // Insert parts
    if (plan.parts?.length) {
      const parts = plan.parts.map((p: any, i: number) => ({
        project_id: project.id, name: p.name, part_number: p.partNumber || null,
        brand: p.brand || null, quantity: p.quantity || 1, estimated_cost: p.estimatedCost || null,
        notes: p.notes || null, sort_order: i,
      }));
      await supabase.from("project_parts").insert(parts);
    }

    // Insert tools
    if (plan.tools?.length) {
      const tools = plan.tools.map((t: any, i: number) => ({
        project_id: project.id, name: t.name, spec: t.spec || null,
        required: t.required ?? true, sort_order: i,
      }));
      await supabase.from("project_tools").insert(tools);
    }

    // Insert steps — use AI's factoryImageIndex for smart image assignment
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
          description: s.description,
          torque_specs: s.torqueSpecs?.length ? s.torqueSpecs : null,
          sub_steps: s.subSteps?.length ? s.subSteps : null,
          tip: s.tip || null,
          safety_note: s.safetyNote || null,
          estimated_minutes: s.estimatedMinutes || null,
          sort_order: s.number,
          charm_image_url: assignedImage,
          charm_source_url: sourceUrl,
          is_factory_verified: hasFactoryData,
        };
      });
      await supabase.from("project_steps").insert(steps);
    }

    // Link back to diagnosis session if diagnosisId provided
    if (diagnosisId && UUID_RE.test(diagnosisId)) {
      await supabase.from("diagnosis_sessions").update({
        project_id: project.id,
        status: 'resolved',
        updated_at: new Date().toISOString(),
      }).eq("id", diagnosisId).eq("user_id", userId).eq("vehicle_id", vehicleId);
    }

    // Return full project
    const { data: fullProject } = await supabase.from("projects").select("*").eq("id", project.id).single();
    const { data: savedParts } = await supabase.from("project_parts").select("*").eq("project_id", project.id).order("sort_order");
    const { data: savedTools } = await supabase.from("project_tools").select("*").eq("project_id", project.id).order("sort_order");
    const { data: savedSteps } = await supabase.from("project_steps").select("*").eq("project_id", project.id).order("step_number");

    return new Response(
      JSON.stringify({
        project: fullProject,
        parts: savedParts,
        tools: savedTools,
        steps: savedSteps,
        charmData: hasFactoryData ? {
          charmUrl: factorySourceUrl,
          charmUrls: charmData?.charmUrls || [],
          imageCount: mergedImages.length,
          hasFactoryData: true,
          manualPagesCrawled: manualData?.pagesCrawled || [],
        } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-project error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
