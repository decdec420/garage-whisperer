

# Profile Link Fix + Aesthetic Micro-Interactions

## The Problem
The sidebar profile area at the bottom is just a `navigate('/settings')` hyperlink — feels lazy. User wants it to feel intentional, not "you clicked a link and ended up somewhere."

## The Fun Question
"How do I add personality without changing the layout?" — micro-interactions, hover effects, contextual flourishes. A "personality layer" on top of the existing clean dark UI.

---

## Changes

### 1. Profile Click → Settings with Profile Tab Auto-Selected
**Files:** `src/components/AppLayout.tsx`, `src/pages/SettingsPage.tsx`

Instead of just dumping the user on Settings, navigate to `/settings?tab=account` and auto-scroll to the profile card. The sidebar profile button gets a subtle tooltip-style label on hover: "Your profile" instead of just being a silent clickable row.

- Add `?tab=account` to the profile navigation in AppLayout
- In SettingsPage, read `tab` from URL params to set the default tab
- Feels purposeful — "I clicked my name and it took me to MY profile"

### 2. Aesthetic Micro-Interactions (The Fun Layer)

**A. Sidebar nav items — hover magnetic effect**
`src/components/AppLayout.tsx`
- Add a subtle background glow that follows the hovered item (a `bg-gradient-to-r from-primary/5 to-transparent` that appears on hover)
- Active item gets a soft pulse on the left accent bar when first entering the page

**B. Dashboard greeting — time-aware emoji + typewriter feel**
`src/pages/Index.tsx`
- Add a contextual emoji to the greeting: 🌅 morning, ☀️ afternoon, 🌙 evening
- The greeting text gets a subtle `animate-fade-in` with a slight delay so it feels like Ratchet is "saying" it

**C. Vehicle Health Cards — hover lift + glow ring**
`src/pages/Index.tsx`
- Cards get the `card-hover` class (already in CSS but not applied)
- Health gauge gets a subtle colored ring glow matching the score (green = healthy, orange = warning, red = critical)

**D. Garage cards — color accent strip**
`src/pages/Garage.tsx`
- Each vehicle card gets a thin 3px left border in the vehicle's stored color (or primary as fallback)
- Hover reveals a subtle "→" slide animation on the "View" button

**E. Settings profile card — personality touch**
`src/pages/SettingsPage.tsx`
- Avatar gets a hover scale-up (1.05) with the glow ring intensifying
- "Member since" gets a fun micro-copy: "Wrenching since April 2025"
- The initials avatar has a subtle gradient background instead of flat color

**F. Global — section headings get a fade-in on scroll**
`src/index.css`
- Add an `animate-on-scroll` utility using Intersection Observer pattern (CSS-only with `animation-timeline: view()` for modern browsers, graceful fallback)

### 3. Sidebar Profile — Visual Upgrade
`src/components/AppLayout.tsx`
- The profile row gets a subtle gradient border (like the `gradient-border` class already in CSS)
- Logout icon gets a hover rotation (15deg tilt)
- Profile name shows "Your profile →" on hover as a tooltip-style indicator

---

## Files to Edit
| File | Change |
|------|--------|
| `src/components/AppLayout.tsx` | Profile → `/settings?tab=account`, hover effects on nav + profile |
| `src/pages/SettingsPage.tsx` | Read `tab` from URL params, avatar hover, "Wrenching since" copy |
| `src/pages/Index.tsx` | Greeting emoji, card-hover on vehicle cards, gauge glow |
| `src/pages/Garage.tsx` | Color accent strip on cards, hover slide on button |
| `src/index.css` | Scroll-triggered fade utility, logout hover rotation |

All additive — nothing removed, nothing restructured. Just personality sprinkled on top.

