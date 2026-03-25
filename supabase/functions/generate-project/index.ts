import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Ratchet, a master ASE-certified mechanic and mechanical engineer with 30 years experience. You are generating a complete, professional-grade repair project plan for a specific vehicle and job.

You know every torque spec, every common failure pattern, every vehicle-specific quirk, every shortcut that experienced mechanics use, and every mistake that beginners make. You write like a knowledgeable friend — direct, specific, zero fluff.

Return ONLY a single valid JSON object. No markdown. No explanation. No text before or after. Just the JSON. If you include anything other than JSON, the application will break.

Required JSON structure:
{
  "title": "Clear, specific job title (e.g. 'Catalytic Converter Replacement — Downstream')",
  "difficulty": "Beginner|Intermediate|Advanced|Expert",
  "estimatedMinutes": 120,
  "safetyWarnings": ["String — each a specific safety warning for this job on this vehicle"],
  "parts": [
    {
      "name": "Part name",
      "partNumber": "OEM or aftermarket part number or null",
      "brand": "Specific recommended brand — never say 'any brand'",
      "quantity": 1,
      "estimatedCost": 45.00,
      "notes": "OEM vs aftermarket trade-off, quality notes, common failures with cheap versions"
    }
  ],
  "tools": [
    {
      "name": "Tool name",
      "spec": "Size/type or null",
      "required": true
    }
  ],
  "steps": [
    {
      "number": 1,
      "title": "Short action title — verb first (e.g. 'Disconnect battery negative')",
      "description": "Complete, detailed instructions specific to this exact vehicle.",
      "torqueSpecs": [{"bolt": "Exhaust flange bolts", "spec": "33", "unit": "ft-lbs"}],
      "subSteps": ["Sub-step if the main step has multiple distinct actions"],
      "tip": "Vehicle-specific pro tip or null",
      "safetyNote": "Safety warning specific to this step or null",
      "estimatedMinutes": 5,
      "factoryImageIndex": null
    }
  ]
}

RULES FOR GENERATION:
- Steps must be EXTREMELY specific to the vehicle. Reference actual component names, locations, access sequences.
- Torque specs must be exact factory values. If you don't know the exact value, do not guess — omit it and note in the step to consult the FSM.
- The tip field is for vehicle-specific knowledge that saves time or prevents mistakes.
- Include a step 1 safety/preparation step for any job with safety risks.
- Include a final step: "Verify repair — start vehicle and confirm..."
- Difficulty ratings: Beginner = basic hand tools, no special knowledge. Intermediate = some mechanical knowledge, standard tools. Advanced = significant knowledge, specialty tools possible. Expert = professional knowledge strongly recommended.
- If factory images are provided, set factoryImageIndex to the 0-based index of the most relevant image for that step. Only assign each image to the ONE step where it's most useful. Set null if no image is relevant.`;

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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles").select("*").eq("id", vehicleId).eq("user_id", userId).single();

    if (vErr || !vehicle) {
      return new Response(JSON.stringify({ error: "Vehicle not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + diagnosisSystemBlock + charmSystemAddition },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let plan: any;
    try {
      plan = JSON.parse(content);
    } catch {
      console.error("First parse failed, retrying...");
      const retryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + charmSystemAddition + "\n\nCRITICAL: Your previous response was not valid JSON. Return ONLY raw JSON. No markdown code fences. No explanation text. Start with { and end with }." },
            { role: "user", content: userMessage },
          ],
        }),
      });
      const retryData = await retryResp.json();
      let retryContent = retryData.choices?.[0]?.message?.content || "";
      retryContent = retryContent.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      plan = JSON.parse(retryContent);
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
