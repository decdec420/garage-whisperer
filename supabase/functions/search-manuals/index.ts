import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const { vehicleId, year, make, model, trim } = await req.json();

    // --- Input validation ---
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!vehicleId || !UUID_RE.test(vehicleId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing vehicleId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!year || typeof year !== 'number' || year < 1900 || year > 2030) {
      return new Response(JSON.stringify({ error: "year must be 1900-2030" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!make || typeof make !== 'string' || make.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid make" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!model || typeof model !== 'string' || model.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid model" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (\!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify vehicleId belongs to authenticated user
    const { data: vehicle } = await supabase
      .from("vehicles").select("id").eq("id", vehicleId).eq("user_id", userId).single();
    if (\!vehicle) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `For a ${year} ${make} ${model}${trim ? ` ${trim}` : ''}, provide the most useful online resources a DIY mechanic would need. Return a JSON array of objects with "title", "url", and "description" fields.\n\nFocus on:\n1. Official owner's manual (if freely available online from the manufacturer)\n2. Service/repair manual sources (Haynes, Chilton, factory service manual)\n3. Wiring diagram resources specific to this vehicle\n4. Known TSBs (Technical Service Bulletins) lookup page\n5. Model-specific forums or communities with repair knowledge\n\nOnly include real, legitimate URLs that are likely to work. If the official owner's manual is behind a paywall, note that in the description and provide the URL anyway.\nReturn ONLY the JSON array, no other text. Limit to 5-8 most useful resources.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: "You are an automotive resource specialist. Return only valid JSON arrays. All URLs must be real, well-known automotive resource websites.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (\!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const content = aiData.content?.[0]?.text || "[]";

    let resources: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      resources = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      resources = [];
    }

    // Validate and insert resources
    const ALLOWED_URL_PATTERN = /^https?:\/\//i;
    let count = 0;
    for (const r of resources) {
      if (!r.title || !r.url || typeof r.url !== 'string') continue;
      // Basic URL validation — must be a valid HTTP(S) URL
      if (!ALLOWED_URL_PATTERN.test(r.url)) continue;
      try { new URL(r.url); } catch { continue; }
      // Sanitize string lengths
      const title = String(r.title).slice(0, 500);
      const description = r.description ? String(r.description).slice(0, 2000) : null;
      const url = r.url.slice(0, 2000);
      const { error } = await supabase.from("vehicle_documents").insert({
        vehicle_id: vehicleId,
        user_id: userId,
        title,
        description,
        doc_type: "reference",
        external_url: url,
        source: "auto_search",
      });
      if (!error) count++;
    }

    return new Response(JSON.stringify({ success: true, count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-manuals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
