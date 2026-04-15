/**
 * ELM327 Protocol Layer
 *
 * Handles initialization, command sequencing, and response parsing
 * for ELM327-compatible OBD-II adapters.
 */

import { BLEManager } from './ble-manager';

/** Initialize the ELM327 adapter with standard setup commands */
export async function initializeELM327(ble: BLEManager): Promise<string> {
  // Reset adapter
  await ble.sendCommand('ATZ', 3000);
  // Turn off echo
  await ble.sendCommand('ATE0');
  // Turn off line feeds
  await ble.sendCommand('ATL0');
  // Turn off spaces in responses (compact hex)
  await ble.sendCommand('ATS0');
  // Auto-detect protocol
  await ble.sendCommand('ATSP0');
  // Set timeout to max (adaptive)
  await ble.sendCommand('ATAT2');
  // Turn on headers (we'll parse them out)
  await ble.sendCommand('ATH0');

  // Get adapter ID
  const id = await ble.sendCommand('ATI');
  return id;
}

/**
 * Send an OBD-II Mode 01 PID request and return raw hex response lines.
 * Example: queryPID(ble, '010C') → ['41 0C 1A F8']
 */
export async function queryPID(ble: BLEManager, pid: string): Promise<string[]> {
  const raw = await ble.sendCommand(pid, 3000);
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('SEARCHING') && !l.startsWith('UNABLE') && !l.startsWith('NO DATA'));
}

/**
 * Request supported PIDs (Mode 01 PID 00).
 * Returns a Set of supported PID hex codes like '0C', '05', '42', etc.
 */
export async function getSupportedPIDs(ble: BLEManager): Promise<Set<string>> {
  const supported = new Set<string>();

  // PID 00 returns a bitmask of PIDs 01-20
  const pidRanges = ['0100', '0120', '0140', '0160'];

  for (const cmd of pidRanges) {
    try {
      const lines = await queryPID(ble, cmd);
      const responseLine = lines.find(l => l.replace(/\s/g, '').startsWith('41'));
      if (!responseLine) break;

      const hex = responseLine.replace(/\s/g, '');
      // Response: 41 00 XX XX XX XX — 4 bytes = 32 PIDs
      const dataStart = 4; // skip '41' + PID byte pair
      const baseOffset = parseInt(cmd.slice(2), 16);

      for (let byteIdx = 0; byteIdx < 4; byteIdx++) {
        const byteHex = hex.slice(dataStart + 2 + byteIdx * 2, dataStart + 4 + byteIdx * 2);
        const byte = parseInt(byteHex, 16);
        if (isNaN(byte)) continue;
        for (let bit = 7; bit >= 0; bit--) {
          if (byte & (1 << bit)) {
            const pidNum = baseOffset + byteIdx * 8 + (7 - bit) + 1;
            supported.add(pidNum.toString(16).toUpperCase().padStart(2, '0'));
          }
        }
      }

      // If PID 20/40/60 is not supported, stop querying next range
      const nextRangePid = (baseOffset + 0x20).toString(16).toUpperCase().padStart(2, '0');
      if (!supported.has(nextRangePid)) break;
    } catch {
      break;
    }
  }

  return supported;
}
