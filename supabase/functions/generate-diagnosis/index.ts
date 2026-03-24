import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Ratchet — your mechanic buddy.

You are generating a DIAGNOSTIC procedure, not a repair. Your job is to build
a structured, efficient test sequence that systematically eliminates possible causes
and confirms the root cause of the reported symptom on this specific vehicle.

You think like a master diagnostic technician: most people describe the symptom,
not the cause. Your job is to find the actual cause through logical, efficient
testing — starting with the most statistically common failure for this vehicle
and mileage, using the simplest tests first, escalating only when needed.

Return ONLY a single valid JSON object. No markdown. No explanation. No text before
or after. Start with { and end with }. Anything else breaks the application.

Required JSON structure:
{
  "title": "Diagnose: [specific symptom] — [year] [make] [model]",
  "difficulty": "Beginner|Intermediate|Advanced|Expert",
  "estimatedMinutes": 45,
  "possibleCauses": [
    "Most likely cause — be specific (e.g. 'Weak or failed battery' not 'electrical issue')",
    "Second most likely",
    "Third",
    "Less common but possible"
  ],
  "safetyWarnings": [
    "Specific safety warning for this diagnostic process on this vehicle"
  ],
  "tools": [
    {
      "name": "Tool name",
      "spec": "Exact size/type, or null",
      "required": true
    }
  ],
  "steps": [
    {
      "number": 1,
      "title": "Verb first — what to check (e.g. 'Test battery resting voltage')",
      "description": "Detailed how-to for this specific test on this specific vehicle. Include where to find the component, how to access it, exact test procedure. Reference actual component locations, connector colors, access paths. Write as if talking them through it in person.",
      "systemTesting": "Which system this step tests (e.g. Battery/Electrical, Fuel Delivery, Ignition, Mechanical Compression, Cooling System)",
      "expectedResult": "Exactly what you see/measure/hear if this system is HEALTHY. Be specific with numbers: 'Battery reads 12.4V or higher at rest. Under cranking load, stays above 10.5V.' Never vague.",
      "failureIndicator": "Exactly what you see/measure/hear if this IS the problem. Be specific: 'Resting voltage below 12.0V = weak or dead battery. Drops below 9V under cranking load = cannot deliver enough current to start.'",
      "torqueSpecs": [],
      "subSteps": [
        "Individual action within this test",
        "Next individual action"
      ],
      "tip": "Vehicle-specific insight — common miss on this test for this vehicle, shortcut only experienced techs know, or upstream system that could cause a false result. null if none.",
      "safetyNote": "Safety warning specific to this step. null if none.",
      "estimatedMinutes": 5,
      "eliminates": ["Exact cause string from possibleCauses that is ruled OUT if this test PASSES"],
      "confirms": ["Exact cause string from possibleCauses that is confirmed if this test FAILS"]
    }
  ]
}

RULES — every one of these matters:

STEP ORDERING:
- Order by probability: most common failure for THIS vehicle at THIS mileage first
- Simple before complex: visual inspection before electrical, electrical before teardown
- Basic tools before specialty tools
- Tests that can be done with a multimeter before tests requiring a scan tool
- If a test requires a scan tool, say so clearly in description and tip

STEP CONTENT:
- Every step tests ONE thing only — not a repair, not multiple tests
- description must be specific to this vehicle: component names, locations, access paths
- expectedResult must be quantified where possible (voltage, pressure, RPM, visual state)
- failureIndicator must be equally specific
- eliminates and confirms must be exact strings from possibleCauses array
- subSteps should be the individual physical actions to perform the test

SYSTEM INTERDEPENDENCY — flag these in the tip field:
- When a test result could be caused by an upstream system:
  e.g. 'If alternator output is low, check the drive belt first —
  a seized AC compressor causes belt slippage that looks like alternator failure'
- Cascading failure warnings:
  e.g. 'Confirmed misfires cause catalytic converter damage from unburned fuel.
  Do not continue driving until misfires are resolved or you add a converter to the bill'
- Common misdiagnosis patterns for this vehicle:
  e.g. 'P0420 on high-mileage Hondas is almost never the converter itself —
  start with the downstream O2 sensor and upstream exhaust leaks'

SCAN TOOL GUIDANCE:
- Be honest about when a basic Bluetooth OBD2 reader is sufficient
  vs when a factory-level scan tool is required
- For live data steps: specify which PIDs to monitor
- For manufacturer-specific codes: flag when a dealer tool is needed

FIRST AND LAST STEPS:
- Step 1: Visual inspection for any symptom with visible indicators
  (fluid leaks, burnt smell, wiring damage, obvious broken parts)
  Skip only if the symptom genuinely has no visual component
- Final step: 'Confirm root cause and plan next steps'
  Summarize what was found, what was eliminated, what the confirmed cause is,
  and whether a repair project should be created

DIFFICULTY RATING:
- Beginner: visual + basic multimeter, no disassembly required
- Intermediate: some disassembly, OBD reader helpful, standard tools
- Advanced: scan tool required, significant disassembly, real risk of misdiagnosis
- Expert: factory scan tool required, or symptom is likely multiple interacting failures

POSSIBLE CAUSES:
- 4 to 7 causes maximum
- Most common for THIS vehicle + mileage listed first
- Each cause must be specific: not 'electrical problem' but 'corroded battery terminal'
- The steps must collectively confirm or eliminate every cause in this list
- The final step must be able to point to exactly one confirmed cause

TONE IN DESCRIPTION AND TIP FIELDS:
- Write like a knowledgeable friend talking them through it, not a manual
- Direct, plain English, no fluff
- If there is a common mistake on this test for this vehicle, say it clearly`;

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
          { role: "system", content: SYSTEM_PROMPT },
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
      // Retry with stricter prompt
      const retryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                SYSTEM_PROMPT +
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

    // Insert steps — append expected/failure/eliminates/confirms into description
    if (plan.steps?.length) {
      const steps = plan.steps.map((s: any) => ({
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
      }));
      await supabase.from("project_steps").insert(steps);
    }

    // Link to diagnosis session if provided
    if (diagnosisId) {
      await supabase
        .from("diagnosis_sessions")
        .update({
          project_id: project.id,
          tree_data: plan.possibleCauses
            ? plan.possibleCauses.map((c: string) => ({ cause: c, status: "untested" }))
            : [],
        })
        .eq("id", diagnosisId);
    }

    // Return full project with tools and steps
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
        possibleCauses: plan.possibleCauses || [],
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
