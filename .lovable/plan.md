

## App Store & Public Launch Readiness Plan

### Current State
The app is **well-built** — clean auth, solid RLS across all 22 tables + 2 storage buckets, CORS hardened, ErrorBoundary in place, password reset flow working, PWA manifest correct. Security scan shows only 1 warning (leaked password protection). No RLS violations.

But there are **8 concrete gaps** that would cause rejection or poor first impressions if you shipped today.

---

### What Needs Fixing

**1. Missing Privacy Policy & Terms of Service (App Store BLOCKER)**
Apple and Google both reject apps without linked legal pages. There are zero references to privacy/terms anywhere in the codebase.
- Create `/privacy` and `/terms` routes with basic policy pages
- Add footer links on Login and Signup pages
- Add link in Settings page

**2. Missing `viewport-fit=cover` for iOS notch/Dynamic Island**
The `index.html` viewport meta tag lacks `viewport-fit=cover`. On modern iPhones, content will render behind the notch/status bar or leave ugly gaps.
- Update viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`
- The `safe-area-bottom` class on the bottom nav already exists, which is good

**3. Missing `apple-touch-icon` in index.html**
iOS Safari uses `apple-touch-icon` for Add to Home Screen, not the manifest. Without it, users get a screenshot thumbnail instead of the app icon.
- Add `<link rel="apple-touch-icon" href="/icon-192.png">` to `index.html`

**4. Enable Leaked Password Protection (Security scan warning)**
The only security finding. Supabase offers built-in HIBP checking — it's a toggle in the dashboard. Users signing up with compromised passwords is a liability.
- Enable in Supabase Dashboard > Authentication > Settings

**5. Signup password minimum mismatch**
`Signup.tsx` enforces 6-character minimum, but `ResetPassword.tsx` enforces 8-character minimum. Inconsistent — a user could set a 6-char password at signup, then be unable to "reset" to the same password.
- Standardize to 8-character minimum everywhere

**6. Missing `safe-area-bottom` CSS utility**
`AppLayout.tsx` uses `safe-area-bottom` class but it's never defined in CSS. This means the bottom nav may overlap the home indicator on iPhones.
- Add CSS: `.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }`

**7. Data export 1000-row limit risk**
`SettingsPage.tsx` exports data with `supabase.from('table').select('*')` — Supabase defaults to 1000 rows max. Power users could silently lose data in exports.
- Add `.limit(10000)` or paginated fetching for export queries

**8. Regenerate `AUDIT_REPORT.md`**
The current report is stale — it still references the pre-hardening state. Should reflect current findings for investor/reviewer confidence.
- Update to match current scan results and codebase state

---

### What Is Already Good (No Action Needed)
- RLS on all 22 tables with proper owner-scoped policies
- 8 storage policies correctly scoped by `auth.uid()` path prefix
- CORS hardened to production origin allowlist
- ErrorBoundary wraps root `<Routes>`
- Password reset flow complete (Login link + `/reset-password` page)
- JWT validated in-code in all 10 edge functions
- `apikey` header present on delete-account call
- PWA manifest with proper raster icons (192px, 512px, split purpose)
- Google OAuth with correct `redirectTo`
- Offline detection banner
- Data export and account deletion working
- CI pipeline (lint, typecheck, test, build)

---

### Technical Details

| # | Files Affected | Complexity |
|---|---|---|
| 1 | New `src/pages/Privacy.tsx`, `src/pages/Terms.tsx`, `src/App.tsx`, `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/pages/SettingsPage.tsx` | Medium |
| 2 | `index.html` | Trivial |
| 3 | `index.html` | Trivial |
| 4 | Supabase Dashboard (manual) | Trivial |
| 5 | `src/pages/Signup.tsx` | Trivial |
| 6 | `src/index.css` | Trivial |
| 7 | `src/pages/SettingsPage.tsx` | Low |
| 8 | `AUDIT_REPORT.md` | Low |

### Execution Order
Steps 2, 3, 5, 6 first (one-line fixes). Then 1 (legal pages). Then 7 (export fix). Then 8 (audit doc). Step 4 is a manual dashboard toggle you'll do yourself.

