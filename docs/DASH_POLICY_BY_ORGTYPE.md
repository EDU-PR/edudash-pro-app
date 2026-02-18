# Dash Policy By Org Type

Date: 2026-02-13  
Source of truth: `lib/dash-ai/DashPolicyResolver.ts`

## Purpose
Standardize Dash behavior across Advisor/Tutor/ORB for different organization types, roles, and tiers.

## Inputs
- Role (`profile.role`)
- Organization type (`organization_type`/`school_type`, normalized)
- Tier (`profile.subscription_tier` + org fallback)
- Learner context (`ageBand`, `grade`)
- Feature flags (`dash_*` policy flags)

## Outputs
- `defaultMode`: `advisor | tutor | orb`
- `availableModes`: visible mode chips
- `systemPromptAddendum`: org/role policy instructions
- `toolShortcuts`: prioritized tool names
- `quickActions`: mode-aware starter prompts
- `voicePolicy`: provider order, fallback behavior, minimum/default rates
- `safetyPolicy`: PII + consent/escalation constraints

## Default Mode Matrix
| Org Type | Parent/Student | Teacher/Principal/Admin |
|---|---|---|
| `preschool` | `tutor` | `advisor` |
| `k12_school` | `tutor` | `advisor` |
| `skills_development`/membership-like | `tutor` (if learner role) | `advisor` |
| Other orgs | `tutor` (learner/parent) | `advisor` |

## Available Modes
- Parent/Student/Learner: `tutor`, `orb`
- Membership-like staff orgs: `advisor`, `orb`
- School staff orgs: `advisor`, `tutor`, `orb`

## Voice Policy (v1)
- Paid/premium-like tiers: cloud-first provider order (`azure`, then `device` fallback).
- Freemium: premium voice allowed within quota (`default: 3`), then device-only.
- Minimum speech rate floor: `1.0`.
- Phonics-specific synthesis target rate: `0.94` (sound clarity over speed).

## Org-Specific Prompt Addendum Rules
- Preschool:
  - Tutor: short, concrete, phonics/play-based.
  - Advisor: operational planning, routines, parent communication.
- K-12:
  - CAPS-aligned, grade-appropriate scaffolding.
- Membership/skills:
  - Governance, summaries, member communications, workflow clarity.

## Safety Rules
- PII redaction enabled by default.
- Parent consent required for preschool learner-role flows.
- Escalation paths required for staff-heavy/membership contexts.

## Integration Points (current)
- `app/screens/dash-voice.tsx`
  - Uses `systemPromptAddendum`, `quickActions`, `dash_mode` telemetry metadata.
- `components/dash-orb/index.tsx`
  - Uses policy tool-priority ordering and prompt addendum in AI context.

## Rollout Guidance
- Keep behavior behind flags for staged rollout:
  - `dash_unified_shell_v1`
  - `dash_voice_policy_v1`
  - `dash_phonics_quality_v1`
  - `dash_context_window_v1`
- Validate with role x orgType matrix tests before forcing defaults globally.
