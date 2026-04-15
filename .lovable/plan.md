

# OBD-II Live Scanner Integration — Full Scope Plan

## Reality Check: Platform Support

Here's the honest breakdown of what works where:

```text
Platform          Web Bluetooth    Capacitor BLE    Status
─────────────────────────────────────────────────────────
Chrome Desktop    ✓                n/a              Works now
Chrome Android    ✓                ✓                Works now
Safari Desktop    ✗                n/a              Never (Apple refuses)
Safari iOS        ✗                ✓ (CoreBluetooth) Capacitor only
Android App       n/a              ✓                Capacitor only
Firefox           ✗                n/a              Never
```

**Translation**: For full cross-platform support (especially iPhone), Ratchet needs to become a Capacitor native app. Web-only covers Chrome users. Safari desktop is a dead end for BLE — the only option there would be a companion macOS app or a WiFi-based OBD adapter (which uses HTTP, not BLE).

## Your GOOLOO DS200

The DS200 is a **Bluetooth Low Energy (BLE) dongle** that speaks the ELM327 AT command set. Good news — it's the standard protocol. The same code that talks to a $12 Amazon ELM327 clone talks to your DS200. No proprietary API needed.

## The Feature in Three Phases

### Phase 1: Connect & Scan (MVP)

**What the user sees:**
1. New "Scanner" tab on the vehicle detail page (or a global scanner icon in the nav)
2. Tap "Connect Scanner" → system BLE pairing dialog appears
3. Once paired, live gauges appear: RPM, coolant temp, battery voltage, engine load
4. "Read Codes" button pulls all DTCs → auto-populates `dtc_records` table
5. "Clear Codes" button sends the reset command
6. All scanned DTCs get a "Start Diagnosis" shortcut that pre-fills the diagnosis wizard

**Technical work:**
- **BLE Connection Manager** (`src/lib/obd/ble-manager.ts`): Web Bluetooth API wrapper with reconnection logic, service/characteristic UUIDs for ELM327 BLE
- **ELM327 Protocol Layer** (`src/lib/obd/elm327.ts`): AT command queue, response parser, initialization sequence (`ATZ`, `ATE0`, `ATL0`, `ATSP0`)
- **PID Decoder** (`src/lib/obd/pid-decoder.ts`): Converts hex responses to human values (Mode 01 PIDs: RPM, speed, coolant, voltage, MAF, intake temp, etc.)
- **DTC Reader** (`src/lib/obd/dtc-reader.ts`): Mode 03 (read codes), Mode 04 (clear codes), Mode 07 (pending codes)
- **Scanner UI** (`src/components/vehicle/ScannerTab.tsx`): Live gauges reusing `CircularGauge`, DTC list, connect/disconnect controls
- **Supabase**: New `obd_scan_sessions` table to log each scan with timestamp, vehicle_id, PIDs captured, DTCs found

### Phase 2: Always-On Passive Monitoring

**What the user sees:**
1. Toggle "Background Monitoring" — scanner stays connected while driving
2. App samples key PIDs every 5-10 seconds (configurable)
3. Dashboard widget shows trip summary: avg RPM, max coolant temp, fuel efficiency trends
4. Anomaly alerts: "Coolant temp spiked to 230°F at 2:15 PM" or "Battery voltage dropping below 12.8V consistently"

**Technical work:**
- **Background BLE Service** (Capacitor only — browsers kill BLE connections when backgrounded): Uses `@capacitor-community/bluetooth-le` with background execution
- **Telemetry Buffer** (`src/lib/obd/telemetry-buffer.ts`): Ring buffer that batches PID readings and flushes to Supabase every 30 seconds
- **New tables**: `obd_telemetry` (time-series PID data), `obd_anomalies` (flagged readings)
- **Edge Function** (`supabase/functions/analyze-telemetry/index.ts`): Runs pattern detection on telemetry batches — rolling averages, threshold alerts, trend analysis
- **Trip Detection**: Uses speed PID to auto-start/stop trip recording

### Phase 3: Predictive Intelligence

**What the user sees:**
1. Ratchet proactively says: "Your battery voltage has been trending down 0.1V/week for the past month. Based on this pattern, you'll likely need a new battery within 6-8 weeks."
2. Oil life estimation based on engine hours, RPM patterns, and short-trip detection
3. "Your catalytic converter efficiency has dropped 12% in 3 months — might want to check that before it throws a P0420"
4. All predictions feed into the existing Needs Attention dashboard

**Technical work:**
- **ML-lite analysis** in the telemetry edge function: Linear regression on voltage trends, efficiency ratios (catalyst, O2 sensors), temperature baselines
- **Integration with Ratchet chat**: Diagnosis context automatically includes recent telemetry anomalies
- **Notification triggers**: New anomaly → in-app notification → "Ask Ratchet about this"

## Cross-Platform Strategy

| Approach | Covers | Effort |
|----------|--------|--------|
| Web Bluetooth only | Chrome desktop + Android browser | Low — Phase 1 only |
| + Capacitor BLE plugin | + iOS + Android native app | Medium — requires app store deployment |
| + WiFi OBD support | + Safari desktop (WiFi adapters use HTTP) | Medium — separate adapter protocol |

**Recommendation**: Build Phase 1 with Web Bluetooth first (works today, no app store). Then wrap in Capacitor for iOS/Android native when you're ready for app store distribution. WiFi adapter support can be a later add-on.

## Cost to Users

- **Hardware**: They already own a scanner (or buy a $15-25 ELM327 BLE adapter)
- **App cost**: This is a premium feature — perfect candidate for the paid tier in the monetization funnel
- **Data storage**: Telemetry generates volume — metered storage could be a paid differentiator

## Database Changes

New tables needed:
- `obd_scan_sessions` — scan event log (vehicle_id, user_id, timestamp, dtcs_found, pids_captured)
- `obd_telemetry` — time-series PID readings (session_id, pid_code, value, unit, recorded_at)
- `obd_anomalies` — flagged patterns (vehicle_id, anomaly_type, severity, description, telemetry_refs)

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/lib/obd/ble-manager.ts` | BLE connection lifecycle |
| `src/lib/obd/elm327.ts` | AT command protocol |
| `src/lib/obd/pid-decoder.ts` | Hex → human value conversion |
| `src/lib/obd/dtc-reader.ts` | Read/clear diagnostic codes |
| `src/lib/obd/telemetry-buffer.ts` | Batch PID readings for upload |
| `src/components/vehicle/ScannerTab.tsx` | Scanner UI with live gauges |
| `src/components/vehicle/ScannerConnect.tsx` | Pairing flow UI |
| `supabase/functions/analyze-telemetry/index.ts` | Pattern detection edge function |
| `src/pages/VehicleDetail.tsx` | Add Scanner tab |
| Migration | New obd_* tables |

## Recommendation

Start with **Phase 1 only** — connect, read live data, pull/clear DTCs. It's self-contained, impressive, and validates the BLE stack before committing to background monitoring complexity. Phase 2 and 3 require Capacitor for real-world use (background BLE), so they naturally pair with the native app rollout.

