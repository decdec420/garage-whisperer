import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"; 
import { getCorsHeaders } from "../_shared/cors.ts";



const EXTRACTION_PROMPT = `Review this conversation exchange and extract any facts worth remembering about the user or their vehicle. Return a JSON array of memory objects or empty array [].

Format: [{"type": "tool_owned|user_fact|vehicle_fact|symptom|completed_repair|pending_issue", "content": "plain English fact", "vehicle_specific": true}]

Only extract concrete, specific facts. Skip opinions, general automotive advice, and greetings.

Examples of good memories:
- {"type": "tool_owned", "content": "User owns a 10mm deep socket and 3/8 ratchet", "vehicle_specific": false}
- {"type": "symptom", "content": "P2270 permanent lean code on vehicle", "vehicle_specific": true}
- {"type": "vehicle_fact", "content": "O2 downstream sensor covered in oil — likely VTEC solenoid gasket leak", "vehicle_specific": true}
- {"type": "completed_repair", "content": "User completed starter replacement", "vehicle_specific": true}
- {"type": "user_fact", "content": "User prefers OEM Honda parts when cost-effective", "vehicle_specific": false}
- {"type": "pending_issue", "content": "Needs to replace downstream O2 sensor Denso 234-4359", "vehicle_specific": true}

Conversation:`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    // --- JWT Authentication ---
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

    const { userMessage, assistantMessage, vehicleId, sessionId } = await req.json();

    // --- Input validation ---
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (vehicleId && !UUID_RE.test(vehicleId)) {
      return new Response(JSON.stringify({ error: "Invalid vehicleId format" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (sessionId && !UUID_RE.test(sessionId)) {
      return new Response(JSON.stringify({ error: "Invalid sessionId format" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (typeof userMessage !== 'string' || userMessage.length > 5000) {
      return new Response(JSON.stringify({ error: "userMessage must be a string under 5000 chars" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (typeof assistantMessage !== 'string' || assistantMessage.length > 10000) {
      return new Response(JSON.stringify({ error: "assistantMessage must be a string under 10000 chars" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify vehicleId belongs to authenticated user
    if (vehicleId) {
      const { data: vehicle } = await supabase
        .from("vehicles").select("id").eq("id", vehicleId).eq("user_id", userId).single();
      if (!vehicle) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    // Verify sessionId belongs to authenticated user
    if (sessionId) {
      const { data: session } = await supabase
        .from("chat_sessions").select("id").eq("id", sessionId).eq("user_id", userId).single();
      if (!session) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    const conversationText = `User: ${userMessage}\nAssistant: ${assistantMessage}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You extract factual memories from mechanic conversations. Return only valid JSON arrays. Be selective — only extract concrete, useful facts." },
          { role: "user", content: `${EXTRACTION_PROMPT}\n${conversationText}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_memories",
            description: "Save extracted memories from the conversation",
            parameters: {
              type: "object",
              properties: {
                memories: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["tool_owned", "user_fact", "vehicle_fact", "symptom", "completed_repair", "pending_issue"] },
                      content: { type: "string" },
                      vehicle_specific: { type: "boolean" },
                    },
                    required: ["type", "content", "vehicle_specific"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["memories"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_memories" } },
      }),
    });

    if (!response.ok) {
      console.error("AI extraction error:", response.status);
      return new Response(JSON.stringify({ extracted: 0 }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ extracted: 0 }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let memories: any[];
    try {
      const args = JSON.parse(toolCall.function.arguments);
      memories = args.memories || [];
    } catch {
      return new Response(JSON.stringify({ extracted: 0 }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (memories.length === 0) {
      return new Response(JSON.stringify({ extracted: 0 }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check for duplicate memories before inserting
    const { data: existing } = await supabase
      .from("ratchet_memory")
      .select("content")
      .eq("user_id", userId);

    const existingContents = new Set((existing || []).map((m: any) => m.content.toLowerCase()));

    const newMemories = memories
      .filter((m: any) => !existingContents.has(m.content.toLowerCase()))
      .map((m: any) => ({
        user_id: userId,
        vehicle_id: m.vehicle_specific ? vehicleId : null,
        memory_type: m.type,
        content: m.content,
        source_session_id: sessionId,
      }));

    if (newMemories.length > 0) {
      const { error } = await supabase.from("ratchet_memory").insert(newMemories);
      if (error) console.error("Memory insert error:", error);
    }

    return new Response(JSON.stringify({ extracted: newMemories.length }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-memories error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
