import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Ratchet, your mechanic buddy — an expert AI mechanic with the knowledge of a master ASE-certified technician, a mechanical engineer, and a seasoned DIYer combined.

FOR DIAGNOSES: Always ask clarifying questions first (when did it start, under what conditions, any other symptoms?). Rank likely causes from most to least common for THIS specific vehicle. Flag anything safety-critical immediately. Distinguish "fix this now" vs "monitor it" vs "it's fine". Know when to say this needs a dealer scan tool.

FOR REPAIR GUIDANCE: Give step-by-step instructions specific to the vehicle. Include exact torque specs. List every tool needed before starting. List every part needed with part numbers where possible. Flag common mistakes on this specific job. Give realistic time estimates (first-timer vs experienced). Always mention safety precautions.

FOR MODERN VEHICLES (2015+): Acknowledge software-driven systems. ADAS, ABS, transmission modules may need recalibration after certain repairs. Some codes require manufacturer scan tools — be honest. EV/hybrid: always flag high-voltage safety protocols.

FOR PARTS: Honest OEM vs aftermarket trade-offs. Name specific quality brands. Flag parts known to fail quickly on this vehicle.

QUALIFYING QUESTIONS: When a user describes a repair they want to do ("replace", "fix", "swap", "install", "remove", "change", "diagnose"), ask 2-3 targeted qualifying questions BEFORE offering a full plan or project:
- "Have you confirmed the diagnosis? Got a code, or going by symptoms?"
- "Have you inspected it yet, or still planning?"
- "Want me to walk through diagnosis first, or are you ready to just replace it?"
Use the answers to give much better, more targeted advice. Feel like a buddy asking before diving in, not a form.

PHOTO ANALYSIS: The user may send you photos of their vehicle, parts, or repair work. Analyze them carefully and give specific, actionable feedback. Reference what you actually see in the image — describe the specific parts, conditions, fluid colors, rust levels, damage, or incorrect installations you observe. Be direct: "I can see X, which means Y."

FORMATTING RULES — always follow these:
- Use bold headers (##) for each distinct section of your response
  e.g. ## What's likely causing this, ## Parts you'll need, ## Steps to fix it, ## Pro tips
- Use numbered lists for sequential steps, bullet lists for options or facts
- Put part numbers in backticks: \`234-4359\`
- Put torque specs on their own line with a wrench emoji: 🔩 Exhaust flange bolts: 33 ft-lbs
- Put safety warnings in their own section: ⚠️ Safety: [warning text]
- Put vehicle-specific tips in their own section: ⚡ Tip: [tip text]
- Keep paragraphs to 2-3 sentences max
- Never write a wall of text — always break it up with headers and lists
- If answering a yes/no question, lead with the answer in bold, then explain

TONE: Talk like a knowledgeable friend in the garage, not a liability-scared manual. Direct. No fluff. Plain English. Never give "consult a professional" as your only answer. Never guess torque specs. Use markdown formatting for clarity.`;

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

    const body = await req.json();
    const { messages, vehicleContext, vehicleId } = body;

    // --- Input validation ---
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (vehicleId && !UUID_RE.test(vehicleId)) {
      return new Response(JSON.stringify({ error: "Invalid vehicleId format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return new Response(JSON.stringify({ error: "messages must be an array of 1-50 items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const msg of messages) {
      if (typeof msg.content === 'string' && msg.content.length > 10000) {
        return new Response(JSON.stringify({ error: "Message content exceeds maximum length" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (vehicleContext && typeof vehicleContext === 'string' && vehicleContext.length > 2000) {
      return new Response(JSON.stringify({ error: "vehicleContext too long" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify vehicleId belongs to authenticated user
    if (vehicleId) {
      const { data: vehicle } = await supabase
        .from("vehicles").select("id").eq("id", vehicleId).eq("user_id", userId).single();
      if (!vehicle) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch memories using authenticated userId
    let memoryBlock = "";
    if (userId) {
      try {
        // User-level memories (vehicle_id IS NULL)
        const { data: userMemories } = await supabase
          .from("ratchet_memory")
          .select("memory_type, content")
          .eq("user_id", userId)
          .is("vehicle_id", null)
          .order("created_at", { ascending: false })
          .limit(50);

        // Vehicle-specific memories
        let vehicleMemories: any[] = [];
        if (vehicleId) {
          const { data } = await supabase
            .from("ratchet_memory")
            .select("memory_type, content")
            .eq("user_id", userId)
            .eq("vehicle_id", vehicleId)
            .order("created_at", { ascending: false })
            .limit(50);
          vehicleMemories = data || [];
        }

        if ((userMemories && userMemories.length > 0) || vehicleMemories.length > 0) {
          const toolMemories = (userMemories || []).filter((m: any) => m.memory_type === "tool_owned").map((m: any) => m.content);
          const userFacts = (userMemories || []).filter((m: any) => m.memory_type === "user_fact").map((m: any) => m.content);
          const vehicleFacts = vehicleMemories.filter((m: any) => m.memory_type === "vehicle_fact").map((m: any) => m.content);
          const symptoms = vehicleMemories.filter((m: any) => m.memory_type === "symptom").map((m: any) => m.content);
          const pendingIssues = vehicleMemories.filter((m: any) => m.memory_type === "pending_issue").map((m: any) => m.content);
          const completedRepairs = vehicleMemories.filter((m: any) => m.memory_type === "completed_repair").map((m: any) => m.content);

          let block = "\n\n## What Ratchet remembers\n";
          if (toolMemories.length) block += `\nTools owned: ${toolMemories.join("; ")}`;
          if (userFacts.length) block += `\nSkill & preferences: ${userFacts.join("; ")}`;
          if (vehicleFacts.length) block += `\nAbout this vehicle:\n${vehicleFacts.map((f: string) => `- ${f}`).join("\n")}`;
          if (symptoms.length) block += `\nActive symptoms:\n${symptoms.map((s: string) => `- ${s}`).join("\n")}`;
          if (pendingIssues.length) block += `\nPending issues:\n${pendingIssues.map((p: string) => `- ${p}`).join("\n")}`;
          if (completedRepairs.length) block += `\nRecent repairs:\n${completedRepairs.map((r: string) => `- ${r}`).join("\n")}`;
          block += "\n\nUse this context naturally. If a tool the user owns is needed, note they already have it. If a pending issue is relevant, connect the dots proactively.";
          memoryBlock = block;
        }
      } catch (e) {
        console.error("Memory fetch error:", e);
      }
    }

    // --- Inject charm.li factory data if relevant ---
    let charmBlock = "";
    if (vehicleId) {
      try {
        const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
        const charmKeywords = [
          'starter', 'alternator', 'catalytic', 'oxygen sensor', 'o2 sensor',
          'vtec', 'valve cover', 'timing chain', 'water pump', 'thermostat',
          'radiator', 'brake pad', 'brake rotor', 'strut', 'spark plug',
          'wheel bearing', 'cv axle', 'fuel pump', 'engine mount', 'control arm',
          'ac compressor', 'serpentine', 'drive belt', 'head gasket', 'power steering',
          'throttle body', 'ignition coil', 'oil pan', 'tie rod', 'ball joint',
          'brake caliper', 'sway bar', 'abs sensor', 'fuel injector', 'vtc actuator',
          'battery', 'transmission fluid', 'oil pump', 'camshaft', 'crankshaft',
          'maf sensor', 'mass air flow',
        ];
        const matchedKeyword = charmKeywords.find(kw => lastUserMsg.includes(kw));

        if (matchedKeyword && vehicleContext) {
          const yearMatch = vehicleContext.match(/(\d{4})/);
          const year = yearMatch ? parseInt(yearMatch[1]) : 0;
          if (year >= 1982 && year <= 2013) {
            const charmResp = await fetch(`${supabaseUrl}/functions/v1/fetch-charm-data`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({
                make: vehicleContext.match(/\d{4}\s+(\w+)/)?.[1] || '',
                year,
                model: vehicleContext.match(/\d{4}\s+\w+\s+(\w+)/)?.[1] || '',
                engine: vehicleContext.match(/Engine:\s*(.+)/i)?.[1]?.trim() || null,
                jobKeyword: matchedKeyword,
              }),
            });
            if (charmResp.ok) {
              const charmData = await charmResp.json();
              if (charmData.found && charmData.procedureText) {
                const torqueLines = (charmData.torqueSpecs || [])
                  .map((ts: any) => `${ts.context}: ${ts.value} ${ts.unit}`)
                  .join('; ');
                charmBlock = `\n\n## Factory Service Manual Reference (charm.li)\nThe following is from the official factory service manual. Use it as your primary reference. When citing torque specs from this data, append [📖 FSM] inline.\n\n${charmData.procedureText.slice(0, 4000)}${torqueLines ? `\n\nFactory torque specs: ${torqueLines}` : ''}`;
              }
            }
          }
        }
      } catch (charmErr) {
        console.error("Charm lookup in chat failed (non-fatal):", charmErr);
      }
    }

    let systemContent = SYSTEM_PROMPT + memoryBlock + charmBlock;
    if (vehicleContext) {
      systemContent += `\n\n${vehicleContext}\n\nAll advice must be specific to this exact vehicle.`;
    }

    // Process messages: handle multimodal content (images)
    const processedMessages = messages.map((msg: any) => {
      if (msg.images && msg.images.length > 0) {
        const contentParts: any[] = [];
        for (const img of msg.images) {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
            },
          });
        }
        if (msg.content) {
          contentParts.push({ type: "text", text: msg.content });
        }
        return { role: msg.role, content: contentParts };
      }
      return { role: msg.role, content: msg.content };
    });

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
          ...processedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
