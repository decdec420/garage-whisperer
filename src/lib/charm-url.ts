// Utility to build charm.li URLs from vehicle + job keyword
// All paths include "Repair%20and%20Diagnosis/" prefix as required by charm.li

const R = "Repair%20and%20Diagnosis/"; // prefix shorthand

// Each entry can map to a single path or array of paths (for front/rear variants)
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

/** Standard engine displacements to round to */
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

/** Title-case a make: "HONDA" → "Honda", "BMW" stays "BMW" (3 chars or less) */
export function titleCaseMake(make: string): string {
  if (make.length <= 3) return make.toUpperCase(); // BMW, GMC
  return make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
}

/**
 * Parse engine string like "2.4L I4" or "2.359737216L 4cyl" into charm.li format "L4-2.4L"
 */
function formatEngineForCharm(engine: string | null, model: string): string {
  if (!engine) return model;
  
  const displacementMatch = engine.match(/(\d+\.?\d*)\s*L/i);
  const rawDisplacement = displacementMatch ? parseFloat(displacementMatch[1]) : null;
  const displacement = rawDisplacement ? roundDisplacement(rawDisplacement) : null;
  
  let cylConfig = '';
  if (/V\s*6/i.test(engine) || /V6/i.test(engine)) cylConfig = 'V6';
  else if (/V\s*8/i.test(engine) || /V8/i.test(engine)) cylConfig = 'V8';
  else if (/I\s*4/i.test(engine) || /L4/i.test(engine) || /4[\s-]?cyl/i.test(engine) || /inline[\s-]?4/i.test(engine)) cylConfig = 'L4';
  else if (/I\s*6/i.test(engine) || /L6/i.test(engine) || /inline[\s-]?6/i.test(engine)) cylConfig = 'L6';
  else if (/V\s*4/i.test(engine)) cylConfig = 'V4';
  else if (/4[\s-]?cylinder/i.test(engine)) cylConfig = 'L4';
  
  if (displacement && cylConfig) {
    return `${model} ${cylConfig}-${displacement}L`;
  }
  if (displacement) {
    return `${model} ${displacement}L`;
  }
  return model;
}

/**
 * Fuzzy-match a job description to charm.li keyword path(s).
 * Returns the most specific (longest keyword) match.
 * Can return a single path string or array of paths.
 */
export function matchJobKeyword(jobDescription: string): string | string[] | null {
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

/**
 * Build charm.li URL(s) for a vehicle + job.
 * Returns array of URLs (may be multiple for front/rear procedures).
 */
export function buildCharmUrls(
  vehicle: { make: string; year: number; model: string; engine?: string | null },
  jobDescription: string
): string[] {
  if (vehicle.year < 1982 || vehicle.year > 2013) return [];
  
  const pathResult = matchJobKeyword(jobDescription);
  if (!pathResult) return [];
  
  const charmMake = titleCaseMake(vehicle.make);
  const charmModel = formatEngineForCharm(vehicle.engine || null, vehicle.model);
  const encodedModel = encodeURIComponent(charmModel);
  
  const paths = Array.isArray(pathResult) ? pathResult : [pathResult];
  return paths.map(path => `https://charm.li/${charmMake}/${vehicle.year}/${encodedModel}/${path}/`);
}

/** @deprecated Use buildCharmUrls instead */
export function buildCharmUrl(
  vehicle: { make: string; year: number; model: string; engine?: string | null },
  jobDescription: string
): string | null {
  const urls = buildCharmUrls(vehicle, jobDescription);
  return urls.length > 0 ? urls[0] : null;
}

/**
 * Map a component name from the Blueprint to a charm.li job keyword
 */
export function componentToJobKeyword(componentName: string): string {
  const lower = componentName.toLowerCase();
  
  if (lower.includes('vtc actuator')) return 'vtc actuator';
  if (lower.includes('vtec solenoid')) return 'vtec solenoid';
  if (lower.includes('timing chain')) return 'timing chain';
  if (lower.includes('valve cover')) return 'valve cover gasket';
  if (lower.includes('water pump')) return 'water pump';
  if (lower.includes('thermostat')) return 'thermostat';
  if (lower.includes('alternator')) return 'alternator';
  if (lower.includes('starter')) return 'starter';
  if (lower.includes('ac compressor')) return 'ac compressor';
  if (lower.includes('throttle body')) return 'throttle body';
  if (lower.includes('fuel injector')) return 'fuel injector';
  if (lower.includes('oxygen sensor')) return 'oxygen sensor';
  if (lower.includes('catalytic converter')) return 'catalytic converter';
  if (lower.includes('brake pad')) return 'brake pads';
  if (lower.includes('brake rotor')) return 'brake rotors';
  if (lower.includes('brake caliper')) return 'brake caliper';
  if (lower.includes('strut')) return 'strut';
  if (lower.includes('control arm')) return 'control arm';
  if (lower.includes('stabilizer') || lower.includes('sway bar')) return 'sway bar';
  if (lower.includes('wheel bearing')) return 'wheel bearing';
  if (lower.includes('cv axle')) return 'cv axle';
  if (lower.includes('motor mount') || lower.includes('engine mount')) return 'engine mount';
  if (lower.includes('fuel pump')) return 'fuel pump';
  if (lower.includes('power steering')) return 'power steering';
  if (lower.includes('oil pan')) return 'oil pan';
  if (lower.includes('battery')) return 'battery';
  if (lower.includes('spark plug')) return 'spark plugs';
  if (lower.includes('serpentine') || lower.includes('drive belt')) return 'serpentine belt';
  if (lower.includes('radiator hose')) return 'radiator hose';
  if (lower.includes('radiator')) return 'radiator';
  if (lower.includes('head gasket')) return 'head gasket';
  if (lower.includes('oil pump')) return 'oil pump';
  if (lower.includes('ignition coil')) return 'ignition coil';
  if (lower.includes('crankshaft sensor')) return 'crankshaft sensor';
  if (lower.includes('camshaft sensor')) return 'camshaft sensor';
  if (lower.includes('mass air flow') || lower.includes('maf')) return 'mass air flow';
  if (lower.includes('tie rod')) return 'tie rod';
  if (lower.includes('ball joint')) return 'ball joint';
  if (lower.includes('abs sensor')) return 'abs sensor';
  if (lower.includes('brake master')) return 'brake master cylinder';
  if (lower.includes('transmission fluid')) return 'transmission fluid';
  
  return componentName.toLowerCase();
}
