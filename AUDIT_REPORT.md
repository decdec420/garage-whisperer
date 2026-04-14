# Ratchet — Launch Readiness Audit Report

_Last updated: 2026-04-14_

## Executive summary

Ratchet is a React + Supabase vehicle maintenance app with AI-powered diagnosis, project planning, and chat. This audit validates launch readiness across security, stability, and developer experience.

**Verdict:** Invite-only beta GO. Public launch recommended after E2E test pass.

---

## 1. Authentication & Authorization

| Item | Status |
|---|---|
| Email/password sign-up & sign-in | ✅ Working |
| Google OAuth | ✅ Configured with correct `redirectTo` |
| Password reset flow | ✅ `/reset-password` page with `resetPasswordForEmail` |
| JWT validation in edge functions | ✅ All 10 functions validate via `getClaims()` or `getUser()` in code |
| `verify_jwt` in config.toml | ⚠️ Set to `false` for all functions (by design — signing-keys system requires in-code validation) |
| RLS on all tables | ✅ Enabled with owner-scoped policies |

## 2. Security Posture

| Item | Status |
|---|---|
| CORS origin restriction | ✅ All edge functions use origin allowlist (`getratchet.lovable.app` + preview domain) |
| Input validation in edge functions | ✅ UUID regex, string length limits, type checks |
| No raw SQL execution | ✅ All queries use typed Supabase client |
| No `dangerouslySetInnerHTML` | ✅ Only in shadcn internals |
| Storage RLS (repair-photos, vehicle-documents) | ✅ Owner-scoped path-prefix policies |
| API key in delete-account call | ✅ `apikey` header included |
| No secrets in client code | ✅ Only publishable anon key |

## 3. Error Handling & Observability

| Item | Status |
|---|---|
| ErrorBoundary wrapping app root | ✅ Wraps `<Routes>` in App.tsx |
| Sentry integration | ✅ Env-gated via `VITE_SENTRY_DSN` |
| PostHog analytics | ✅ Env-gated via `VITE_POSTHOG_KEY` |
| Edge function error responses | ✅ All return structured JSON with CORS headers |

## 4. PWA & Installability

| Item | Status |
|---|---|
| manifest.json | ✅ Complete with name, icons, theme |
| Raster icons (192px, 512px) | ✅ PNG icons generated from SVG |
| Icon purpose split | ✅ Separate `any` and `maskable` entries |
| Service worker | ❌ Not implemented (not needed for installability) |

## 5. Code Quality

| Item | Status |
|---|---|
| TypeScript strict mode | ⚠️ `strict: false` — recommended to enable incrementally |
| ESLint | ✅ Passes (some rules disabled for pragmatic reasons) |
| Build | ✅ Clean Vite production build |
| Unit tests | ✅ Passing (app-store, blueprint-support, charm-url) |
| E2E tests | ⚠️ Playwright config exists but no specs yet |
| No stray `console.log`/`console.error` | ✅ Cleaned |

## 6. CI/CD

| Item | Status |
|---|---|
| GitHub Actions CI | ✅ Runs lint, typecheck, test, build |
| Dependency audit in CI | ⚠️ `continue-on-error: true` (non-blocking) |
| Edge function auto-deploy | ✅ Deployed on push |

## 7. Developer Experience

| Item | Status |
|---|---|
| `.env.example` | ✅ Created with placeholder values |
| README setup instructions | ✅ Consistent with repo artifacts |

## 8. Remaining Recommendations (Post-Beta)

1. **E2E test coverage** — Add Playwright specs for signup, login, add vehicle, diagnosis, project creation, file upload
2. **TypeScript strictness** — Incrementally enable `strict: true` on core paths
3. **CI blocking gates** — Make dependency audit blocking; add post-deploy smoke tests
4. **Alerting** — Define thresholds for auth failures, edge function 5xx rates, client crash spikes
5. **Incident runbook** — Document rollback procedures and escalation paths
