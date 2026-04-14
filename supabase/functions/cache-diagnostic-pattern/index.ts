import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";



/**
 * Called when a user confirms a diagnosis-linked repair worked.
 * Caches or updates the diagnostic pattern for future reuse.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { diagnosisSessionId, feedbackType } = await req.json();

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!diagnosisSessionId || !UUID_RE.test(diagnosisSessionId)) {
      return new Response(JSON.stringify({ error: "Invalid diagnosisSessionId" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the diagnosis session
    const { data: session, error: sessionErr } = await supabase
      .from("diagnosis_sessions")
      .select("*")
      .eq("id", diagnosisSessionId)
      .eq("user_id", userId)
      .single();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch the vehicle
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("make, model, year, engine")
      .eq("id", session.vehicle_id)
      .single();

    if (!vehicle) {
      return new Response(JSON.stringify({ error: "Vehicle not found" }), {
        status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const symptomNormalized = session.symptom.toLowerCase().trim();
    const makeLower = vehicle.make.toLowerCase();
    const modelLower = vehicle.model.toLowerCase();
    const confirmedCause = session.confirmed_cause || "Unknown";
    const isPositive = feedbackType === "post_repair_fixed";

    // Check if a matching pattern already exists
    const { data: existing } = await supabase
      .from("diagnostic_patterns")
      .select("*")
      .ilike("vehicle_make", makeLower)
      .ilike("vehicle_model", modelLower)
      .ilike("confirmed_cause", confirmedCause.toLowerCase())
      .limit(5);

    // Find one with similar symptom
    const match = (existing || []).find((p: any) => {
      const symMatch = symptomNormalized.includes(p.symptom_normalized) ||
                       p.symptom_normalized.includes(symptomNormalized);
      return symMatch;
    });

    if (match) {
      // Update existing pattern
      const newSuccess = match.success_count + (isPositive ? 1 : 0);
      const newFailure = match.failure_count + (isPositive ? 0 : 1);
      const newConfidence = newSuccess / (newSuccess + newFailure);

      await supabase
        .from("diagnostic_patterns")
        .update({
          success_count: newSuccess,
          failure_count: newFailure,
          confidence_score: newConfidence,
          updated_at: new Date().toISOString(),
          // Update tree data if this session has better data
          ...(isPositive && session.tree_data ? { diagnostic_tree: session.tree_data } : {}),
        })
        .eq("id", match.id);

      return new Response(JSON.stringify({ action: "updated", patternId: match.id, confidence: newConfidence }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Only create new patterns from positive feedback
    if (!isPositive) {
      return new Response(JSON.stringify({ action: "skipped", reason: "negative feedback without existing pattern" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch tools and steps for this diagnosis project
    let toolsSummary: any[] = [];
    let stepsSummary: any[] = [];

    if (session.project_id) {
      const { data: tools } = await supabase
        .from("project_tools")
        .select("name, spec, required")
        .eq("project_id", session.project_id)
        .order("sort_order");
      toolsSummary = tools || [];

      const { data: steps } = await supabase
        .from("project_steps")
        .select("step_number, title, description, estimated_minutes, status")
        .eq("project_id", session.project_id)
        .order("step_number");
      stepsSummary = (steps || []).map((s: any) => ({
        number: s.step_number,
        title: s.title,
        wasUseful: s.status === "healthy" || s.status === "faulty",
      }));
    }

    // Determine engine family
    const engineFamily = vehicle.engine
      ? vehicle.engine.replace(/\d+\.\d+L\s*/i, "").trim() || null
      : null;

    // Create new pattern
    const { data: pattern, error: insertErr } = await supabase
      .from("diagnostic_patterns")
      .insert({
        symptom_normalized: symptomNormalized,
        vehicle_make: makeLower,
        vehicle_model: modelLower,
        vehicle_year_min: vehicle.year - 2,
        vehicle_year_max: vehicle.year + 2,
        engine_family: engineFamily,
        confirmed_cause: confirmedCause,
        diagnostic_tree: session.tree_data || [],
        steps_summary: stepsSummary,
        tools_used: toolsSummary,
        success_count: 1,
        failure_count: 0,
        confidence_score: 0.5,
        avg_diagnostic_minutes: null,
        source_diagnosis_id: session.id,
        source_user_id: userId,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Pattern insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to cache pattern" }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ action: "created", patternId: pattern.id }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cache-diagnostic-pattern error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
