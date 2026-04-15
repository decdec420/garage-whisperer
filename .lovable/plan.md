

# Speed Overhaul: Diagnosis & Project Generation

## The Problems

**Three root causes making everything slow:**

1. **`generate-diagnosis` still uses charm.li** — The lemon-manuals migration only updated `generate-project` and `fetch-charm-data`. The diagnosis function still hits charm.li with the old 1982-2013 year gate, so your 2008 Fusion gets nothing useful.

2. **`fetch-manual-data` is hardcoded to Honda Accord 2012** — Line 8: `MANUAL_BASE = "https://lemon-manuals.la/Honda/2012/Accord L4-2.4L/..."`. Every vehicle gets Honda Accord manual data. It also crawls 22 URLs (11 sub-pages × 2 sources) sequentially for a Honda that isn't your car.

3. **Everything runs sequentially** — Auth → vehicle fetch → rate limit → pattern cache → history → charm data → manual data → AI call → insert project → insert parts → insert tools → insert steps → re-read everything back. Each step waits for the previous one. The AI call alone is 15-30s, and the manual fetching adds another 10-20s on top.

4. **"Failed to fetch" on create repair project** — The edge function likely times out (150s Supabase limit) because of all the sequential work.

## The Fix

### 1. Fix `fetch-manual-data` — make it vehicle-aware
- Accept `vehicleMake`, `vehicleModel`, `vehicleEngine`, `vehicleDrivetrain` params
- Build the URL dynamically: `lemon-manuals.la/{Make}/{Year}/{Model Engine}/...`
- Remove the hardcoded Honda Accord path

### 2. Fix `generate-diagnosis` — migrate to lemon-manuals.la
- Copy the updated `fetchCharmData` from `generate-project` (lemon-manuals.la domain, 1960-2025 year range, drivetrain-aware model formatting)
- Pass vehicle data to `fetch-manual-data` so it fetches the correct car's manual

### 3. Parallelize everything in both edge functions
- Run these concurrently with `Promise.all`:
  - Pattern cache lookup
  - Vehicle history fetch
  - Charm/lemon data fetch
  - Manual data fetch
- After AI response, run all DB inserts (parts, tools, steps) in parallel with `Promise.all`
- Skip the "re-read everything back" queries — return the data we already have from the inserts

### 4. Add timeout protection
- Add `AbortController` with 25s timeout on external fetches (lemon-manuals, manual data)
- If manual fetch times out, proceed without it — AI can still generate a solid plan

### 5. Update callers in both functions
- `generate-project` and `generate-diagnosis` both call `fetch-manual-data` — update both to pass vehicle-specific params

## Expected Impact

| Before | After |
|--------|-------|
| ~60-90s diagnosis generation | ~20-35s (AI call is the bottleneck) |
| ~60s+ project generation (often timeout) | ~20-35s |
| Honda data for all cars | Correct vehicle manual data |
| charm.li (dead) for diagnosis | lemon-manuals.la for all |

## Files Changed

| File | Changes |
|------|---------|
| `supabase/functions/fetch-manual-data/index.ts` | Accept vehicle params, build dynamic URL |
| `supabase/functions/generate-diagnosis/index.ts` | Lemon-manuals migration + parallelize all fetches + parallel DB inserts |
| `supabase/functions/generate-project/index.ts` | Parallelize fetches + parallel DB inserts + pass vehicle to fetch-manual-data |

