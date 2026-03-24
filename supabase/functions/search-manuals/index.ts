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

    const { vehicleId, year, make, model, trim } = await req.json();
    if (!vehicleId || !year || !make || !model) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const prompt = `For a ${year} ${make} ${model}${trim ? ` ${trim}` : ''}, provide the most useful online resources a DIY mechanic would need. Return a JSON array of objects with "title", "url", and "description" fields.

Focus on:
1. Official owner's manual (if freely available online from the manufacturer)
2. Service/repair manual sources (Haynes, Chilton, factory service manual)
3. Wiring diagram resources specific to this vehicle
4. Known TSBs (Technical Service Bulletins) lookup page
5. Model-specific forums or communities with repair knowledge

Only include real, legitimate URLs that are likely to work. If the official owner's manual is behind a paywall, note that in the description and provide the URL anyway.
Return ONLY the JSON array, no other text. Limit to 5-8 most useful resources.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an automotive resource specialist. Return only valid JSON arrays. All URLs must be real, well-known automotive resource websites." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let resources: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      resources = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      resources = [];
    }

    let count = 0;
    for (const r of resources) {
      if (!r.title || !r.url) continue;
      const { error } = await supabase.from("vehicle_documents").insert({
        vehicle_id: vehicleId,
        user_id: userId,
        title: r.title,
        description: r.description || null,
        doc_type: "reference",
        external_url: r.url,
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
