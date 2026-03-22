import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Ratchet, a master ASE-certified mechanic generating a structured DIAGNOSTIC project plan. This is NOT a repair plan — it is a step-by-step troubleshooting procedure to identify the root cause of a symptom.

You know every diagnostic procedure, every common failure pattern, every vehicle-specific quirk, and which tests to run in what order for maximum efficiency. You prioritize the most common causes first, and each step is a clear test the user can perform.

Return ONLY a single valid JSON object. No markdown. No explanation. No text before or after. Just the JSON.

Required JSON structure:
{
  "title": "Diagnostic title (e.g. 'Diagnose: No-Start Condition')",
  "difficulty": "Beginner|Intermediate|Advanced|Expert",
  "estimatedMinutes": 45,
  "possibleCauses": ["Battery failure", "Starter motor failure", "Ignition switch", "Neutral safety switch", "Blown fuse"],
  "safetyWarnings": ["String — safety warnings for this diagnostic process"],
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
      "title": "Short action title — what to check (e.g. 'Test battery voltage')",
      "description": "Detailed instructions on how to perform this diagnostic test on this specific vehicle. Include where to find the component, how to access it, and exactly what to do.",
      "systemTesting": "Battery / Electrical",
      "expectedResult": "Battery should read 12.4V or higher with engine off. Under cranking load, should not drop below 10V.",
      "failureIndicator": "Voltage below 12.0V = dead/dying battery. Drops below 9V under load = battery cannot deliver enough current.",
      "torqueSpecs": [],
      "subSteps": ["Connect multimeter red lead to positive terminal", "Connect black lead to negative terminal", "Read resting voltage", "Have someone turn the key while you watch the meter"],
      "tip": "Vehicle-specific pro tip or null",
      "safetyNote": "Safety warning specific to this step or null",
      "estimatedMinutes": 5,
      "eliminates": ["Battery failure"],
      "confirms": ["Battery failure"]
    }
  ]
}

RULES FOR DIAGNOSTIC GENERATION:
- Order steps from MOST COMMON cause to LEAST COMMON for this specific vehicle
- Each step is a single diagnostic TEST — not a repair procedure
- The "systemTesting" field identifies which system/component this step investigates
- "expectedResult" = what you see if the system is HEALTHY
- "failureIndicator" = what you see if this IS the problem
- "eliminates" = which possible causes are ruled out if this test passes
- "confirms" = which possible causes are confirmed if this test fails
- Steps must be specific to the vehicle — reference actual component locations, connector colors, access paths
- Include tests that can be done with BASIC tools first, then escalate to specialty tools
- Always include a "Visual inspection" as step 1 for relevant symptoms
- Include a final step: "Confirm root cause" that summarizes findings
- Keep each step self-contained — user should be able to stop after any step with a clear picture`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const { vehicleId, symptom, diagnosisId } = await req.json();
    if (!vehicleId || !symptom) {
      return new Response(
        JSON.stringify({ error: "vehicleId and symptom are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicleId)
      .eq("user_id", user.id)
      .single();

    if (vErr || !vehicle) {
      return new Response(JSON.stringify({ error: "Vehicle not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userMessage = `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}
Engine: ${vehicle.engine || "Unknown"}
Transmission: ${vehicle.transmission || "Unknown"}
Mileage: ${vehicle.mileage ? vehicle.mileage + " miles" : "Unknown"}

Symptom reported: ${symptom}

Generate a complete diagnostic procedure for this exact vehicle and symptom. Order tests from most likely cause to least likely for THIS specific vehicle/engine combination.`;

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
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + "\n\nCRITICAL: Your previous response was not valid JSON. Return ONLY raw JSON. No markdown code fences. Start with { and end with }." },
            { role: "user", content: userMessage },
          ],
        }),
      });
      const retryData = await retryResp.json();
      let retryContent = retryData.choices?.[0]?.message?.content || "";
      retryContent = retryContent.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      plan = JSON.parse(retryContent);
    }

    // Create project as type "diagnosis"
    const { data: project, error: projErr } = await supabase.from("projects").insert({
      vehicle_id: vehicleId,
      user_id: user.id,
      title: plan.title || `Diagnose: ${symptom}`,
      description: `Diagnostic procedure for: ${symptom}`,
      difficulty: plan.difficulty,
      estimated_minutes: plan.estimatedMinutes,
      safety_warnings: plan.safetyWarnings || [],
      ai_generated: true,
      status: "planning",
    }).select().single();

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

    // Insert steps with diagnosis-specific metadata in notes/tip fields
    if (plan.steps?.length) {
      const steps = plan.steps.map((s: any) => ({
        project_id: project.id,
        step_number: s.number,
        title: s.title,
        description: s.description
          + (s.expectedResult ? `\n\n**If it's fine:** ${s.expectedResult}` : '')
          + (s.failureIndicator ? `\n\n**If it's the problem:** ${s.failureIndicator}` : ''),
        torque_specs: s.torqueSpecs?.length ? s.torqueSpecs : null,
        sub_steps: s.subSteps?.length ? s.subSteps : null,
        tip: s.tip || null,
        safety_note: s.safetyNote || null,
        estimated_minutes: s.estimatedMinutes || null,
        sort_order: s.number,
        // Store diagnostic metadata in notes as JSON
        notes: JSON.stringify({
          systemTesting: s.systemTesting || null,
          expectedResult: s.expectedResult || null,
          failureIndicator: s.failureIndicator || null,
          eliminates: s.eliminates || [],
          confirms: s.confirms || [],
        }),
      }));
      await supabase.from("project_steps").insert(steps);
    }

    // Link diagnosis session if provided
    if (diagnosisId) {
      await supabase.from("diagnosis_sessions").update({
        project_id: project.id,
        tree_data: (plan.possibleCauses || []).map((c: string) => ({
          name: c,
          status: "untested",
        })),
        updated_at: new Date().toISOString(),
      }).eq("id", diagnosisId);
    }

    // Return full project
    const { data: fullProject } = await supabase.from("projects").select("*").eq("id", project.id).single();
    const { data: savedTools } = await supabase.from("project_tools").select("*").eq("project_id", project.id).order("sort_order");
    const { data: savedSteps } = await supabase.from("project_steps").select("*").eq("project_id", project.id).order("step_number");

    return new Response(
      JSON.stringify({
        project: fullProject,
        projectId: project.id,
        tools: savedTools,
        steps: savedSteps,
        possibleCauses: plan.possibleCauses || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-diagnosis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
