# UX Scope — NEXT-GEN (Production v1)

Date: 2026-02-13  
Branch: `chore/prod-ready-nextgen-v1`

## Goal
Ship a consistent, performant Dash AI/Tutor/ORB experience across role-based dashboards with strong production defaults.

## Layout System
- Single spacing/color token source: `lib/ui/tokens.ts`.
- Bottom navigation behavior centralized by role via `lib/navigation/navManifest.ts`.
- Center Dash tab policy:
  - Parent/Student/Teacher/Principal: center Dash tab enabled.
  - School admin route fallback handled via manifest constant.
- Dashboard first-render telemetry added for cold-start visibility.

## Role UX Presets
- Parent/Student: Tutor-first interactions, simplified quick prompts, voice-first flow.
- Teacher/Principal: Advisor-first interactions, planning/operations-oriented quick prompts.
- Membership/skills org admin: Advisor-first workflow with governance/comms/summary actions.

## Dash Shell Interaction Rules
- Top strip remains compact (tier/mode/context).
- Quick actions prioritize three primary CTAs per mode.
- Tool outputs should default to summarized cards; raw outputs must be secondary.
- Voice transcript stays visible while recording to reduce uncertainty.

## Accessibility Baseline
- Minimum tap target: 44px equivalent on core controls.
- Critical controls require explicit labels (mic, send, attach, call, scan).
- Contrast must remain readable on dark shell cards and chips.

## Performance Budgets (v1)
- Cold start to first interactive dashboard target:
  - p50 <= 1.8s
  - p95 <= 3.5s
- Dash turn perceived response-start (voice) target:
  - p50 <= 1.5s
- Long list screens:
  - Use virtualization (`FlashList`) for large datasets.
  - Avoid inline closures/object creation in row render paths.

## Instrumentation Added
- App start mark: `app_start` (already existing perf utility).
- Auth bootstrap event: `edudash.app.auth_bootstrap`.
- Profile ready event: `edudash.app.profile_ready`.
- First dashboard render event: `edudash.app.first_dashboard_render`.

## Known Follow-ups (post-v1)
- Continue replacing hard-coded layout values with tokenized spacing/radii.
- Expand nav manifest to become the single route visibility contract for web/native parity.
- Tighten animation and list rendering audits on top 5 heavy screens.
