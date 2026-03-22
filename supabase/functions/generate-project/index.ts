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

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization");

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

    // Get user from JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch vehicle
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

    // Strip markdown fences if present
    content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let plan: any;
    try {
      plan = JSON.parse(content);
    } catch {
      // Retry once with stricter prompt
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
            { role: "system", content: SYSTEM_PROMPT + "\n\nCRITICAL: Your previous response was not valid JSON. Return ONLY raw JSON. No markdown code fences. No explanation text. Start with { and end with }." },
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
      user_id: user.id,
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
        project_id: project.id,
        name: p.name,
        part_number: p.partNumber || null,
        brand: p.brand || null,
        quantity: p.quantity || 1,
        estimated_cost: p.estimatedCost || null,
        notes: p.notes || null,
        sort_order: i,
      }));
      await supabase.from("project_parts").insert(parts);
    }

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

    // Insert steps
    if (plan.steps?.length) {
      const steps = plan.steps.map((s: any) => ({
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
      }));
      await supabase.from("project_steps").insert(steps);
    }

    // Return full project
    const { data: fullProject } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project.id)
      .single();

    const { data: savedParts } = await supabase.from("project_parts").select("*").eq("project_id", project.id).order("sort_order");
    const { data: savedTools } = await supabase.from("project_tools").select("*").eq("project_id", project.id).order("sort_order");
    const { data: savedSteps } = await supabase.from("project_steps").select("*").eq("project_id", project.id).order("step_number");

    return new Response(
      JSON.stringify({
        project: fullProject,
        parts: savedParts,
        tools: savedTools,
        steps: savedSteps,
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
