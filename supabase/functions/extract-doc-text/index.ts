import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function callClaude(apiKey: string, messages: unknown[]) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages,
    }),
  });
  if (!resp.ok) {
    console.error("Claude API error:", resp.status, await resp.text());
    return null;
  }
  const data = await resp.json();
  return data.content?.[0]?.text || "";
}

async function extractTextFromFile(fileData: Blob, mimeType: string, apiKey: string): Promise<string> {
  const arrayBuf = await fileData.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  const base64 = toBase64(bytes);

  if (mimeType === "application/pdf") {
    return await callClaude(apiKey, [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: `Extract ALL text content from this document. This is a vehicle-related document (likely an OBD2 diagnostic report, service record, or manual page). 
Output the content as structured, readable text. For OBD2 reports specifically:
- List all DTCs (diagnostic trouble codes) with their descriptions
- Include freeze frame data if present
- Include readiness monitor statuses
- Include any live data readings
- Preserve all numerical values and units exactly
For other documents, extract all text faithfully preserving structure, headers, and data.
Do NOT add commentary - just extract the content.` },
      ],
    }]) || "";
  }

  if (mimeType.startsWith("image/")) {
    const mediaType = mimeType === "image/png" ? "image/png"
      : mimeType === "image/webp" ? "image/webp"
      : mimeType === "image/gif" ? "image/gif"
      : "image/jpeg";

    return await callClaude(apiKey, [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: `Extract ALL text and data visible in this image. This is a vehicle-related image (likely an OBD2 scan screenshot, a diagnostic report, a part label, or a service record).
Extract every piece of text, number, code, and reading visible. Preserve the structure and grouping. For OBD2 screenshots: list all codes, statuses, PIDs, and readings with their values and units.
Do NOT add commentary - just extract the content faithfully.` },
      ],
    }]) || "";
  }

  return "";
}

interface ParsedDTC {
  code: string;
  description: string | null;
  severity: string;
  status: string;
}

async function parseDTCsFromText(text: string, apiKey: string): Promise<ParsedDTC[]> {
  if (!text || text.length < 20) return [];

  // Quick check: does this text likely contain DTCs?
  const dtcPattern = /[PBCU]\d{4}/i;
  if (!dtcPattern.test(text)) return [];

  const result = await callClaude(apiKey, [{
    role: "user",
    content: `You are a DTC extraction engine. From the following vehicle document text, extract ALL diagnostic trouble codes (DTCs).

Return ONLY a JSON array. Each element: {"code":"P0101","description":"MAF Sensor Range/Performance","severity":"medium","status":"active"}

severity rules:
- "critical" = safety-related (brakes, airbag, steering, stability control)
- "high" = drivetrain, transmission, engine misfire
- "medium" = emissions, sensors, fuel system
- "low" = body, convenience, minor electrical

status rules:
- "active" = current/confirmed/permanent/stored
- "pending" = pending
- "history" = history/cleared but still showing

If no DTCs found, return [].
ONLY output the JSON array, nothing else.

Text:
${text.slice(0, 8000)}`,
  }]);

  if (!result) return [];

  try {
    // Extract JSON array from response
    const match = result.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    // Validate each entry
    return parsed.filter((d: any) =>
      d.code && typeof d.code === "string" && /^[PBCU]\d{4}$/i.test(d.code)
    ).map((d: any) => ({
      code: d.code.toUpperCase(),
      description: d.description || null,
      severity: ["critical","high","medium","low"].includes(d.severity) ? d.severity : "medium",
      status: ["active","pending","history"].includes(d.status) ? d.status : "active",
    }));
  } catch (e) {
    console.error("DTC parse error:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentId } = await req.json();
    if (!documentId || typeof documentId !== "string") {
      return new Response(JSON.stringify({ error: "documentId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc, error: docErr } = await supabase
      .from("vehicle_documents")
      .select("id, file_url, mime_type, user_id, title, description, external_url, vehicle_id")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    let extractedText = "";

    if (doc.file_url && !doc.file_url.startsWith("http") && ANTHROPIC_API_KEY) {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("vehicle-documents")
        .download(doc.file_url);

      if (dlErr || !fileData) {
        console.error("File download error:", dlErr);
        return new Response(JSON.stringify({ error: "Could not download file" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      extractedText = await extractTextFromFile(fileData, doc.mime_type || "", ANTHROPIC_API_KEY);
    }

    // Build full text with metadata
    const fullText = [
      `Document: ${doc.title}`,
      doc.description ? `Description: ${doc.description}` : "",
      extractedText ? `\nExtracted Content:\n${extractedText}` : "",
    ].filter(Boolean).join("\n");

    // Save extracted text
    const { error: updateErr } = await supabase
      .from("vehicle_documents")
      .update({ extracted_text: fullText })
      .eq("id", documentId);

    if (updateErr) console.error("Update error:", updateErr);

    // Auto-parse DTCs from extracted text
    let parsedDTCs: ParsedDTC[] = [];
    let newDTCCount = 0;

    if (extractedText && ANTHROPIC_API_KEY) {
      parsedDTCs = await parseDTCsFromText(extractedText, ANTHROPIC_API_KEY);

      if (parsedDTCs.length > 0 && doc.vehicle_id) {
        // Fetch existing DTCs to avoid duplicates
        const { data: existingDTCs } = await supabase
          .from("dtc_records")
          .select("code, status")
          .eq("vehicle_id", doc.vehicle_id);

        const existingCodes = new Set((existingDTCs || []).map((d: any) => d.code));

        const newDTCs = parsedDTCs.filter(d => !existingCodes.has(d.code));
        newDTCCount = newDTCs.length;

        if (newDTCs.length > 0) {
          const rows = newDTCs.map(d => ({
            vehicle_id: doc.vehicle_id,
            code: d.code,
            description: d.description,
            severity: d.severity,
            status: d.status,
            notes: `Auto-extracted from document: ${doc.title}`,
          }));

          const { error: insertErr } = await supabase
            .from("dtc_records")
            .insert(rows);

          if (insertErr) console.error("DTC insert error:", insertErr);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      extracted: extractedText.length > 0,
      textLength: fullText.length,
      dtcsParsed: parsedDTCs.length,
      newDTCs: newDTCCount,
      dtcCodes: parsedDTCs.map(d => d.code),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("extract-doc-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
