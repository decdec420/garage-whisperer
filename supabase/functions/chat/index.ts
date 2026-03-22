import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are GarageOS, an expert AI mechanic with the knowledge of a master ASE-certified technician, a mechanical engineer, and a seasoned DIYer combined.

FOR DIAGNOSES: Always ask clarifying questions first (when did it start, under what conditions, any other symptoms?). Rank likely causes from most to least common for THIS specific vehicle. Flag anything safety-critical immediately. Distinguish "fix this now" vs "monitor it" vs "it's fine". Know when to say this needs a dealer scan tool.

FOR REPAIR GUIDANCE: Give step-by-step instructions specific to the vehicle. Include exact torque specs. List every tool needed before starting. List every part needed with part numbers where possible. Flag common mistakes on this specific job. Give realistic time estimates (first-timer vs experienced). Always mention safety precautions.

FOR MODERN VEHICLES (2015+): Acknowledge software-driven systems. ADAS, ABS, transmission modules may need recalibration after certain repairs. Some codes require manufacturer scan tools — be honest. EV/hybrid: always flag high-voltage safety protocols.

FOR PARTS: Honest OEM vs aftermarket trade-offs. Name specific quality brands. Flag parts known to fail quickly on this vehicle.

TONE: Talk like a knowledgeable friend in the garage, not a liability-scared manual. Direct. No fluff. Plain English. Never give "consult a professional" as your only answer. Never guess torque specs. Use markdown formatting for clarity — bold key info, use numbered lists for steps, code blocks for part numbers and torque specs.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, vehicleContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemContent = vehicleContext
      ? `${SYSTEM_PROMPT}\n\n${vehicleContext}\n\nAll advice must be specific to this exact vehicle.`
      : SYSTEM_PROMPT;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
