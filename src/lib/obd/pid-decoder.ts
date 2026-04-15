/**
 * OBD-II PID Decoder
 *
 * Converts raw hex responses from Mode 01 PIDs into human-readable values.
 * Reference: https://en.wikipedia.org/wiki/OBD-II_PIDs#Mode_01
 */

export interface PIDReading {
  pid: string;
  name: string;
  value: number;
  unit: string;
  raw: string;
}

interface PIDDefinition {
  name: string;
  unit: string;
  bytes: number;
  decode: (a: number, b?: number) => number;
}

// Mode 01 PID definitions — the most commonly used ones
const PID_MAP: Record<string, PIDDefinition> = {
  '04': {
    name: 'Engine Load',
    unit: '%',
    bytes: 1,
    decode: (a) => (a / 255) * 100,
  },
  '05': {
    name: 'Coolant Temp',
    unit: '°F',
    bytes: 1,
    decode: (a) => (a - 40) * 9 / 5 + 32, // C to F
  },
  '0B': {
    name: 'Intake Pressure',
    unit: 'kPa',
    bytes: 1,
    decode: (a) => a,
  },
  '0C': {
    name: 'RPM',
    unit: 'rpm',
    bytes: 2,
    decode: (a, b = 0) => ((a * 256) + b) / 4,
  },
  '0D': {
    name: 'Speed',
    unit: 'mph',
    bytes: 1,
    decode: (a) => Math.round(a * 0.621371), // km/h to mph
  },
  '0F': {
    name: 'Intake Temp',
    unit: '°F',
    bytes: 1,
    decode: (a) => (a - 40) * 9 / 5 + 32,
  },
  '10': {
    name: 'MAF Rate',
    unit: 'g/s',
    bytes: 2,
    decode: (a, b = 0) => ((a * 256) + b) / 100,
  },
  '11': {
    name: 'Throttle',
    unit: '%',
    bytes: 1,
    decode: (a) => (a / 255) * 100,
  },
  '1F': {
    name: 'Run Time',
    unit: 'sec',
    bytes: 2,
    decode: (a, b = 0) => (a * 256) + b,
  },
  '2F': {
    name: 'Fuel Level',
    unit: '%',
    bytes: 1,
    decode: (a) => (a / 255) * 100,
  },
  '42': {
    name: 'Battery',
    unit: 'V',
    bytes: 2,
    decode: (a, b = 0) => ((a * 256) + b) / 1000,
  },
  '46': {
    name: 'Ambient Temp',
    unit: '°F',
    bytes: 1,
    decode: (a) => (a - 40) * 9 / 5 + 32,
  },
  '5C': {
    name: 'Oil Temp',
    unit: '°F',
    bytes: 1,
    decode: (a) => (a - 40) * 9 / 5 + 32,
  },
};

/** PIDs we'll try to read for the live dashboard, in priority order */
export const DASHBOARD_PIDS = ['0C', '05', '42', '04', '0D', '11', '2F', '5C'];

/** Decode a raw OBD response line into a PIDReading */
export function decodePIDResponse(responseLine: string): PIDReading | null {
  // Remove spaces: "41 0C 1A F8" → "410C1AF8"
  const hex = responseLine.replace(/\s/g, '');

  // Must start with "41" (Mode 01 response)
  if (!hex.startsWith('41') || hex.length < 6) return null;

  const pid = hex.slice(2, 4).toUpperCase();
  const def = PID_MAP[pid];
  if (!def) return null;

  const a = parseInt(hex.slice(4, 6), 16);
  const b = def.bytes > 1 && hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) : 0;

  if (isNaN(a)) return null;

  const value = Math.round(def.decode(a, b) * 10) / 10;

  return {
    pid,
    name: def.name,
    value,
    unit: def.unit,
    raw: responseLine,
  };
}

/** Get a friendly name for a PID code */
export function getPIDName(pid: string): string {
  return PID_MAP[pid.toUpperCase()]?.name || `PID ${pid}`;
}

/** Get the gauge range for a known PID (for CircularGauge normalization) */
export function getPIDGaugeRange(pid: string): { min: number; max: number } {
  const ranges: Record<string, { min: number; max: number }> = {
    '0C': { min: 0, max: 8000 },     // RPM
    '05': { min: 100, max: 260 },     // Coolant temp °F
    '42': { min: 10, max: 16 },       // Battery V
    '04': { min: 0, max: 100 },       // Engine load %
    '0D': { min: 0, max: 160 },       // Speed mph
    '11': { min: 0, max: 100 },       // Throttle %
    '2F': { min: 0, max: 100 },       // Fuel level %
    '5C': { min: 100, max: 300 },     // Oil temp °F
  };
  return ranges[pid.toUpperCase()] || { min: 0, max: 100 };
}
