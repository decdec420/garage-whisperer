

## Launch Hardening Plan

### Summary
Fix the concrete issues that would block a confident public launch. No new features -- just tightening what exists.

### What needs fixing

**1. Missing password reset flow**
Login page has no "Forgot password?" link, and there is no `/reset-password` page. Users who forget their password are stuck.
- Add "Forgot password?" link to Login page that calls `supabase.auth.resetPasswordForEmail`
- Create `/reset-password` route that detects the recovery token and lets users set a new password

**2. Create `.env.example`**
README references `cp .env.example .env` but the file does not exist. New contributors/CI get confused.
- Create `.env.example` with placeholder values for the three `VITE_` vars

**3. ErrorBoundary not wrapping the app root**
ErrorBoundary only wraps the page content inside AppLayout. If AppLayout itself or a public route (Login/Signup) throws, the user gets a white screen.
- Wrap the top-level `<Routes>` in App.tsx with ErrorBoundary

**4. Missing `apikey` header in delete-account fetch call**
`SettingsPage.tsx` calls the `delete-account` edge function via raw `fetch()` without the `apikey` header. Supabase gateway may reject this depending on config.
- Add `apikey` header (same pattern as `invokeWithAuth`)

**5. PWA manifest needs proper raster icons**
`manifest.json` only has an SVG icon with `"purpose": "any maskable"`. Most Android/iOS install prompts require a 192x192 and 512x512 PNG. Without them, "Add to Home Screen" will fail or show a blank icon.
- Generate 192px and 512px PNG icons from the SVG
- Split `purpose` into separate entries (`any` and `maskable`)

**6. NotFound page has a stray `console.error`**
Line 8 of NotFound.tsx logs to console on every 404. Remove it (Sentry/PostHog already cover this via pageview tracking).

**7. CORS origin hardening for production**
All 10 edge functions use `Access-Control-Allow-Origin: "*"`. For launch, restrict to the actual production origin(s).
- Update all edge functions to check `Origin` header against an allowlist (the published domain + preview domain), falling back to `*` only in development

**8. Stale `AUDIT_REPORT.md`**
The existing audit report references outdated JWT settings. Should be regenerated to match current state.
- Regenerate with accurate findings

### What is already fine (no action needed)
- All edge functions validate JWTs via `getClaims()` or `getUser()` -- the security scanner findings are correctly ignored
- RLS is enabled on all tables with proper owner-scoped policies
- No `console.log` statements in src
- No `dangerouslySetInnerHTML` outside shadcn internals
- Error boundary exists with Sentry reporting
- Offline detection banner works
- Data export and account deletion work
- Google OAuth configured with correct `redirectTo`

### Technical details

| # | Files affected | Complexity |
|---|---|---|
| 1 | `src/pages/Login.tsx`, new `src/pages/ResetPassword.tsx`, `src/App.tsx` | Medium |
| 2 | New `.env.example` | Trivial |
| 3 | `src/App.tsx` | Trivial |
| 4 | `src/pages/SettingsPage.tsx` | Trivial |
| 5 | `public/manifest.json`, generate PNGs | Low |
| 6 | `src/pages/NotFound.tsx` | Trivial |
| 7 | All 10 `supabase/functions/*/index.ts` | Medium |
| 8 | `AUDIT_REPORT.md` | Low |

### Execution order
Steps 2, 3, 4, 6 first (quick wins). Then 1 (password reset). Then 5 (icons). Then 7 (CORS). Then 8 (audit doc).

