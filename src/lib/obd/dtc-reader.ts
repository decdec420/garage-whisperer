/**
 * OBD-II DTC (Diagnostic Trouble Code) Reader
 *
 * Mode 03: Read stored DTCs
 * Mode 07: Read pending DTCs
 * Mode 04: Clear DTCs and freeze frame
 */

import { BLEManager } from './ble-manager';
import { queryPID } from './elm327';

export interface DTCCode {
  code: string;
  type: 'stored' | 'pending';
}

const DTC_PREFIXES: Record<string, string> = {
  '0': 'P0', '1': 'P1', '2': 'P2', '3': 'P3',
  '4': 'C0', '5': 'C1', '6': 'C2', '7': 'C3',
  '8': 'B0', '9': 'B1', 'A': 'B2', 'B': 'B3',
  'C': 'U0', 'D': 'U1', 'E': 'U2', 'F': 'U3',
};

/** Parse raw DTC hex bytes into human-readable codes (e.g., P0301) */
function parseDTCBytes(hex: string): string[] {
  const codes: string[] = [];
  // Each DTC is 2 bytes (4 hex chars)
  const clean = hex.replace(/\s/g, '');

  for (let i = 0; i < clean.length - 3; i += 4) {
    const chunk = clean.slice(i, i + 4);
    if (chunk === '0000') continue; // Empty slot

    const firstNibble = chunk[0].toUpperCase();
    const prefix = DTC_PREFIXES[firstNibble];
    if (!prefix) continue;

    const code = prefix + chunk.slice(1, 4).toUpperCase();
    codes.push(code);
  }

  return codes;
}

/** Read stored DTCs (Mode 03) */
export async function readStoredDTCs(ble: BLEManager): Promise<DTCCode[]> {
  const lines = await queryPID(ble, '03');
  const responseLine = lines
    .filter(l => !l.startsWith('43 00 00') || lines.length === 1)
    .join('');

  // Strip mode response header "43"
  const clean = responseLine.replace(/\s/g, '');
  const dataStart = clean.indexOf('43');
  if (dataStart === -1) return [];

  const data = clean.slice(dataStart + 2);
  return parseDTCBytes(data).map(code => ({ code, type: 'stored' as const }));
}

/** Read pending DTCs (Mode 07) */
export async function readPendingDTCs(ble: BLEManager): Promise<DTCCode[]> {
  const lines = await queryPID(ble, '07');
  const responseLine = lines.join('');

  const clean = responseLine.replace(/\s/g, '');
  const dataStart = clean.indexOf('47');
  if (dataStart === -1) return [];

  const data = clean.slice(dataStart + 2);
  return parseDTCBytes(data).map(code => ({ code, type: 'pending' as const }));
}

/** Clear all DTCs and freeze frame data (Mode 04) */
export async function clearDTCs(ble: BLEManager): Promise<boolean> {
  const response = await ble.sendCommand('04', 5000);
  // Successful clear returns "44"
  return response.replace(/\s/g, '').includes('44');
}

/** Read both stored and pending DTCs */
export async function readAllDTCs(ble: BLEManager): Promise<DTCCode[]> {
  const [stored, pending] = await Promise.all([
    readStoredDTCs(ble),
    readPendingDTCs(ble),
  ]);

  // Deduplicate — a code might appear in both
  const seen = new Set<string>();
  const all: DTCCode[] = [];
  for (const dtc of [...stored, ...pending]) {
    if (!seen.has(dtc.code)) {
      seen.add(dtc.code);
      all.push(dtc);
    }
  }
  return all;
}
