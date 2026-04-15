

# Next Step: Scanner → Ratchet Auto-Diagnosis Bridge

## What's Already Built
- Scanner tab: BLE connect, live PID gauges, DTC read/clear, session logging
- Each scanned DTC has a "Diagnose" button that navigates to `?tab=diagnose`
- Diagnose tab has a 3-step symptom wizard (Symptoms → Context → Evidence)

## What's Missing
The "Diagnose" button on a scanned DTC just switches tabs — it doesn't pass the code. Ratchet has no idea what you just scanned. The bridge is broken.

## The Plan: Wire Scanned DTCs Into the Diagnosis Flow

### 1. Pass DTC context via URL params
When the user taps "Diagnose" on a scanned DTC (e.g., P0301), navigate with the code in the URL:
```
/garage/{vehicleId}?tab=diagnose&dtc=P0301
```

**File**: `src/components/vehicle/ScannerTab.tsx` — update the navigate call to include `&dtc={code}`

### 2. Auto-fill the diagnosis wizard from scanned DTCs
The Diagnose tab reads the `dtc` query param and:
- Pre-selects the matching symptom category chip (e.g., P03xx → "Misfires / shaking")
- Pre-fills the free-text field with `"DTC P0301 — Cylinder 1 Misfire Detected (scanned via OBD-II)"`
- Skips straight to Step 2 (Context) since the symptom is already known
- Adds a badge: "🔧 Scanned via OBD-II" so Ratchet knows this came from hardware, not a guess

**File**: `src/components/vehicle/DiagnoseTab.tsx` — read `dtc` param, map DTC prefix to symptom category, auto-advance

### 3. Include recent scan data in Ratchet's diagnosis context
When generating a diagnosis for a scanned DTC, the edge function should pull the latest `obd_scan_sessions` data for that vehicle — giving Ratchet access to the live PID readings captured at scan time (coolant temp, RPM, voltage, etc.).

**File**: `supabase/functions/generate-diagnosis/index.ts` — query `obd_scan_sessions` for the vehicle and include recent PID snapshots in the AI prompt context

### 4. Add scan history to Scanner tab
Show a compact list of previous scan sessions below the live controls — date, codes found, "View Results" link. This gives the tab persistence beyond the live connection.

**Files**:
- `src/components/vehicle/ScannerTab.tsx` — add a React Query fetch for `obd_scan_sessions` filtered by vehicle_id, render as a timeline

## What the User Experiences
1. Scan car → see P0301
2. Tap "Diagnose" → lands on Diagnose tab with "Cylinder 1 Misfire" pre-filled
3. Ratchet already knows the live sensor readings from the scan (coolant was 210°F, RPM was 750, voltage 13.8V)
4. Diagnosis is faster and more accurate because it's working with real data, not guesses

## Technical Scope
- ~4 files modified, no new dependencies
- No database changes needed (tables already exist)
- No new edge functions — just enriching the existing `generate-diagnosis` prompt

