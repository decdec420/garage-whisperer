// Utility to build charm.li URLs from vehicle + job keyword

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

/**
 * Parse engine string like "2.4L I4" into charm.li format "L4-2.4L"
 */
function formatEngineForCharm(engine: string | null, model: string): string {
  if (!engine) return model;
  
  const displacementMatch = engine.match(/(\d+\.\d+)\s*L/i);
  const displacement = displacementMatch ? displacementMatch[1] : null;
  
  // Detect cylinder config
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
 * Fuzzy-match a job description to a charm.li keyword path.
 * Returns the most specific (longest keyword) match.
 */
export function matchJobKeyword(jobDescription: string): string | null {
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

/**
 * Build a charm.li URL for a vehicle + job.
 */
export function buildCharmUrl(
  vehicle: { make: string; year: number; model: string; engine?: string | null },
  jobDescription: string
): string | null {
  // Year coverage check
  if (vehicle.year < 1982 || vehicle.year > 2013) return null;
  
  const path = matchJobKeyword(jobDescription);
  if (!path) return null;
  
  const charmModel = formatEngineForCharm(vehicle.engine || null, vehicle.model);
  const encodedModel = encodeURIComponent(charmModel);
  
  return `https://charm.li/${vehicle.make}/${vehicle.year}/${encodedModel}/${path}/`;
}

/**
 * Map a component name from the Blueprint to a charm.li job keyword
 */
export function componentToJobKeyword(componentName: string): string {
  const lower = componentName.toLowerCase();
  
  // Direct mappings from Blueprint component names
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
