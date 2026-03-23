import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Job keyword to charm.li URL path mapping
const JOB_KEYWORD_MAP: Record<string, string> = {
  "starter": "Starting%20and%20Charging/Starter/Service%20and%20Repair",
  "alternator": "Starting%20and%20Charging/Generator/Alternator/Service%20and%20Repair",
  "battery": "Starting%20and%20Charging/Battery/Service%20and%20Repair",
  "catalytic converter": "Powertrain%20Management/Emission%20Control%20Systems/Catalytic%20Converter/Service%20and%20Repair",
  "oxygen sensor": "Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair",
  "o2 sensor": "Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair",
  "vtec solenoid": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Variable%20Valve%20Timing%20Solenoid/Service%20and%20Repair",
  "valve cover gasket": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Valve%20Cover/Service%20and%20Repair",
  "timing chain": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Timing%20Components/Service%20and%20Repair",
  "water pump": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Water%20Pump/Service%20and%20Repair",
  "thermostat": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Thermostat/Service%20and%20Repair",
  "radiator": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator/Service%20and%20Repair",
  "brake pads": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pads/Service%20and%20Repair",
  "brake rotors": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Rotor/Service%20and%20Repair",
  "strut": "Steering%20and%20Suspension/Front%20Suspension/Strut/Service%20and%20Repair",
  "spark plugs": "Powertrain%20Management/Ignition%20System/Spark%20Plug/Service%20and%20Repair",
  "transmission fluid": "Transmission%20and%20Drivetrain/Automatic%20Transmission%2FTransaxle/Fluid/Service%20and%20Repair",
  "power steering": "Steering%20and%20Suspension/Steering/Power%20Steering/Service%20and%20Repair",
  "ac compressor": "Heating%20and%20Air%20Conditioning/Compressor/Service%20and%20Repair",
  "ac line": "Heating%20and%20Air%20Conditioning/Hose%2FLine%20HVAC/Service%20and%20Repair",
  "wheel bearing": "Steering%20and%20Suspension/Front%20Suspension/Wheel%20Bearing/Service%20and%20Repair",
  "cv axle": "Transmission%20and%20Drivetrain/Drive%20Axles/CV%20Axle/Service%20and%20Repair",
  "tie rod": "Steering%20and%20Suspension/Steering/Tie%20Rod/Service%20and%20Repair",
  "ball joint": "Steering%20and%20Suspension/Front%20Suspension/Ball%20Joint/Service%20and%20Repair",
  "fuel pump": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Pump/Service%20and%20Repair",
  "fuel injector": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Injector/Service%20and%20Repair",
  "throttle body": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Throttle%20Body/Service%20and%20Repair",
  "mass air flow": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Air%20Flow%20Meter%2FSensor/Service%20and%20Repair",
  "maf sensor": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Air%20Flow%20Meter%2FSensor/Service%20and%20Repair",
  "crankshaft sensor": "Powertrain%20Management/Ignition%20System/Crankshaft%20Position%20Sensor/Service%20and%20Repair",
  "camshaft sensor": "Powertrain%20Management/Ignition%20System/Camshaft%20Position%20Sensor/Service%20and%20Repair",
  "ignition coil": "Powertrain%20Management/Ignition%20System/Ignition%20Coil/Service%20and%20Repair",
  "oil pan": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication/Oil%20Pan/Service%20and%20Repair",
  "oil pump": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication/Oil%20Pump/Service%20and%20Repair",
  "vtc actuator": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Service%20and%20Repair",
  "head gasket": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Service%20and%20Repair",
  "power steering rack": "Steering%20and%20Suspension/Steering/Power%20Steering/Service%20and%20Repair",
  "sway bar": "Steering%20and%20Suspension/Front%20Suspension/Stabilizer%20Bar/Service%20and%20Repair",
  "control arm": "Steering%20and%20Suspension/Front%20Suspension/Control%20Arm/Service%20and%20Repair",
  "abs sensor": "Brakes%20and%20Traction%20Control/Anti-Lock%20Brakes/Wheel%20Speed%20Sensor/Service%20and%20Repair",
  "brake caliper": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Caliper/Service%20and%20Repair",
  "brake master cylinder": "Brakes%20and%20Traction%20Control/Hydraulic%20System/Master%20Cylinder/Service%20and%20Repair",
  "radiator hose": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator%20Hose/Service%20and%20Repair",
  "serpentine belt": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts/Service%20and%20Repair",
  "drive belt": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts/Service%20and%20Repair",
  "engine mount": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount/Service%20and%20Repair",
};

function matchJobKeyword(jobDescription: string): string | null {
  const lower = jobDescription.toLowerCase();
  let bestMatch: string | null = null;
  let bestLength = 0;
  for (const [keyword, path] of Object.entries(JOB_KEYWORD_MAP)) {
    if (lower.includes(keyword) && keyword.length > bestLength) {
      bestMatch = path;
      bestLength = keyword.length;
    }
  }
  return bestMatch;
}

function formatEngineForCharm(engine: string | null, model: string): string {
  if (!engine) return model;
  const displacementMatch = engine.match(/(\d+\.\d+)\s*L/i);
  const displacement = displacementMatch ? displacementMatch[1] : null;
  let cylConfig = '';
  if (/V\s*6|V6/i.test(engine)) cylConfig = 'V6';
  else if (/V\s*8|V8/i.test(engine)) cylConfig = 'V8';
  else if (/I\s*4|L4|4[\s-]?cyl|inline[\s-]?4/i.test(engine)) cylConfig = 'L4';
  else if (/I\s*6|L6|inline[\s-]?6/i.test(engine)) cylConfig = 'L6';
  if (displacement && cylConfig) return `${model} ${cylConfig}-${displacement}L`;
  if (displacement) return `${model} ${displacement}L`;
  return model;
}

function extractImages(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src.includes('charm.li/images') || src.includes('/images/')) {
      // Make absolute if relative
      const url = src.startsWith('http') ? src : `https://charm.li${src.startsWith('/') ? '' : '/'}${src}`;
      images.push(url);
    }
  }
  return [...new Set(images)]; // dedupe
}

function extractProcedureText(html: string): string {
  // Remove script/style tags first
  let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Extract text from content-bearing tags
  const parts: string[] = [];
  const contentRegex = /<(?:p|li|td|div|span|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|li|td|div|span|h[1-6])>/gi;
  let match;
  while ((match = contentRegex.exec(cleaned)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, '') // strip nested tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 5) parts.push(text);
  }
  return [...new Set(parts)].join('\n');
}

function extractTorqueSpecs(text: string): Array<{ value: string; unit: string; context: string }> {
  const specs: Array<{ value: string; unit: string; context: string }> = [];
  const torqueRegex = /(\d+(?:\.\d+)?)\s*(ft[\s·.-]?lb[s]?|N[\s·.-]?m)/gi;
  let match;
  while ((match = torqueRegex.exec(text)) !== null) {
    // Get surrounding context (30 chars before)
    const start = Math.max(0, match.index - 60);
    const context = text.slice(start, match.index).replace(/\n/g, ' ').trim();
    specs.push({
      value: match[1],
      unit: match[2].replace(/[\s·.-]/g, ' ').trim(),
      context: context.split('.').pop()?.trim() || '',
    });
  }
  return specs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { make, year, model, jobKeyword, engine } = await req.json();

    if (!make || !year || !model || !jobKeyword) {
      return new Response(JSON.stringify({ error: "make, year, model, jobKeyword required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Year coverage check
    if (year < 1982 || year > 2013) {
      return new Response(JSON.stringify({ found: false, reason: "Vehicle year outside charm.li coverage (1982-2013)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const path = matchJobKeyword(jobKeyword);
    if (!path) {
      return new Response(JSON.stringify({ found: false, reason: "No matching procedure path for this job" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const charmModel = formatEngineForCharm(engine || null, model);
    const encodedModel = encodeURIComponent(charmModel);
    const charmUrl = `https://charm.li/${make}/${year}/${encodedModel}/${path}/`;

    // Check cache
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: cached } = await supabase
      .from("charm_cache")
      .select("*")
      .eq("charm_url", charmUrl)
      .single();

    if (cached) {
      const fetchedAt = new Date(cached.fetched_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (fetchedAt > thirtyDaysAgo) {
        return new Response(JSON.stringify({
          found: true,
          charmUrl,
          images: cached.images || [],
          procedureText: cached.procedure_text || '',
          torqueSpecs: cached.torque_specs || [],
          cached: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fetch from charm.li
    console.log(`Fetching charm.li: ${charmUrl}`);
    let response: Response;
    try {
      response = await fetch(charmUrl, {
        headers: { "User-Agent": "RatchetApp/1.0 (Vehicle Repair Assistant)" },
      });
    } catch (fetchErr) {
      console.error("Charm.li fetch error:", fetchErr);
      return new Response(JSON.stringify({ found: false, reason: "Failed to reach charm.li" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      console.log(`Charm.li returned ${response.status} for ${charmUrl}`);
      return new Response(JSON.stringify({ found: false, reason: `charm.li returned ${response.status}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await response.text();
    const images = extractImages(html);
    const procedureText = extractProcedureText(html);
    const torqueSpecs = extractTorqueSpecs(procedureText);

    // If we got basically nothing, report not found
    if (procedureText.length < 50 && images.length === 0) {
      return new Response(JSON.stringify({ found: false, reason: "Page found but no useful content extracted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert cache
    if (cached) {
      await supabase.from("charm_cache").update({
        images,
        procedure_text: procedureText,
        torque_specs: torqueSpecs,
        fetched_at: new Date().toISOString(),
      }).eq("id", cached.id);
    } else {
      await supabase.from("charm_cache").insert({
        charm_url: charmUrl,
        images,
        procedure_text: procedureText,
        torque_specs: torqueSpecs,
      });
    }

    return new Response(JSON.stringify({
      found: true,
      charmUrl,
      images,
      procedureText,
      torqueSpecs,
      cached: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("fetch-charm-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
