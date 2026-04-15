

# Ratchet + OBD Scanner: Full Integration & iPhone Reality

## The iPhone Question — Honest Answer

When you plug in the GOOLOO DS200 and it opens the DeepScan companion app, that's because **iOS routes BLE device connections through the app that registered the Bluetooth accessory**. Here's the deal:

- **Web Bluetooth does NOT work on Safari/iOS.** Apple has refused to implement it. Period.
- **The DS200's companion app "owns" the BLE pairing on your iPhone** — iOS associates the device with whatever app first paired it.
- **To use the DS200 with Ratchet on iPhone**, Ratchet needs to be a **Capacitor native app** using CoreBluetooth directly (bypassing Safari entirely).

```text
Current State:
  iPhone → plug in DS200 → iOS opens DeepScan app (BLE accessory association)
  Chrome Desktop/Android → Web Bluetooth → Ratchet Scanner tab ✓

Future State (with Capacitor):
  iPhone → Ratchet native app → CoreBluetooth → DS200 pairs with Ratchet directly
  (DeepScan app no longer intercepts because Ratchet registers as the BLE handler)
```

**For now**: Scanner tab works on Chrome Desktop and Chrome Android. iPhone requires the Capacitor native app build (a separate milestone).

## What's Missing: Ratchet Chat Doesn't Know About Scans

The **diagnosis engine** (`generate-diagnosis`) already fetches recent `obd_scan_sessions` — that's wired. But the **general Ratchet chat** (`RatchetPanel.tsx` → `chat` edge function) has zero awareness of OBD data. So if you scan your car and then open Ratchet to ask "what's wrong with my car?", Ratchet has no idea you just scanned.

## The Plan: Wire OBD Data Into Ratchet Chat

### 1. Inject latest OBD scan into Ratchet's chat context
In `RatchetPanel.tsx`, when building `vehicleContext`, fetch the most recent `obd_scan_sessions` for the active vehicle and append it:

```
## Recent OBD-II Scan (2 hours ago, via GOOLOO DS200)
DTCs: P0301 (active), P0420 (pending)  
Live readings: RPM 750, Coolant 195°F, Battery 13.8V, Engine Load 22%
```

This gives Ratchet real hardware data to reason with — no more "have you pulled any codes?"

### 2. Add OBD context to the chat edge function system prompt
In `supabase/functions/chat/index.ts`, when OBD scan data is present in the vehicle context, add instructions telling Ratchet to:
- Reference specific scanned values instead of asking generic questions
- Correlate DTCs with live PID readings (e.g., "P0301 misfire + low RPM suggests...")
- Flag anomalous readings proactively

### 3. "Ask Ratchet about this scan" button on Scanner tab
After completing a scan (Read Codes or Live Data session), show a button that opens the Ratchet panel with a prefilled message like:
> "I just scanned my car. Found P0301 and P0420. RPM was 750, coolant 195°F, battery 13.8V. What's going on?"

This uses the existing `openRatchetPanel(prefilledMessage)` flow — no new infrastructure needed.

### 4. Scan history entries link to Ratchet
Each scan history row gets an "Ask Ratchet" action that opens the panel with that specific scan's data pre-filled.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/RatchetPanel.tsx` | Fetch latest `obd_scan_sessions` for active vehicle, append to `vehicleContext` string |
| `src/components/vehicle/ScannerTab.tsx` | Add "Ask Ratchet" button post-scan + on each history entry |
| `supabase/functions/chat/index.ts` | Add OBD-aware instructions to system prompt when scan data is present |

## Technical Details

- **No new tables or migrations** — uses existing `obd_scan_sessions`
- **No new dependencies** — just React Query fetch + string interpolation
- **Chat edge function change**: parse the OBD block from `vehicleContext` and add a small system prompt section instructing Ratchet to leverage hardware-verified data over user guesses
- The RatchetPanel fetch is a simple `useQuery` with `staleTime: 5 * 60 * 1000` (5 min cache) so it doesn't re-fetch on every panel open

