import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MANUAL_BASE = "https://ratchet-accord-manual.pages.dev";

const PATH_MAP: Record<string, string> = {
  "starter": "Starting%20and%20Charging/Starter",
  "alternator": "Starting%20and%20Charging/Generator",
  "battery": "Starting%20and%20Charging/Battery",
  "catalytic converter": "Powertrain%20Management/Emission%20Control%20Systems/Catalytic%20Converter",
  "oxygen sensor": "Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor",
  "o2 sensor": "Powertrain%20Management/Computers%20and%20Control%20Systems/Oxygen%20Sensor",
  "vtec solenoid": "Powertrain%20Management/Computers%20and%20Control%20Systems/Variable%20Valve%20Timing%20Solenoid",
  "vtc actuator": "Engine%2C%20Cooling%20and%20Exhaust/Engine/Cylinder%20Head%20Assembly",
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
  "front brake pad": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Front%20Brake%20Pad%20Inspection%20And%20Replacement",
  "rear brake pad": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad/Service%20and%20Repair/Rear%20Brake%20Pad%20Inspection%20And%20Replacement",
  "brake pads": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad",
  "brake pad": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Brake%20Pad",
  "brake rotors": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Rotor",
  "brake rotor": "Brakes%20and%20Traction%20Control/Disc%20Brake%20System/Rotor",
  "brake caliper": "Brakes%20and%20Traction%20Control/Hydraulic%20System/Brake%20Caliper",
  "brake master cylinder": "Brakes%20and%20Traction%20Control/Hydraulic%20System/Master%20Cylinder",
  "abs sensor": "Brakes%20and%20Traction%20Control/Anti-Lock%20Brakes/Wheel%20Speed%20Sensor",
  "strut": "Steering%20and%20Suspension/Front%20Suspension/Strut",
  "ball joint": "Steering%20and%20Suspension/Front%20Suspension/Ball%20Joint",
  "control arm": "Steering%20and%20Suspension/Front%20Suspension/Control%20Arm",
  "wheel bearing": "Steering%20and%20Suspension/Front%20Suspension/Wheel%20Bearing",
  "sway bar": "Steering%20and%20Suspension/Front%20Suspension/Stabilizer%20Bar",
  "tie rod": "Steering%20and%20Suspension/Steering/Tie%20Rod",
  "power steering": "Steering%20and%20Suspension/Steering/Power%20Steering",
  "cv axle": "Transmission%20and%20Drivetrain/Drive%20Axles",
  "transmission fluid": "Transmission%20and%20Drivetrain/Automatic%20Transmission%2FTransaxle/Fluid",
  "ac compressor": "Heating%20and%20Air%20Conditioning/Compressor",
  "ac line": "Heating%20and%20Air%20Conditioning/Hose%2FLine%20HVAC",
  "cabin air filter": "Maintenance/Filters",
};

// Sub-pages to crawl for each component
const SUB_PAGES = [
  "index.html",
  "Service%20and%20Repair/index.html",
  "Service%20and%20Repair/Removal/index.html",
  "Service%20and%20Repair/Installation/index.html",
  "Service%20and%20Repair/Removal%20and%20Replacement/index.html",
  "Locations/index.html",
  "Description%20and%20Operation/index.html",
  "Testing%20and%20Inspection/index.html",
  "Specifications/index.html",
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
  // Match img tags, capturing surrounding text
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    const alt = match[2] || '';
    if (src.includes('charm.li/images') || (src.includes('/images/') && !src.includes('/icons/'))) {
      const url = src.startsWith('http') ? src : `https://charm.li${src.startsWith('/') ? '' : '/'}${src}`;
      // Get surrounding text for context
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
  const re = /(\d+(?:\.\d+)?)\s*(ft[\s·.-]?lb[s]?|N[\s·.-]?m)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 80);
    const ctx = text.slice(start, m.index).replace(/\n/g, ' ').trim();
    specs.push({
      value: m[1],
      unit: m[2].replace(/[\s·.-]/g, ' ').trim(),
      context: ctx.split('.').pop()?.trim() || '',
    });
  }
  return specs;
}

async function fetchPage(url: string, timeout = 5000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "RatchetApp/1.0 (Vehicle Repair Assistant)" },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { jobKeyword, vehicleYear } = await req.json();

    if (!jobKeyword) {
      return new Response(JSON.stringify({ error: "jobKeyword required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Year check — manual is for 2012 Honda Accord specifically
    if (vehicleYear && (vehicleYear < 1982 || vehicleYear > 2013)) {
      return new Response(JSON.stringify({ found: false, reason: "Vehicle year outside manual coverage (1982-2013)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const basePath = matchKeyword(jobKeyword);
    if (!basePath) {
      return new Response(JSON.stringify({ found: false, reason: "No matching procedure for this job keyword" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `manual:${basePath}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
      if (fetchedAt > cutoff && (cached.procedure_text?.length > 50 || cached.all_images?.length > 0)) {
        console.log(`Cache hit for ${cacheKey}`);
        return new Response(JSON.stringify({
          found: true,
          images: cached.images || [],
          allImages: cached.all_images || [],
          procedureText: cached.procedure_text || '',
          torqueSpecs: cached.torque_specs || [],
          sourceUrl: `${MANUAL_BASE}/${basePath}/`,
          pagesCrawled: cached.sub_pages_crawled || [],
          cached: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Crawl sub-pages in parallel
    const baseUrl = `${MANUAL_BASE}/${basePath}`;
    const subPageUrls = SUB_PAGES.map(sp => `${baseUrl}/${sp}`);

    console.log(`Crawling ${subPageUrls.length} sub-pages for: ${basePath}`);
    const results = await Promise.all(subPageUrls.map(url => fetchPage(url)));

    let allText = '';
    let allImages: Array<{ url: string; context: string; page: string }> = [];
    let allTorqueSpecs: Array<{ value: string; unit: string; context: string }> = [];
    const crawledPages: string[] = [];

    results.forEach((html, idx) => {
      if (!html) return;
      const pageName = SUB_PAGES[idx].replace('/index.html', '').replace('index.html', 'Overview')
        .replace(/%20/g, ' ').replace(/%2C/g, ',').replace(/%2F/g, '/');
      crawledPages.push(pageName);

      const pageText = extractText(html);
      if (pageText.length > 10) {
        allText += `\n\n--- ${pageName} ---\n${pageText}`;
      }

      const pageImages = extractImages(html);
      pageImages.forEach(img => { img.page = pageName; });
      allImages.push(...pageImages);

      const pageTorque = extractTorqueSpecs(pageText);
      allTorqueSpecs.push(...pageTorque);
    });

    if (crawledPages.length === 0) {
      return new Response(JSON.stringify({ found: false, reason: "No pages found at manual URL" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe images by URL
    const seenUrls = new Set<string>();
    allImages = allImages.filter(img => {
      if (seenUrls.has(img.url)) return false;
      seenUrls.add(img.url);
      return true;
    });

    const imageUrls = allImages.map(i => i.url);

    // Upsert cache
    const cacheData = {
      charm_url: cacheKey,
      base_url: baseUrl,
      images: imageUrls,
      all_images: allImages,
      procedure_text: allText.trim(),
      torque_specs: allTorqueSpecs,
      sub_pages_crawled: crawledPages,
      fetched_at: new Date().toISOString(),
    };

    if (cached) {
      await supabase.from("charm_cache").update(cacheData).eq("id", cached.id);
    } else {
      await supabase.from("charm_cache").insert(cacheData);
    }

    console.log(`Crawled ${crawledPages.length} pages, found ${allImages.length} images, ${allTorqueSpecs.length} torque specs`);

    return new Response(JSON.stringify({
      found: true,
      images: imageUrls,
      allImages,
      procedureText: allText.trim(),
      torqueSpecs: allTorqueSpecs,
      sourceUrl: `${MANUAL_BASE}/${basePath}/`,
      pagesCrawled: crawledPages,
      cached: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("fetch-manual-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
