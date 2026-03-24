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
      "estimatedMinutes": 5
    }
  ]
}

RULES FOR GENERATION:
- Steps must be EXTREMELY specific to the vehicle. Reference actual component names, locations, access sequences.
- Torque specs must be exact factory values. If you don't know the exact value, do not guess — omit it and note in the step to consult the FSM.
- The tip field is for vehicle-specific knowledge that saves time or prevents mistakes.
- Include a step 1 safety/preparation step for any job with safety risks.
- Include a final step: "Verify repair — start vehicle and confirm..."
- Difficulty ratings: Beginner = basic hand tools, no special knowledge. Intermediate = some mechanical knowledge, standard tools. Advanced = significant knowledge, specialty tools possible. Expert = professional knowledge strongly recommended.`;

// --- charm.li keyword map (subset for server-side matching) ---
const JOB_KEYWORD_MAP: Record<string, string> = {
  "starter": "Starting%20and%20Charging/Starter/Service%20and%20Repair",
  "alternator": "Starting%20and%20Charging/Generator/Alternator/Service%20and%20Repair",
  "catalytic converter": "Powertrain%20Management/Emission%20Control%20Systems/Catalytic%20Converter/Service%20and%20Repair",
  "oxygen sensor": "Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair",
  "o2 sensor": "Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair",
  "vtec solenoid": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Variable%20Valve%20Timing%20Solenoid/Service%20and%20Repair",
  "valve cover": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Valve%20Cover/Service%20and%20Repair",
  "timing chain": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Timing%20Components/Service%20and%20Repair",
  "water pump": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Water%20Pump/Service%20and%20Repair",
  "thermostat": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Thermostat/Service%20and%20Repair",
  "radiator": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator/Service%20and%20Repair",
  "brake pads": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pads/Service%20and%20Repair",
  "brake rotors": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Rotor/Service%20and%20Repair",
  "strut": "Steering%20and%20Suspension/Front%20Suspension/Strut/Service%20and%20Repair",
  "spark plugs": "Powertrain%20Management/Ignition%20System/Spark%20Plug/Service%20and%20Repair",
  "wheel bearing": "Steering%20and%20Suspension/Front%20Suspension/Wheel%20Bearing/Service%20and%20Repair",
  "cv axle": "Transmission%20and%20Drivetrain/Drive%20Axles/CV%20Axle/Service%20and%20Repair",
  "fuel pump": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Pump/Service%20and%20Repair",
  "engine mount": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount/Service%20and%20Repair",
  "control arm": "Steering%20and%20Suspension/Front%20Suspension/Control%20Arm/Service%20and%20Repair",
  "ac compressor": "Heating%20and%20Air%20Conditioning/Compressor/Service%20and%20Repair",
  "serpentine belt": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts/Service%20and%20Repair",
  "drive belt": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts/Service%20and%20Repair",
  "head gasket": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Service%20and%20Repair",
  "power steering": "Steering%20and%20Suspension/Steering/Power%20Steering/Service%20and%20Repair",
  "throttle body": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Throttle%20Body/Service%20and%20Repair",
  "ignition coil": "Powertrain%20Management/Ignition%20System/Ignition%20Coil/Service%20and%20Repair",
  "oil pan": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication/Oil%20Pan/Service%20and%20Repair",
  "tie rod": "Steering%20and%20Suspension/Steering/Tie%20Rod/Service%20and%20Repair",
  "ball joint": "Steering%20and%20Suspension/Front%20Suspension/Ball%20Joint/Service%20and%20Repair",
  "brake caliper": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Caliper/Service%20and%20Repair",
  "sway bar": "Steering%20and%20Suspension/Front%20Suspension/Stabilizer%20Bar/Service%20and%20Repair",
  "abs sensor": "Brakes%20and%20Traction%20Control/Anti-Lock%20Brakes/Wheel%20Speed%20Sensor/Service%20and%20Repair",
  "fuel injector": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Injector/Service%20and%20Repair",
  "vtc actuator": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Service%20and%20Repair",
  "battery": "Starting%20and%20Charging/Battery/Service%20and%20Repair",
  "transmission fluid": "Transmission%20and%20Drivetrain/Automatic%20Transmission%2FTransaxle/Fluid/Service%20and%20Repair",
};

function matchJobKeyword(job: string): string | null {
  const lower = job.toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const [kw, path] of Object.entries(JOB_KEYWORD_MAP)) {
    if (lower.includes(kw) && kw.length > bestLen) { best = path; bestLen = kw.length; }
  }
  return best;
}

function formatEngineForCharm(engine: string | null, model: string): string {
  if (!engine) return model;
  const dm = engine.match(/(\d+\.\d+)\s*L/i);
  const d = dm ? dm[1] : null;
  let c = '';
  if (/V\s*6|V6/i.test(engine)) c = 'V6';
  else if (/V\s*8|V8/i.test(engine)) c = 'V8';
  else if (/I\s*4|L4|4[\s-]?cyl|inline[\s-]?4/i.test(engine)) c = 'L4';
  else if (/I\s*6|L6|inline[\s-]?6/i.test(engine)) c = 'L6';
  if (d && c) return `${model} ${c}-${d}L`;
  if (d) return `${model} ${d}L`;
  return model;
}

async function fetchCharmData(supabase: any, vehicle: any, jobDescription: string) {
  if (vehicle.year < 1982 || vehicle.year > 2013) return null;
  const path = matchJobKeyword(jobDescription);
  if (!path) return null;

  const charmModel = formatEngineForCharm(vehicle.engine, vehicle.model);
  const charmUrl = `https://charm.li/${vehicle.make}/${vehicle.year}/${encodeURIComponent(charmModel)}/${path}/`;

  // Check cache
  const { data: cached } = await supabase.from("charm_cache").select("*").eq("charm_url", charmUrl).single();
  if (cached) {
    const fetchedAt = new Date(cached.fetched_at);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    if (fetchedAt > cutoff && (cached.procedure_text?.length > 50 || (cached.images?.length > 0))) {
      return { charmUrl, images: cached.images || [], procedureText: cached.procedure_text || '', torqueSpecs: cached.torque_specs || [] };
    }
  }

  // Fetch live
  try {
    const resp = await fetch(charmUrl, { headers: { "User-Agent": "RatchetApp/1.0" } });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Extract images
    const images: string[] = [];
    const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = imgRe.exec(html)) !== null) {
      const src = m[1];
      if (src.includes('charm.li/images') || src.includes('/images/')) {
        images.push(src.startsWith('http') ? src : `https://charm.li${src.startsWith('/') ? '' : '/'}${src}`);
      }
    }
    const uniqueImages = [...new Set(images)];

    // Extract text
    let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    const parts: string[] = [];
    const cRe = /<(?:p|li|td|div|span|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|li|td|div|span|h[1-6])>/gi;
    while ((m = cRe.exec(cleaned)) !== null) {
      const t = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      if (t.length > 5) parts.push(t);
    }
    const procedureText = [...new Set(parts)].join('\n');

    // Extract torque specs
    const torqueSpecs: any[] = [];
    const tRe = /(\d+(?:\.\d+)?)\s*(ft[\s·.-]?lb[s]?|N[\s·.-]?m)/gi;
    while ((m = tRe.exec(procedureText)) !== null) {
      const start = Math.max(0, m.index - 60);
      const ctx = procedureText.slice(start, m.index).replace(/\n/g, ' ').trim();
      torqueSpecs.push({ value: m[1], unit: m[2].replace(/[\s·.-]/g, ' ').trim(), context: ctx.split('.').pop()?.trim() || '' });
    }

    if (procedureText.length < 50 && uniqueImages.length === 0) return null;

    // Upsert cache
    if (cached) {
      await supabase.from("charm_cache").update({ images: uniqueImages, procedure_text: procedureText, torque_specs: torqueSpecs, fetched_at: new Date().toISOString() }).eq("id", cached.id);
    } else {
      await supabase.from("charm_cache").insert({ charm_url: charmUrl, images: uniqueImages, procedure_text: procedureText, torque_specs: torqueSpecs });
    }

    return { charmUrl, images: uniqueImages, procedureText, torqueSpecs };
  } catch (e) {
    console.error("Charm fetch failed:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { vehicleId, jobDescription } = await req.json();
    if (!vehicleId || !jobDescription) {
      return new Response(
        JSON.stringify({ error: "vehicleId and jobDescription are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT and get userId
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

    // Fetch vehicle — scoped to authenticated user
    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles").select("*").eq("id", vehicleId).eq("user_id", userId).single();

    if (vErr || !vehicle) {
      return new Response(JSON.stringify({ error: "Vehicle not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // --- Fetch charm.li factory data ---
    const charmData = await fetchCharmData(supabase, vehicle, jobDescription);
    let charmSystemAddition = '';
    if (charmData && charmData.procedureText) {
      const torqueLines = (charmData.torqueSpecs || [])
        .map((ts: any) => `${ts.context}: ${ts.value} ${ts.unit}`)
        .join('\n');

      charmSystemAddition = `\n\n## ${vehicle.make} Factory Service Manual — Official Procedure

The following is the exact factory procedure from the ${vehicle.make} service manual for this job. Use this as your PRIMARY source:
- Follow this exact step sequence
- Use ONLY the torque specs listed here (never estimate)
- Reference the special tools ${vehicle.make} specifies
- Supplement with tips and common mistakes from your expertise

FACTORY PROCEDURE:
${charmData.procedureText.slice(0, 8000)}

${torqueLines ? `CONFIRMED TORQUE SPECS FROM FACTORY MANUAL:\n${torqueLines}` : ''}

FACTORY PHOTOS AVAILABLE:
${charmData.images.length} factory diagram(s) will be shown to the user alongside your steps. Reference them in your step descriptions where relevant (e.g. 'as shown in the factory diagram').`;
    }

    const userMessage = `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}
Engine: ${vehicle.engine || "Unknown"}
Mileage: ${vehicle.mileage ? vehicle.mileage + " miles" : "Unknown"}
Job: ${jobDescription}

Generate the complete project plan for this exact vehicle and job.`;

    // Call AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + charmSystemAddition },
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

    // Insert steps — distribute charm images across steps
    if (plan.steps?.length) {
      const charmImages = charmData?.images || [];
      const charmUrl = charmData?.charmUrl || null;
      const hasCharm = !!charmData;

      const steps = plan.steps.map((s: any, idx: number) => ({
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
        charm_image_url: charmImages[idx] || null,
        charm_source_url: charmUrl,
        is_factory_verified: hasCharm,
      }));
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
        charmData: charmData ? { charmUrl: charmData.charmUrl, imageCount: charmData.images.length, hasFactoryData: true } : null,
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
