// Shared CORS helper for Ratchet edge functions.
// Restricts Access-Control-Allow-Origin to known production origins.

const ALLOWED_ORIGINS = [
  "https://getratchet.lovable.app",
  "https://id-preview--840bffc0-c3bf-4c34-9a32-101fbcab7f55.lovable.app",
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}
