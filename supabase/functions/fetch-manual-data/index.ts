import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const LEMON_BASE = "https://lemon-manuals.la";

const STANDARD_DISPLACEMENTS = [
  1.0, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 3.0, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 4.0,
  4.2, 4.3, 4.6, 4.7, 5.0, 5.3, 5.4, 5.7, 6.0, 6.2, 6.4, 6.6, 6.7, 7.0, 7.3,
];

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

function normalizeDrivetrain(dt: string | null | undefined): string | null {
  if (!dt) return null;
  const u = dt.toUpperCase().replace(/[\s-]/g, '');
  if (u === 'FWD' || u.includes('FRONTWHEEL')) return 'FWD';
  if (u === 'RWD' || u.includes('REARWHEEL')) return 'RWD';
  if (u === 'AWD' || u.includes('ALLWHEEL')) return 'AWD';
  if (u === '4WD' || u === '4X4' || u.includes('FOURWHEEL')) return '4WD';
  if (u === '2WD' || u === '2X4' || u.includes('TWOWHEEL')) return '2WD';
  return null;
}

function formatEngineForManual(engine: string | null, model: string, drivetrain?: string | null): string {
  const dt = normalizeDrivetrain(drivetrain);
  if (!engine) return dt ? `${model} ${dt}` : model;
  const dm = engine.match(/(\d+\.?\d*)\s*L/i);
  const rawD = dm ? parseFloat(dm[1]) : null;
  const d = rawD ? roundDisplacement(rawD) : null;
  let c = '';
  if (/V\s*6|V6/i.test(engine)) c = 'V6';
  else if (/V\s*8|V8/i.test(engine)) c = 'V8';
  else if (/I\s*4|L4|4[\s-]?cyl|inline[\s-]?4/i.test(engine)) c = 'L4';
  else if (/I\s*6|L6|inline[\s-]?6/i.test(engine)) c = 'L6';
  let enginePart = '';
  if (d && c) enginePart = `${c}-${d}L`;
  else if (d) enginePart = `${d}L`;
  const parts = [model];
  if (dt) parts.push(dt);
  if (enginePart) parts.push(enginePart);
  return parts.join(' ');
}

// Corrected path map matching actual lemon-manuals.la structure
const PATH_MAP: Record<string, string> = {
  // Starting and Charging
  "starter": "Starting%20and%20Charging/Starting%20System/Starter%20Motor",
  "alternator": "Starting%20and%20Charging/Charging%20System/Alternator",
  "battery": "Starting%20and%20Charging/Battery",
  "starter relay": "Starting%20and%20Charging/Starting%20System/Starter%20Relay",
  "starter solenoid": "Starting%20and%20Charging/Starting%20System/Starter%20Solenoid",
  "won't start": "Starting%20and%20Charging",
  "no start": "Starting%20and%20Charging",
  "crank": "Starting%20and%20Charging",
  "click": "Starting%20and%20Charging",

  // Engine, Cooling and Exhaust
  "vtc actuator": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly",
  "vtec solenoid": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Actuators%20and%20Solenoids%20-%20Engine/Variable%20Valve%20Timing%20Solenoid",
  "valve cover gasket": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Valve%20Cover",
  "valve cover": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly/Valve%20Cover",
  "timing chain": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Timing%20Components",
  "water pump": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Water%20Pump",
  "thermostat": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Thermostat",
  "radiator hose": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator%20Hose",
  "radiator": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System/Radiator",
  "serpentine belt": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt",
  "drive belt": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Drive%20Belt",
  "engine mount": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount",
  "oil pan": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication/Oil%20Pan",
  "oil pump": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication/Oil%20Pump",
  "head gasket": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly",
  "exhaust manifold": "Engine%2C%20Cooling%20and%20Exhaust/Exhaust/Exhaust%20Manifold",
  "coolant": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System",
  "overheat": "Engine%2C%20Cooling%20and%20Exhaust/Cooling%20System",
  "oil leak": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication",
  "oil": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Engine%20Lubrication",
  "noise": "Engine%2C%20Cooling%20and%20Exhaust",

  // Powertrain Management
  "catalytic converter": "Powertrain%20Management/Emission%20Control%20Systems/Catalytic%20Converter",
  "oxygen sensor": "Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor",
  "o2 sensor": "Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor",
  "spark plugs": "Powertrain%20Management/Ignition%20System/Spark%20Plug",
  "spark plug": "Powertrain%20Management/Ignition%20System/Spark%20Plug",
  "ignition coil": "Powertrain%20Management/Ignition%20System/Ignition%20Coil",
  "crankshaft sensor": "Powertrain%20Management/Ignition%20System/Crankshaft%20Position%20Sensor",
  "camshaft sensor": "Powertrain%20Management/Ignition%20System/Camshaft%20Position%20Sensor",
  "fuel injector": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Injector",
  "fuel pump": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Fuel%20Pump",
  "throttle body": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Throttle%20Body",
  "maf sensor": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Air%20Flow%20Meter%2FSensor",
  "mass air flow": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction/Air%20Flow%20Meter%2FSensor",
  "check engine": "Powertrain%20Management",
  "misfire": "Powertrain%20Management/Ignition%20System",
  "rough idle": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction",
  "idle": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction",
  "stall": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction",
  "fuel": "Powertrain%20Management/Fuel%20Delivery%20and%20Air%20Induction",
  "ignition": "Powertrain%20Management/Ignition%20System",

  // Brakes
  "front brake pad": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement",
  "rear brake pad": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement",
  "brake pads": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad",
  "brake pad": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad",
  "brake rotors": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Rotor%2FDisc",
  "brake rotor": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Rotor%2FDisc",
  "brake caliper": "Brakes%20and%20Traction%20Control/Hydraulic%20System/Brake%20Caliper",
  "brake master cylinder": "Brakes%20and%20Traction%20Control/Hydraulic%20System/Master%20Cylinder",
  "abs sensor": "Brakes%20and%20Traction%20Control/Antilock%20Brakes%20%2F%20Traction%20Control%20Systems/Wheel%20Speed%20Sensor",
  "brake": "Brakes%20and%20Traction%20Control",
  "abs": "Brakes%20and%20Traction%20Control/Anti-Lock%20Brakes",

  // Steering and Suspension
  "strut": "Steering%20and%20Suspension/Front%20Suspension/Strut",
  "ball joint": "Steering%20and%20Suspension/Front%20Suspension/Ball%20Joint",
  "control arm": "Steering%20and%20Suspension/Front%20Suspension/Control%20Arm",
  "wheel bearing": "Steering%20and%20Suspension/Front%20Suspension/Wheel%20Bearing",
  "sway bar": "Steering%20and%20Suspension/Front%20Suspension/Stabilizer%20Bar",
  "tie rod": "Steering%20and%20Suspension/Steering/Tie%20Rod",
  "power steering": "Steering%20and%20Suspension/Steering/Power%20Steering",
  "suspension": "Steering%20and%20Suspension",

  // Transmission
  "cv axle": "Transmission%20and%20Drivetrain/Drive%20Axles",
  "transmission fluid": "Transmission%20and%20Drivetrain/Automatic%20Transmission%2FTransaxle/Fluid",
  "transmission": "Transmission%20and%20Drivetrain",
  "vibration": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Drive%20Belts%2C%20Mounts%2C%20Brackets%20and%20Accessories/Engine%20Mount",

  // HVAC
  "ac compressor": "Heating%20and%20Air%20Conditioning/Compressor",
  "ac line": "Heating%20and%20Air%20Conditioning/Hose%2FLine%20HVAC",
  "ac": "Heating%20and%20Air%20Conditioning",
  "air conditioning": "Heating%20and%20Air%20Conditioning",
  "cabin air filter": "Maintenance/Filters",
};

const SUB_PAGE_PATHS = [
  "",
  "Service%20and%20Repair",
  "Service%20and%20Repair/Removal",
  "Service%20and%20Repair/Installation",
  "Service%20and%20Repair/Removal%20and%20Replacement",
  "Service%20and%20Repair/Overhaul",
  "Locations",
  "Description%20and%20Operation",
  "Testing%20and%20Inspection",
  "Specifications",
  "Diagrams",
];

function matchKeyword(job: string): string | null {
  const lower = job.toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const [kw, path] of Object.entries(PATH_MAP)) {
    if (lower.includes(kw) && kw.length > bestLen) {
      best = path;
      bestLen = kw.length;
    }
  }
  return best;
}

function extractImages(html: string): Array<{ url: string; context: string; page: string }> {
  const results: Array<{ url: string; context: string; page: string }> = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    const alt = match[2] || '';
    if (src.includes('/icons/') || src.endsWith('.svg')) continue;
    if (src.includes('/images/') || src.includes('lemon-manuals.la/images')) {
      let url: string;
      if (src.startsWith('http')) url = src;
      else if (src.startsWith('/')) url = `${LEMON_BASE}${src}`;
      else url = `${LEMON_BASE}/${src}`;
      const start = Math.max(0, match.index - 200);
      const end = Math.min(html.length, match.index + match[0].length + 200);
      const surrounding = html.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const context = alt || surrounding.slice(0, 120);
      results.push({ url, context, page: '' });
    }
  }
  return results;
}

function extractText(html: string): string {
  let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  cleaned = cleaned.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  cleaned = cleaned.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  const parts: string[] = [];
  const re = /<(?:p|li|td|div|span|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|li|td|div|span|h[1-6])>/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const t = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();
    if (t.length > 5) parts.push(t);
  }
  return [...new Set(parts)].join('\n');
}

function extractTorqueSpecs(text: string): Array<{ value: string; unit: string; context: string }> {
  const specs: Array<{ value: string; unit: string; context: string }> = [];
  const re = /(\d+(?:\.\d+)?)\s*(ft[\s·.\-]?lb[s]?|N[\s·.\-]?m)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 80);
    const ctx = text.slice(start, m.index).replace(/\n/g, ' ').trim();
    specs.push({
      value: m[1],
      unit: m[2].replace(/[\s·.\-]/g, ' ').trim(),
      context: ctx.split('.').pop()?.trim() || '',
    });
  }
  return specs;
}

async function fetchPage(url: string, timeout = 6000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "RatchetApp/1.0 (Vehicle Repair Assistant)" },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const text = await resp.text();
    if (text.includes('Page Not Found') && text.length < 600) return null;
    return text;
  } catch {
    return null;
  }
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

    const supabaseUrlEnv = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Allow service role key to bypass user auth (internal calls from other edge functions)
    const token = authHeader.replace("Bearer ", "");
    const isServiceCall = token === serviceKey;

    if (!isServiceCall) {
      const anonClient = createClient(supabaseUrlEnv, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    const { jobKeyword, vehicleYear, vehicleMake, vehicleModel, vehicleEngine, vehicleDrivetrain } = await req.json();

    if (!jobKeyword) {
      return new Response(JSON.stringify({ error: "jobKeyword required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const year = vehicleYear;
    if (year && (year < 1960 || year > 2025)) {
      return new Response(JSON.stringify({ found: false, reason: "Vehicle year outside manual coverage (1960-2025)" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const basePath = matchKeyword(jobKeyword);
    if (!basePath) {
      return new Response(JSON.stringify({ found: false, reason: "No matching procedure for this job keyword" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Build dynamic URL from vehicle params, or fall back to keyword-only path
    let manualBase: string;
    if (vehicleMake && year && vehicleModel) {
      const manualModel = formatEngineForManual(vehicleEngine || null, vehicleModel, vehicleDrivetrain || null);
      const encodedModel = encodeURIComponent(manualModel);
      manualBase = `${LEMON_BASE}/${titleCaseMake(vehicleMake)}/${year}/${encodedModel}/Repair%20and%20Diagnosis/${basePath}`;
    } else {
      // Legacy fallback — no vehicle context
      manualBase = `${LEMON_BASE}/Repair%20and%20Diagnosis/${basePath}`;
    }

    const cacheKey = manualBase;
    const supabase = createClient(supabaseUrlEnv, serviceKey);

    // Check cache (30 day validity)
    const { data: cached } = await supabase
      .from("charm_cache")
      .select("*")
      .eq("charm_url", cacheKey)
      .single();

    if (cached) {
      const fetchedAt = new Date(cached.fetched_at);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      if (fetchedAt > cutoff && (cached.procedure_text?.length > 50 || (cached.all_images as any[])?.length > 0)) {
        console.log(`Cache hit for ${cacheKey}`);
        return new Response(JSON.stringify({
          found: true,
          images: cached.images || [],
          allImages: cached.all_images || [],
          procedureText: cached.procedure_text || '',
          torqueSpecs: cached.torque_specs || [],
          sourceUrl: `${manualBase}/`,
          pagesCrawled: cached.sub_pages_crawled || [],
          cached: true,
        }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
    }

    // Crawl sub-pages in parallel
    const allUrls: { url: string; subPage: string }[] = [];
    for (const sp of SUB_PAGE_PATHS) {
      const suffix = sp ? `/${sp}` : '';
      allUrls.push({ url: `${manualBase}${suffix}/`, subPage: sp || 'Overview' });
    }

    console.log(`Crawling ${allUrls.length} URLs for: ${manualBase}`);

    const results = await Promise.all(allUrls.map(({ url }) => fetchPage(url)));

    let allText = '';
    let allImages: Array<{ url: string; context: string; page: string }> = [];
    let allTorqueSpecs: Array<{ value: string; unit: string; context: string }> = [];
    const crawledPages: string[] = [];

    results.forEach((html, idx) => {
      if (!html) return;
      const { subPage } = allUrls[idx];
      const pageName = (subPage || 'Overview').replace(/%20/g, ' ').replace(/%2C/g, ',').replace(/%2F/g, '/');

      if (!crawledPages.includes(pageName)) crawledPages.push(pageName);

      const pageText = extractText(html);
      if (pageText.length > 10) allText += `\n\n--- ${pageName} ---\n${pageText}`;

      const pageImages = extractImages(html);
      pageImages.forEach(img => { img.page = pageName; });
      allImages.push(...pageImages);

      allTorqueSpecs.push(...extractTorqueSpecs(pageText));

      console.log(`  ${pageName}: ${pageText.length > 0 ? '✓ text' : '✗ text'}, ${pageImages.length} imgs`);
    });

    if (crawledPages.length === 0) {
      return new Response(JSON.stringify({ found: false, reason: "No pages found at manual URL" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Dedupe images
    const seenUrls = new Set<string>();
    allImages = allImages.filter(img => {
      if (seenUrls.has(img.url)) return false;
      seenUrls.add(img.url);
      return true;
    });

    // Dedupe torque specs
    const seenSpecs = new Set<string>();
    allTorqueSpecs = allTorqueSpecs.filter(spec => {
      const key = `${spec.value}${spec.unit}`;
      if (seenSpecs.has(key)) return false;
      seenSpecs.add(key);
      return true;
    });

    // Dedupe text
    const textLines = allText.split('\n');
    const seenLines = new Set<string>();
    const dedupedLines: string[] = [];
    for (const line of textLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('---') || !seenLines.has(trimmed)) {
        seenLines.add(trimmed);
        dedupedLines.push(line);
      }
    }
    allText = dedupedLines.join('\n').trim();

    const imageUrls = allImages.map(i => i.url);

    console.log(`Total: ${crawledPages.length} pages, ${allImages.length} images, ${allTorqueSpecs.length} torque specs`);

    // Upsert cache
    const cacheData = {
      charm_url: cacheKey,
      base_url: manualBase,
      images: imageUrls,
      all_images: allImages,
      procedure_text: allText,
      torque_specs: allTorqueSpecs,
      sub_pages_crawled: crawledPages,
      fetched_at: new Date().toISOString(),
    };

    if (cached) {
      await supabase.from("charm_cache").update(cacheData).eq("id", cached.id);
    } else {
      await supabase.from("charm_cache").insert(cacheData);
    }

    return new Response(JSON.stringify({
      found: true,
      images: imageUrls,
      allImages,
      procedureText: allText,
      torqueSpecs: allTorqueSpecs,
      sourceUrl: `${manualBase}/`,
      pagesCrawled: crawledPages,
      cached: false,
    }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  } catch (e) {
    console.error("fetch-manual-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
