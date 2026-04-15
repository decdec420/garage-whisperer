# Ratchet — Launch Readiness Audit Report

_Last updated: 2026-04-15_

## Executive Summary

Ratchet is a React + Supabase vehicle maintenance app with AI-powered diagnosis, project planning, and chat. This audit validates launch readiness across security, stability, compliance, and developer experience.

**Verdict:** Public launch GO (invite-only beta or open). All blocking items resolved.

---

## 1. Authentication & Authorization

| Item | Status |
|---|---|
| Email/password sign-up & sign-in | ✅ Working |
| Google OAuth | ✅ Configured with correct `redirectTo` |
| Password reset flow | ✅ `/reset-password` page with "Forgot password?" link on login |
| Password minimum length | ✅ 8 characters enforced consistently (signup + reset) |
| JWT validation in edge functions | ✅ All 10 functions validate via `getClaims()` or `getUser()` |
| `verify_jwt` in config.toml | ⚠️ `false` by design — in-code validation used |
| RLS on all tables | ✅ 22 tables with owner-scoped policies |

## 2. Security Posture

| Item | Status |
|---|---|
| CORS origin restriction | ✅ Production + preview domains in allowlist |
| Input validation in edge functions | ✅ UUID regex, string length limits, type checks |
| No raw SQL execution | ✅ All queries use typed Supabase client |
| No `dangerouslySetInnerHTML` | ✅ Only in shadcn internals |
| Storage RLS (repair-photos, vehicle-documents) | ✅ 8 policies, owner-scoped path-prefix |
| API key in delete-account call | ✅ `apikey` header included |
| No secrets in client code | ✅ Only publishable anon key |
| Leaked password protection | ⚠️ Manual toggle — enable in Supabase Dashboard > Auth > Settings |

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
| Raster icons (192px, 512px) | ✅ PNG icons with split `any`/`maskable` purpose |
| apple-touch-icon | ✅ `<link rel="apple-touch-icon">` in index.html |
| viewport-fit=cover | ✅ Supports iOS notch/Dynamic Island |
| Safe area bottom padding | ✅ CSS utility defined for iOS home indicator |
| Service worker | ❌ Not implemented (not required for installability) |

## 5. Legal & Compliance (App Store Requirements)

| Item | Status |
|---|---|
| Privacy Policy page | ✅ `/privacy` route with comprehensive policy |
| Terms of Service page | ✅ `/terms` route with liability disclaimer |
| Legal links on auth pages | ✅ Footer links on Login and Signup |
| Legal link in Settings | ✅ Footer links in Settings page |
| Children's privacy (COPPA) | ✅ Addressed in privacy policy |
| "Not professional advice" disclaimer | ✅ Prominent in Terms of Service |

## 6. Data Integrity

| Item | Status |
|---|---|
| Data export | ✅ 10,000-row limit per table (prevents silent truncation) |
| Account deletion | ✅ Full cascade via edge function |
| Offline detection | ✅ Banner shown when offline |

## 7. Code Quality

| Item | Status |
|---|---|
| TypeScript strict mode | ⚠️ `strict: false` — recommended to enable incrementally |
| ESLint | ✅ Passes |
| Build | ✅ Clean Vite production build |
| Unit tests | ✅ Passing (app-store, blueprint-support, charm-url) |
| E2E tests | ⚠️ Playwright config exists, no specs yet |

## 8. CI/CD

| Item | Status |
|---|---|
| GitHub Actions CI | ✅ Lint, typecheck, test, build |
| Dependency audit in CI | ⚠️ `continue-on-error: true` (non-blocking) |
| Edge function auto-deploy | ✅ Deployed on push |

## 9. Remaining Recommendations (Post-Launch)

1. **Enable leaked password protection** — Toggle in Supabase Dashboard > Authentication > Settings
2. **E2E test coverage** — Add Playwright specs for core flows
3. **TypeScript strictness** — Incrementally enable `strict: true`
4. **CI blocking gates** — Make dependency audit blocking; add post-deploy smoke tests
5. **Service worker** — Add for offline caching if desired
6. **Alerting** — Define thresholds for auth failures, edge function 5xx rates
