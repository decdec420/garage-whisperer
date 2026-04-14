import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";



const R = "Repair%20and%20Diagnosis/";

const JOB_KEYWORD_MAP: Record<string, string | string[]> = {
  "front brake pad": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
  "rear brake pad": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  "brake pads": [
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  ],
  "brake pad": [
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement`,
    `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement`,
  ],
  "starter": `${R}Starting%20and%20Charging/Starter/Service%20and%20Repair`,
  "alternator": `${R}Starting%20and%20Charging/Generator/Alternator/Service%20and%20Repair`,
  "battery": `${R}Starting%20and%20Charging/Battery/Service%20and%20Repair`,
  "catalytic converter": `${R}Powertrain%20Management/Emission%20Control%20Systems/Catalytic%20Converter/Service%20and%20Repair`,
  "oxygen sensor": `${R}Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair`,
  "o2 sensor": `${R}Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor/Service%20and%20Repair`,
  "vtec solenoid": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Actuators%20and%20Solenoids%20-%20Engine/Variable%20Valve%20Timing%20Solenoid`,
  "valve cover gasket": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Valve%20Cover/Service%20and%20Repair`,
  "valve cover": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Valve%20Cover/Service%20and%20Repair`,
  "timing chain": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Timing%20Components/Service%20and%20Repair`,
  "water pump": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Water%20Pump/Service%20and%20Repair`,
  "thermostat": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Thermostat/Service%20and%20Repair`,
  "radiator": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator/Service%20and%20Repair`,
  "brake rotors": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Rotor%2FDisc/Service%20and%20Repair`,
  "brake rotor": `${R}Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Rotor%2FDisc/Service%20and%20Repair`,
  "strut": `${R}Steering%20and%20Suspension/Front%20Suspension/Strut/Service%20and%20Repair`,
  "spark plugs": `${R}Powertrain%20Management/Ignition%20System/Spark%20Plug/Service%20and%20Repair`,
  "spark plug": `${R}Powertrain%20Management/Ignition%20System/Spark%20Plug/Service%20and%20Repair`,
  "transmission fluid": `${R}Transmission%20and%20Drivetrain/Automatic%20Transmission%2FTransaxle/Fluid/Service%20and%20Repair`,
  "power steering": `${R}Steering%20and%20Suspension/Steering/Power%20Steering/Service%20and%20Repair`,
  "ac compressor": `${R}Heating%20and%20Air%20Conditioning/Compressor/Service%20and%20Repair`,
  "ac line": `${R}Heating%20and%20Air%20Conditioning/Hose%2FLine%20HVAC/Service%20and%20Repair`,
  "wheel bearing": `${R}Steering%20and%20Suspension/Front%20Suspension/Wheel%20Bearing/Service%20and%20Repair`,
  "cv axle": `${R}Transmission%20and%20Drivetrain/Drive%20Axles/CV%20Axle/Service%20and%20Repair`,
  "tie rod": `${R}Steering%20and%20Suspension/Steering/Tie%20Rod/Service%20and%20Repair`,
  "ball joint": `${R}Steering%20and%20Suspension/Front%20Suspension/Ball%20Joint/Service%20and%20Repair`,
  "fuel pump": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Pump/Service%20and%20Repair`,
  "fuel injector": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Injector/Service%20and%20Repair`,
  "throttle body": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Throttle%20Body/Service%20and%20Repair`,
  "mass air flow": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Air%20Flow%20Meter%2FSensor/Service%20and%20Repair`,
  "maf sensor": `${R}Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Air%20Flow%20Meter%2FSensor/Service%20and%20Repair`,
  "crankshaft sensor": `${R}Powertrain%20Management/Ignition%20System/Crankshaft%20Position%20Sensor/Service%20and%20Repair`,
  "camshaft sensor": `${R}Powertrain%20Management/Ignition%20System/Camshaft%20Position%20Sensor/Service%20and%20Repair`,
  "ignition coil": `${R}Powertrain%20Management/Ignition%20System/Ignition%20Coil/Service%20and%20Repair`,
  "oil pan": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication/Oil%20Pan/Service%20and%20Repair`,
  "oil pump": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication/Oil%20Pump/Service%20and%20Repair`,
  "vtc actuator": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Camshaft%2C%20Lifters%20and%20Push%20Rods/Variable%20Valve%20Timing%20Actuator`,
  "head gasket": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Service%20and%20Repair`,
  "power steering rack": `${R}Steering%20and%20Suspension/Steering/Power%20Steering/Service%20and%20Repair`,
  "sway bar": `${R}Steering%20and%20Suspension/Front%20Suspension/Stabilizer%20Bar/Service%20and%20Repair`,
  "control arm": `${R}Steering%20and%20Suspension/Front%20Suspension/Control%20Arm/Service%20and%20Repair`,
  "abs sensor": `${R}Brakes%20and%20Traction%20Control/Anti-Lock%20Brakes/Wheel%20Speed%20Sensor/Service%20and%20Repair`,
  "brake caliper": `${R}Brakes%20and%20Traction%20Control/Hydraulic%20System/Brake%20Caliper/Service%20and%20Repair`,
  "brake master cylinder": `${R}Brakes%20and%20Traction%20Control/Hydraulic%20System/Master%20Cylinder/Service%20and%20Repair`,
  "radiator hose": `${R}Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator%20Hose/Service%20and%20Repair`,
  "serpentine belt": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt/Service%20and%20Repair`,
  "drive belt": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt/Service%20and%20Repair`,
  "engine mount": `${R}Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount/Service%20and%20Repair`,
};

function matchJobKeyword(jobDescription: string): string | string[] | null {
  const lower = jobDescription.toLowerCase();
  let bestMatch: string | string[] | null = null;
  let bestLength = 0;
  for (const [keyword, path] of Object.entries(JOB_KEYWORD_MAP)) {
    if (lower.includes(keyword) && keyword.length > bestLength) {
      bestMatch = path;
      bestLength = keyword.length;
    }
  }
  return bestMatch;
}

const STANDARD_DISPLACEMENTS = [1.0, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 3.0, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 4.0, 4.2, 4.3, 4.6, 4.7, 5.0, 5.3, 5.4, 5.7, 6.0, 6.2, 6.4, 6.6, 6.7, 7.0, 7.3];

function roundDisplacement(raw: number): string {
  let closest = STANDARD_DISPLACEMENTS[0];
  let minDiff = Math.abs(raw - closest);
  for (const std of STANDARD_DISPLACEMENTS) {
    const diff = Math.abs(raw - std);
    if (diff < minDiff) { closest = std; minDiff = diff; }
  }
  return closest.toFixed(1);
}

function titleCaseMake(make: string): string {
  if (make.length <= 3) return make.toUpperCase();
  return make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
}

function formatEngineForCharm(engine: string | null, model: string): string {
  if (!engine) return model;
  const dm = engine.match(/(\d+\.?\d*)\s*L/i);
  const rawD = dm ? parseFloat(dm[1]) : null;
  const d = rawD ? roundDisplacement(rawD) : null;
  let c = '';
  if (/V\s*6|V6/i.test(engine)) c = 'V6';
  else if (/V\s*8|V8/i.test(engine)) c = 'V8';
  else if (/I\s*4|L4|4[\s-]?cyl|inline[\s-]?4/i.test(engine)) c = 'L4';
  else if (/I\s*6|L6|inline[\s-]?6/i.test(engine)) c = 'L6';
  if (d && c) return `${model} ${c}-${d}L`;
  if (d) return `${model} ${d}L`;
  return model;
}

function extractImages(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src.includes('charm.li/images') || (src.includes('/images/') && !src.includes('/icons/'))) {
      const url = src.startsWith('http') ? src : `https://charm.li${src.startsWith('/') ? '' : '/'}${src}`;
      images.push(url);
    }
  }
  return [...new Set(images)];
}

function extractProcedureText(html: string): string {
  let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  const parts: string[] = [];
  const contentRegex = /<(?:p|li|td|div|span|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|li|td|div|span|h[1-6])>/gi;
  let match;
  while ((match = contentRegex.exec(cleaned)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, '')
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

/** Extract images with their surrounding text context for AI assignment */
function extractImagesWithContext(html: string): Array<{ url: string; context: string }> {
  const results: Array<{ url: string; context: string }> = [];
  // Split HTML by img tags and grab surrounding text
  const imgRegex = /(?:<(?:p|li|div|span|td)[^>]*>([^<]{0,200})<\/(?:p|li|div|span|td)>\s*)?<img[^>]+src=["']([^"']+)["'][^>]*>(?:\s*<(?:p|li|div|span|td)[^>]*>([^<]{0,200})<\/(?:p|li|div|span|td)>)?/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[2];
    if (src.includes('charm.li/images') || (src.includes('/images/') && !src.includes('/icons/'))) {
      const url = src.startsWith('http') ? src : `https://charm.li${src.startsWith('/') ? '' : '/'}${src}`;
      const before = (match[1] || '').replace(/<[^>]+>/g, '').trim();
      const after = (match[3] || '').replace(/<[^>]+>/g, '').trim();
      const context = [before, after].filter(Boolean).join(' — ') || 'Factory diagram';
      results.push({ url, context });
    }
  }
  // Dedupe by URL
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

function extractTorqueSpecs(text: string): Array<{ value: string; unit: string; context: string }> {
  const specs: Array<{ value: string; unit: string; context: string }> = [];
  const torqueRegex = /(\d+(?:\.\d+)?)\s*(ft[\s·.-]?lb[s]?|N[\s·.-]?m)/gi;
  let match;
  while ((match = torqueRegex.exec(text)) !== null) {
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    // userId available if needed: claimsData.claims.sub

    const { make, year, model, jobKeyword, engine } = await req.json();

    if (!make || !year || !model || !jobKeyword) {
      return new Response(JSON.stringify({ error: "make, year, model, jobKeyword required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (year < 1982 || year > 2013) {
      return new Response(JSON.stringify({ found: false, reason: "Vehicle year outside charm.li coverage (1982-2013)" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const pathResult = matchJobKeyword(jobKeyword);
    if (!pathResult) {
      return new Response(JSON.stringify({ found: false, reason: "No matching procedure path for this job" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const paths = Array.isArray(pathResult) ? pathResult : [pathResult];
    const charmMake = titleCaseMake(make);
    const charmModel = formatEngineForCharm(engine || null, model);
    const encodedModel = encodeURIComponent(charmModel);
    const charmUrls = paths.map(p => `https://charm.li/${charmMake}/${year}/${encodedModel}/${p}/`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Aggregate results from all URLs
    let allImages: Array<{ url: string; context: string }> = [];
    let allText = '';
    let allTorqueSpecs: Array<{ value: string; unit: string; context: string }> = [];
    const fetchedUrls: string[] = [];

    for (const charmUrl of charmUrls) {
      // Check cache first
      const { data: cached } = await supabase
        .from("charm_cache")
        .select("*")
        .eq("charm_url", charmUrl)
        .single();

      if (cached) {
        const fetchedAt = new Date(cached.fetched_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (fetchedAt > thirtyDaysAgo && (cached.procedure_text?.length > 50 || (cached.images?.length > 0))) {
          allText += `\n\n--- ${charmUrl} ---\n${cached.procedure_text || ''}`;
          (cached.images || []).forEach((img: string) => allImages.push({ url: img, context: 'Factory diagram (cached)' }));
          allTorqueSpecs.push(...(cached.torque_specs || []));
          fetchedUrls.push(charmUrl);
          continue;
        }
      }

      // Fetch live
      console.log(`Fetching charm.li: ${charmUrl}`);
      try {
        const response = await fetch(charmUrl, {
          headers: { "User-Agent": "RatchetApp/1.0 (Vehicle Repair Assistant)" },
        });

        if (!response.ok) {
          console.log(`Charm.li returned ${response.status} for ${charmUrl}`);
          continue;
        }

        const html = await response.text();
        const images = extractImagesWithContext(html);
        const procedureText = extractProcedureText(html);
        const torqueSpecs = extractTorqueSpecs(procedureText);
        const imageUrls = images.map(i => i.url);

        if (procedureText.length < 50 && images.length === 0) continue;

        // Upsert cache
        if (cached) {
          await supabase.from("charm_cache").update({
            images: imageUrls,
            procedure_text: procedureText,
            torque_specs: torqueSpecs,
            fetched_at: new Date().toISOString(),
          }).eq("id", cached.id);
        } else {
          await supabase.from("charm_cache").insert({
            charm_url: charmUrl,
            images: imageUrls,
            procedure_text: procedureText,
            torque_specs: torqueSpecs,
          });
        }

        allText += `\n\n--- ${charmUrl} ---\n${procedureText}`;
        allImages.push(...images);
        allTorqueSpecs.push(...torqueSpecs);
        fetchedUrls.push(charmUrl);
      } catch (fetchErr) {
        console.error(`Charm.li fetch error for ${charmUrl}:`, fetchErr);
        continue;
      }
    }

    if (fetchedUrls.length === 0) {
      return new Response(JSON.stringify({ found: false, reason: "No charm.li content found for any matching URL" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Dedupe images by URL
    const seenUrls = new Set<string>();
    allImages = allImages.filter(img => {
      if (seenUrls.has(img.url)) return false;
      seenUrls.add(img.url);
      return true;
    });

    return new Response(JSON.stringify({
      found: true,
      charmUrls: fetchedUrls,
      charmUrl: fetchedUrls[0], // backwards compat
      images: allImages.map(i => i.url),
      imagesWithContext: allImages,
      procedureText: allText.trim(),
      torqueSpecs: allTorqueSpecs,
      cached: false,
    }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  } catch (e) {
    console.error("fetch-charm-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
