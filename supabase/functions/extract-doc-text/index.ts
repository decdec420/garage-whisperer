import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Fetch the document record (must belong to this user)
    const { data: doc, error: docErr } = await supabase
      .from("vehicle_documents")
      .select("id, file_url, mime_type, user_id, title, description, external_url")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extractedText = "";

    if (doc.file_url && !doc.file_url.startsWith("http")) {
      // File is in Supabase storage - download it
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("vehicle-documents")
        .download(doc.file_url);

      if (dlErr || !fileData) {
        console.error("File download error:", dlErr);
        return new Response(JSON.stringify({ error: "Could not download file" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mimeType = doc.mime_type || "";

      if (mimeType === "application/pdf") {
        // Use AI vision to extract text from PDF by converting to base64
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

        const arrayBuf = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        
        // Convert to base64 for the API
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64,
                  },
                },
                {
                  type: "text",
                  text: `Extract ALL text content from this document. This is a vehicle-related document (likely an OBD2 diagnostic report, service record, or manual page). 
                  
Output the content as structured, readable text. For OBD2 reports specifically:
- List all DTCs (diagnostic trouble codes) with their descriptions
- Include freeze frame data if present
- Include readiness monitor statuses
- Include any live data readings
- Preserve all numerical values and units exactly

For other documents, extract all text faithfully preserving structure, headers, and data.
Do NOT add commentary - just extract the content.`,
                },
              ],
            }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          extractedText = aiData.content?.[0]?.text || "";
        } else {
          console.error("AI extraction failed:", aiResp.status, await aiResp.text());
        }
      } else if (mimeType.startsWith("image/")) {
        // Use vision to read the image
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

        const arrayBuf = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const mediaType = mimeType === "image/png" ? "image/png" 
          : mimeType === "image/webp" ? "image/webp"
          : mimeType === "image/gif" ? "image/gif"
          : "image/jpeg";

        const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data: base64 },
                },
                {
                  type: "text",
                  text: `Extract ALL text and data visible in this image. This is a vehicle-related image (likely an OBD2 scan screenshot, a diagnostic report, a part label, or a service record).

Extract every piece of text, number, code, and reading visible. Preserve the structure and grouping. For OBD2 screenshots: list all codes, statuses, PIDs, and readings with their values and units.

Do NOT add commentary - just extract the content faithfully.`,
                },
              ],
            }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          extractedText = aiData.content?.[0]?.text || "";
        } else {
          console.error("AI image extraction failed:", aiResp.status);
        }
      }
    }

    // Also include title and description as context
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

    if (updateErr) {
      console.error("Update error:", updateErr);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      extracted: extractedText.length > 0,
      textLength: fullText.length,
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
