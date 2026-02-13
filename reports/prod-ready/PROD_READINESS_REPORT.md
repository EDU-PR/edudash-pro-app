# EDUdash Pro — Production Readiness Baseline

Date: 2026-02-13
Branch: `chore/prod-ready-nextgen-v1`

## Scope Executed
- Root: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`
- Root optional: `npm run verify:reliability-audit`, `npm run check:expo-filesystem`, `npm run check:file-sizes`, `npm run i18n:sweep:report`
- Web: `npm run lint`, `npm run typecheck`, `npm run build`
- SOA web: `npm run lint`, `npm run build`
- Secrets scan: `rg` pattern scan (plus optional gitleaks/trufflehog if installed)

## Result Summary
- Passing:
  - Root tests (`46 passed, 2 skipped`)
  - Root lint (warnings only)
  - Root reliability audit
  - Root expo filesystem check
  - Web typecheck
  - Web build
  - SOA web build
- Failing / blocking:
  - Root format check (`prettier` missing)
  - Root typecheck (DashInputBar prop mismatch)
  - Web lint (1 hard error)
  - SOA web lint (interactive eslint setup prompt; non-CI-safe)
  - Secrets scan shows exposed credentials and key-like values in repo
  - File-size policy check fails on many oversized files

## P0 (Blocking)
1. Hardcoded sensitive key in app config
- Command: `rg ...` (see `reports/prod-ready/secrets_rg_hits.txt`)
- Excerpt:
  - `app.json:268: "DAILY_API_KEY": "..."`
- Impact: Client-side secret exposure.

2. Hardcoded service-role JWTs in repository script
- Command: `rg ...`
- Excerpt:
  - `web/fix-davecon-org-assignment.mjs: EDUDASH_SERVICE_KEY = '...'`
  - `web/fix-davecon-org-assignment.mjs: EDUSITE_SERVICE_KEY = '...'`
- Impact: Direct production credential exposure.

3. Root TypeScript fails
- Command: `npm run typecheck`
- Excerpt (`reports/prod-ready/root_typecheck.txt`):
  - `components/ai/DashAssistant.tsx(373,13): Property 'hideQuickChips' does not exist on type 'DashInputBarProps'.`
- Impact: Build gate cannot be trusted.

4. Web lint fails (error)
- Command: `cd web && npm run lint`
- Excerpt (`reports/prod-ready/web_lint.txt`):
  - `web/src/lib/hooks/teacher/useTeacherDashboard.ts: 'studentCountsByClass' is never reassigned. Use 'const' instead (prefer-const)`
- Impact: CI quality gate fails.

5. SOA lint is interactive and not CI-safe
- Command: `cd soa-web && npm run lint`
- Excerpt (`reports/prod-ready/soaweb_lint.txt`):
  - `How would you like to configure ESLint?`
- Impact: Non-deterministic automation in CI.

## P1 (High Priority)
1. Root format check fails
- Command: `npm run format:check`
- Excerpt:
  - `sh: 1: prettier: not found`
- Impact: formatting gate not usable.

2. Asset bundling is overly broad
- File: `app.json:13`
- Current: `"assetBundlePatterns": ["**/*", "locales/**/*.json"]`
- Impact: larger bundles and slower startup/OTA payload risk.

3. Web deployment notifier unauthorized in build flow
- Command: `cd web && npm run build`
- Excerpt (`reports/prod-ready/web_build.txt`):
  - `Failed to send deployment notification: HTTP 401`
- Impact: noisy build/deploy signal and possible missed release notifications.

## P2 (Important, non-blocking for immediate release)
1. File size policy violations across many files
- Command: `npm run check:file-sizes`
- Excerpt: many files over max thresholds (see `reports/prod-ready/root_file_sizes.txt`)
- Impact: maintainability/perf risks; requires phased refactors.

2. Web lint warning volume is very high (1178 warnings)
- Command: `cd web && npm run lint`
- Impact: reduced signal-to-noise; technical debt.

3. SOA build metadata warnings
- Command: `cd soa-web && npm run build`
- Excerpt:
  - `metadataBase property in metadata export is not set...`
- Impact: SEO/social metadata correctness.

## Immediate Remediation Plan (next commits)
1. Remove exposed keys and move all sensitive values to server/runtime env only.
2. Add repo guardrails (`gitleaks` config + CI workflow).
3. Fix root TS error + web lint error + SOA eslint config bootstrap.
4. Add strict `verify:prod` script and enforce typecheck in build hooks.
5. Reduce `assetBundlePatterns` scope and add startup performance instrumentation hooks.

---

## Remediation Status (Post-Fix Validation)
Validation run date: 2026-02-13

### Completed
- Removed client-side Daily key exposure in app config and build profiles.
- Daily token minting hardened with role-based server checks and JWT verification.
- Added security scanning guardrails:
  - `.gitleaks.toml`
  - `.github/workflows/security.yml`
- Added secret rotation runbook:
  - `docs/SECURITY_ROTATION_CHECKLIST.md`
- Build gates improved:
  - Root typecheck now passes.
  - Root lint passes (warnings only).
  - Root tests pass.
  - SOA web lint no longer blocks on interactive setup.
- Added production verification command:
  - `npm run verify:prod`

### Current Gate Result Snapshot
- `npm run lint`: PASS (warnings only)
- `npm run typecheck`: PASS
- `npm test`: PASS
- `npm run verify:reliability-audit`: PASS
- `npm run check:expo-filesystem`: PASS
- `npm --prefix web run lint`: PASS (warnings only)
- `npm --prefix web run typecheck`: PASS
- `npm --prefix web run build`: PASS (postbuild deployment notify returns 401 without webhook secret)
- `npm --prefix soa-web run lint`: PASS (warnings only)
- `npm --prefix soa-web run build`: PASS (metadataBase warnings only)
- `npm run verify:prod`: PASS

### Residual Warnings / Non-Blocking
- Web lint warning backlog remains high and should be reduced in a separate cleanup stream.
- `web` deployment notification postbuild hook is unauthenticated in local/CI without `DEPLOYMENT_WEBHOOK_SECRET`.
- `soa-web` has metadataBase and image optimization warnings that do not fail build.
