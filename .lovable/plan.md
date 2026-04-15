

# Combined UI Polish: Landing Page + Login Fix + Dashboard Cleanup

## 1. Login — Autofill turns input white
**File:** `src/index.css`
Add CSS override to force dark background on browser autofill:
```css
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0px 1000px hsl(0 0% 4%) inset !important;
  -webkit-text-fill-color: hsl(240 5% 96%) !important;
  transition: background-color 5000s ease-in-out 0s;
}
```

## 2. Landing Page — Fix the "printer running out of ink" problem
**File:** `src/pages/LandingPage.tsx`

The hero section has visual energy (mesh gradient, glow, glass mockup), but the Features, Steps, and "Under the Hood" sections drop to flat `bg-card/50` on black. They need the same visual continuity.

**Visual fixes:**
- **Features section** (line 94): Replace `bg-card/50` with a `relative` container holding subtle positioned radial gradient blobs (orange + indigo at ~5-8% opacity) so it doesn't feel like a hard cut to gray
- **Steps section** (line 117): Add a faint radial glow behind the step area
- **"Under the Hood" section** (line 136): Same mesh gradient treatment — subtle warm/cool radials instead of flat `bg-card/50`
- **CTA section**: Add a subtle gradient divider line above it (transparent → primary → transparent)
- **Footer**: Already has gradient — good as-is

**Copy fixes (monetization-safe):**
- Line 54: `"all free, all in your pocket"` → `"all in your pocket"` — drop the free claim
- Line 88: `"Free forever. No credit card. No catch. Seriously."` → `"No credit card. No strings. Just answers."`
- Line 139: `"for free"` → drop it: `"Here's what you're actually getting."`

## 3. Dashboard — Remove redundant Quick Intelligence buttons
**File:** `src/pages/Index.tsx`

Delete lines 467-487 (the "Ask Ratchet" / "Diagnose Issue" two-button grid). Ratchet FAB handles general chat, and diagnosis belongs in the vehicle's Diagnose tab. These buttons are redundant without vehicle context.

## 4. Save monetization strategy to memory
**File:** `mem://features/monetization-strategy`

Document the value-first funnel: guests can run a quick diagnosis teaser → prompted to sign up free → free tier is full-featured for personal use → paid tier unlocks live OBD2, always-on Ratchet, fleet/shop features. Never paywall immediately after signup — ROI first, then upgrade.

---

## Files to edit
| File | Change |
|------|--------|
| `src/index.css` | Autofill background override |
| `src/pages/LandingPage.tsx` | Mesh gradients on lower sections + copy tweaks |
| `src/pages/Index.tsx` | Remove Quick Intelligence buttons (lines 467-487) |
| `mem://features/monetization-strategy` | Save freemium funnel model |
| `mem://index.md` | Add monetization strategy reference |

