

# Overhaul: charm.li → lemon-manuals.la Migration

## Problem
The entire factory manual pipeline — image scraping, procedure text, torque specs — is hardcoded to charm.li with a **1982-2013 year gate**. Your 2008 Fusion battery project got zero photos because lemon-manuals.la is the replacement source covering **1960-2025**. Additionally, the model format differs: lemon-manuals includes drivetrain in the model string (e.g., `Fusion FWD L4-2.3L` vs `Fusion L4-2.3L`).

## Scope of Changes

### 1. Edge Function: `fetch-charm-data/index.ts` → rename to `fetch-manual-data-v2`
- Replace `charm.li` base URL with `lemon-manuals.la`
- Expand year range from `1982-2013` to `1960-2025`
- Update `extractImages()` to match `lemon-manuals.la/images/` src patterns
- Add drivetrain-aware model formatting: use vehicle's `drivetrain` field (FWD/AWD/2WD/4WD) when building the model string
- Add fallback logic: try with drivetrain first, fall back to without if 404
- Update cache upsert to store `lemon-manuals.la` URLs

### 2. Edge Function: `generate-project/index.ts`
- Update `fetchCharmData()` function: same domain swap, year range expansion, drivetrain-aware model formatting
- Update image extraction to recognize `lemon-manuals.la/images/` URLs
- Remove the `year < 1982 || year > 2013` hard gate (line 305)
- Update the `fetch-manual-data` call to also use lemon-manuals.la paths

### 3. Client: `src/lib/charm-url.ts`
- Swap all `charm.li` URLs to `lemon-manuals.la`
- Update `buildCharmUrls()` to include drivetrain in model string when available
- Expand year range check from `1982-2013` to `1960-2025`
- Update `formatEngineForCharm()` to prepend drivetrain (FWD/AWD/etc.)

### 4. UI Attribution Updates (4 files)
- `FactoryPhotoLightbox.tsx`: Change "Operation CHARM (charm.li)" → "LEMON Manuals (lemon-manuals.la)"
- `ProjectDetail.tsx`: Update attribution text and links
- `MechanicMode.tsx`: Update link text
- `BlueprintTab.tsx`: Update attribution and remove `year >= 1982 && year <= 2013` year gate on the "MANUAL" button

### 5. Tests: `src/test/charm-url.test.ts`
- Update URL expectations from `charm.li` to `lemon-manuals.la`

---

## Technical Details

### Drivetrain Model String Logic
lemon-manuals.la requires drivetrain in the model URL for many vehicles. The `vehicles` table already has a `drivetrain` column.

```text
Current:   Fusion L4-2.3L
Required:  Fusion FWD L4-2.3L

Current:   Ranger V6-4.0L  
Required:  Ranger 2WD V6-4.0L
```

Strategy: Build model string as `{Model} {drivetrain} {engine}`. If the page 404s, retry without drivetrain. Some vehicles (Mustang) don't use drivetrain in the URL.

### Image Extraction Update
Current regex matches `charm.li/images` — needs to match `lemon-manuals.la/images/`. The actual image format on lemon-manuals: `<img class="big-img" src="https://lemon-manuals.la/images/DM10Q313/ford150/109789606/">`.

### Files Changed
| File | Type |
|------|------|
| `supabase/functions/fetch-charm-data/index.ts` | Domain swap, year range, drivetrain, image regex |
| `supabase/functions/generate-project/index.ts` | Same + remove year gate |
| `supabase/functions/fetch-manual-data/index.ts` | Update Cloudflare mirror references |
| `src/lib/charm-url.ts` | Domain swap, year range, drivetrain |
| `src/components/vehicle/FactoryPhotoLightbox.tsx` | Attribution text |
| `src/pages/ProjectDetail.tsx` | Attribution text |
| `src/components/vehicle/MechanicMode.tsx` | Attribution text |
| `src/components/vehicle/BlueprintTab.tsx` | Attribution + year gate removal |
| `src/test/charm-url.test.ts` | URL expectations |

No database migrations needed — `charm_cache` table structure works as-is.

