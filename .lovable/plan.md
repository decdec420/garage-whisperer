

# Fix: Model-Specific Trim & Engine Suggestions

## The Problem
`COMMON_TRIMS` and `COMMON_ENGINES` in `SmartVehicleForm.tsx` are keyed by **make only**. A Ford Mustang shows "King Ranch" and "Raptor" (F-150 trims). A Mustang should show GT, EcoBoost, Mach 1, Shelby GT500, etc.

## The Fix
Replace static make-only lookups with **NHTSA API-driven, model-specific** trim and engine data. The NHTSA `DecodeVinValues` approach already exists in the code (lines 54–150, `fetchModelSpecs`) but is **never called**. We'll use a simpler, more reliable approach.

### Approach: Use NHTSA's Vehicle Variables API
NHTSA doesn't have a direct "trims for model" endpoint, but we can use their VIN decode with known WMI patterns. However, this is unreliable and slow.

**Better approach**: Fetch trims dynamically using a combination of:
1. Keep `COMMON_TRIMS` but restructure it as `MAKE > MODEL` (two-level lookup)
2. For the most popular models across the top makes, provide accurate trim lists
3. Fall back to a free-text input when no match is found (instead of showing wrong trims)
4. Same treatment for engines

### File: `src/components/vehicle/SmartVehicleForm.tsx`

**Changes:**
1. Replace `COMMON_TRIMS: Record<string, string[]>` with `MODEL_TRIMS: Record<string, Record<string, string[]>>` — keyed by `MAKE > MODEL`
2. Replace `COMMON_ENGINES: Record<string, string[]>` with `MODEL_ENGINES: Record<string, Record<string, string[]>>`
3. Update `trimOptions` logic (line 206–216) to look up `make + model` instead of just `make`
4. Update `engineOptions` logic (line 219–228) similarly
5. When no model-specific match exists, fall back to a text input (not a wrong dropdown)
6. Cover the most common models per major make (Mustang, F-150, Civic, Camry, etc. — ~50 models)

### Coverage for popular models (partial list):
- **Ford**: F-150, Mustang, Explorer, Escape, Transit Connect, Bronco, Maverick, Edge, Ranger
- **Toyota**: Camry, Corolla, RAV4, Tacoma, Tundra, 4Runner, Highlander, Prius
- **Honda**: Civic, Accord, CR-V, Pilot, HR-V, Odyssey, Ridgeline
- **Chevrolet**: Silverado, Camaro, Corvette, Equinox, Tahoe, Colorado, Malibu
- **Jeep**: Wrangler, Grand Cherokee, Cherokee, Gladiator, Compass
- Plus other major makes with their top 3–5 models

### Fallback behavior
When a model isn't in our lookup (e.g., a rare or brand-new model), the trim and engine fields become plain text inputs instead of showing incorrect options. This is strictly better than showing wrong data.

---

## Technical details

| What | How |
|------|-----|
| Data structure | `Record<string, Record<string, string[]>>` — `MAKE → MODEL → trims[]` |
| Lookup logic | `MODEL_TRIMS[make.toUpperCase()]?.[model.toUpperCase()] ?? []` |
| Fallback | Empty array → renders `<Input>` instead of `<Select>` (existing pattern) |
| Engine matching | Same two-level lookup for `MODEL_ENGINES` |
| File changed | `src/components/vehicle/SmartVehicleForm.tsx` only |

No API changes, no DB changes. Pure frontend data correction.

