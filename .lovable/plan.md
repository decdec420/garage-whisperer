

## Diamond-Tier Launch Plan

Two concrete deliverables plus five strategic ideas to take Ratchet from "functional app" to "fundable product."

---

### A. Settings Page Redesign

The current Settings page is three plain cards stacked vertically. Here's the upgrade:

**Layout**: Tabbed interface with three sections -- Account, Preferences, Data & Privacy.

**Account tab**:
- Profile card with large avatar circle (initials-based, colored by name hash), name, email, member-since date
- Editable name field with inline save
- Change password section (current password + new password + confirm)
- Connected accounts indicator (shows Google if linked)

**Preferences tab**:
- Notification preferences (maintenance reminders on/off, project updates on/off) -- stored in localStorage for now, DB later
- Units preference (miles/km) -- localStorage
- Ratchet personality toggle (concise vs detailed responses) -- localStorage

**Data & Privacy tab**:
- Data export with file size estimate ("~2.3 MB across 47 records")
- Clear AI memories button (wipes `ratchet_memory` table)
- Account deletion (existing flow, stays here)
- Links to Privacy Policy and Terms

**Files**: `src/pages/SettingsPage.tsx` (rewrite), no new dependencies needed -- uses existing Tabs component from shadcn.

---

### B. Public Landing Page (Marketing Front Door)

Right now, unauthenticated visitors see a login form. That's a dead end for marketing, SEO, App Store links, and investor demos.

**New `/welcome` route** (or make `/` the landing when logged out):

- Hero section: "Your AI mechanic buddy" headline, subheadline about what Ratchet does, CTA buttons (Get Started / Sign In)
- Three feature cards: AI Diagnostics, Maintenance Tracking, Guided Projects
- How it works: 3-step visual (Add vehicle -> Track everything -> Ask Ratchet)
- Social proof placeholder section (testimonial slots, "Used by X car owners")
- Footer with Privacy/Terms links

**Implementation**: Change `PublicRoute` logic so `/` renders a `LandingPage` component when logged out (instead of redirecting to `/login`). Login and Signup become linked from the landing page. No backend changes.

**Files**: New `src/pages/LandingPage.tsx`, edit `src/App.tsx` (route change).

---

### C. Five Out-of-the-Box Ideas

**1. Shareable Vehicle Health Report (viral loop)**
Let users generate a one-page PDF or shareable link of their vehicle's health score, maintenance history, and upcoming services. Use case: selling a car, showing a mechanic, or just bragging. Creates organic sharing and word-of-mouth.
- New "Share Report" button on vehicle detail page
- Generates a styled HTML-to-canvas summary or a public read-only link (short-lived, token-gated)

**2. "Ask Ratchet" Widget for External Embedding**
A lightweight embeddable chat widget (like Intercom but for car help) that partners -- auto parts stores, car forums, dealerships -- could embed on their sites. Opens a massive distribution channel beyond the app itself.
- Separate build target, iframe-based
- Monetization via API calls or partner licensing

**3. Mechanic Collaboration Mode**
Let users invite their mechanic (via email link) to view a specific vehicle's diagnostics and chat history. The mechanic gets a read-only (or annotate) view without needing a full account. Bridges DIY and professional -- makes Ratchet the communication layer.
- New `shared_access` table with token + expiry
- Read-only route `/shared/:token`

**4. Maintenance Cost Predictor**
Using the data Ratchet already has (vehicle age, mileage, service history, common failure patterns), show users a 12-month cost forecast: "Based on your 2012 Accord at 87k miles, expect ~$1,200 in maintenance this year." This is the kind of insight that makes users never leave.
- New dashboard widget
- Edge function that queries historical data + known service intervals

**5. OBD-II Bluetooth Integration (iOS/Android)**
Connect to a $15 ELM327 adapter via Web Bluetooth API. Pull live DTCs, clear codes, read sensor data -- all inside Ratchet. This turns the app from "tracker" to "scanner" and is the single biggest differentiator vs. competitors. Web Bluetooth works on Chrome Android today; for iOS App Store, would use Capacitor's BLE plugin.
- New "Connect Scanner" flow in vehicle detail
- Real-time sensor dashboard

---

### Implementation Scope (What I'll Build Now)

| Item | Files | Effort |
|------|-------|--------|
| Settings page redesign | `SettingsPage.tsx` rewrite | Medium |
| Public landing page | New `LandingPage.tsx`, `App.tsx` route | Medium |

The five ideas above are strategic -- each would be its own sprint. I'll document them in the codebase as a `ROADMAP.md` so they're captured for planning.

### Execution Order
1. Settings page redesign (self-contained, no routing changes)
2. Landing page + route change
3. Write `ROADMAP.md` with the five strategic ideas

