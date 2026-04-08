# Larry Audit Report

_Last updated: 2026-04-08_

## Executive summary

**Current state:** materially improved and much safer than the imported baseline.

**Owner-use readiness:** close to usable once the new Supabase migration/config changes are applied to the real project.

**Public-launch readiness:** **not yet**. The largest remaining gaps are operational maturity, test coverage, lint/type debt, and verifying the live Supabase project matches the hardened code in this repo.

---

## What was fixed immediately

### 1) Edge Functions now require JWTs
**Risk:** critical

The repo had every Supabase Edge Function configured with `verify_jwt = false`, which would allow unauthenticated access to sensitive function endpoints.

**Action taken:**
- Updated `supabase/config.toml` to set all listed functions to `verify_jwt = true`.
- Added explicit authenticated invocation helper on the frontend:
  - `src/integrations/supabase/functions.ts`
- Updated frontend call sites to send bearer tokens reliably.

### 2) Dev server exposure reduced
**Risk:** moderate/high in careless environments

The Vite dev server was binding to all interfaces (`::`), which is a common accidental exposure path.

**Action taken:**
- Changed default dev bind address to `127.0.0.1`
- Enabled `strictPort`

### 3) Dependency risk reduced to zero known audit findings
**Risk:** high initially

Initial audit: **15 vulnerabilities (9 high)**

**Action taken:**
- Applied non-breaking audit fixes
- Upgraded toolchain:
  - `vite` → `^8.0.7`
  - `@vitejs/plugin-react-swc` → `^4.3.0`
  - `vitest` → `^4.1.3`
  - `jsdom` → `^29.0.2`
- Removed `lovable-tagger`, which was blocking the final dependency cleanup

**Result:**
- `npm audit` now reports **0 vulnerabilities**

### 4) Cross-user diagnosis linkage hardened
**Risk:** high data integrity / multi-tenant safety

`generate-project` and `generate-diagnosis` accepted `diagnosisId` and updated diagnosis sessions without proving that the session belonged to the authenticated user + vehicle.

**Action taken:**
- Added ownership checks before updates
- Scoped updates with `user_id` and `vehicle_id`

### 5) Legacy multi-user RLS gap identified and patched in migration
**Risk:** high

`vehicle_projects` and `vehicle_project_tasks` had policies but **RLS was never actually enabled** in the original migration.

**Action taken:**
- Added migration: `supabase/migrations/20260408003600_security_hardening_rls_and_privacy.sql`
- This enables RLS on both tables

### 6) Shared-cache privacy tightened
**Risk:** medium/high

`diagnostic_patterns` and `charm_cache` had authenticated read policies broader than necessary. `diagnostic_patterns` stores fields like `source_user_id` / `source_diagnosis_id`, which are not appropriate for broad client reads in a multi-user product.

**Action taken:**
- New migration drops broad authenticated read policies
- Service-role access remains for server-side functions

### 7) Performance improved via route-based code splitting
**Risk:** product quality/performance

The app was effectively shipping as a large monolithic frontend bundle.

**Action taken:**
- Converted route components in `src/App.tsx` to lazy-loaded chunks

**Result:**
- Bundle split into route-level chunks
- Better first-load performance and lower launch friction

### 8) CI added
**Risk:** operational quality

There was no visible CI guardrail.

**Action taken:**
- Added `.github/workflows/ci.yml`
- CI runs:
  - `npm ci`
  - `npm run build`
  - `npm test`
  - `npm audit --audit-level=high`

### 9) Environment setup clarified
**Risk:** setup fragility

**Action taken:**
- Added `.env.example`
- Added frontend env guard in `src/integrations/supabase/client.ts`
- Expanded README setup notes

---

## Validation performed

### Build
- `npm run build` ✅

### Tests
- `npm test` ✅

### Dependency audit
- `npm audit` ✅ (0 vulnerabilities)

---

## Remaining material risks / weaknesses

### A) Lint / type-quality debt is still heavy
**Severity:** medium

The repo still has a large number of ESLint issues, especially:
- pervasive `any`
- empty blocks
- hook dependency warnings
- misc maintainability issues

**Impact:**
- not an immediate blocker for owner-only use
- absolutely a blocker for calling the codebase “diamond tier” or scaling a team around it

### B) Test coverage is extremely thin
**Severity:** high for launch confidence

Current visible automated coverage is minimal (effectively a smoke test, not behavior coverage).

**Missing:**
- auth flow tests
- vehicle CRUD tests
- docs/manual search tests
- diagnosis/project generation contract tests
- permission boundary tests
- e2e happy paths and failure paths

### C) Live Supabase state may not match the repo yet
**Severity:** high

The repo is hardened, but if the live Supabase project has not had the new migration/config changes applied, the real app may still be weaker than the code suggests.

**Must verify on the actual project:**
- Edge Functions deployed with JWT verification enabled
- latest migration applied
- storage policies reflect private-per-user access
- no stale permissive policies remain in remote DB

### D) Frontend bundle is improved but still chunky
**Severity:** medium

Route splitting helped a lot, but there are still sizable chunks.

**Future improvement ideas:**
- lazy load heavy panels/components within `VehicleDetail` and `ProjectDetail`
- split chart/docs/project-generator logic further
- consider moving to `@vitejs/plugin-react` if you want to follow Vite’s current recommendation

### E) Operational maturity still needs work
**Severity:** medium/high depending on launch scope

Still recommended before real public launch:
- error monitoring (Sentry or equivalent)
- structured logs
- product analytics / funnel tracking
- rate limiting / abuse controls on AI-heavy functions
- deploy checklist / rollback procedure

---

## Launch view

### If used only by Tommy right now
**Reasonable after live Supabase hardening is applied and smoke-tested.**

### If opening to outside users next week
**Not recommended yet as a public launch.**

### If doing an invite-only beta next week
**Realistic**, if the next priorities are:
1. apply/verify live Supabase migrations and function config
2. add critical happy-path e2e coverage
3. smoke test auth + diagnosis + project generation + docs/manual flow
4. add monitoring

---

## Recommended next sprint priorities

### P0
1. Apply the new migration to the live Supabase project
2. Deploy the Edge Function auth/config changes
3. Verify every affected flow works under JWT-required functions
4. Run an end-to-end owner smoke test

### P1
5. Add Playwright coverage for:
   - signup/login
   - add vehicle
   - search manuals
   - start diagnosis
   - create project
6. Add error monitoring
7. Create a production deployment checklist

### P2
8. Reduce ESLint/type debt in core screens first:
   - `DiagnosisSession.tsx`
   - `ProjectDetail.tsx`
   - `RatchetPanel.tsx`
   - `BlueprintTab.tsx`
9. Further split large client chunks

---

## Bottom line

This codebase is now on a **meaningfully safer and more professional trajectory**.

It is **not yet public-launch polished**, but it is no longer in the “unsafe imported prototype” state it started in. The biggest wins were function auth, dependency cleanup, multi-tenant hardening, CI, and performance splitting.
