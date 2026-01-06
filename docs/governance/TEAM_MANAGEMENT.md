# EduDash Pro - Team Management Blueprint

> **Version:** 1.0.0  
> **Last Updated:** January 6, 2026  
> **Team Size:** 10 Junior Developers + 1 Lead (You)

---

## Table of Contents

1. [Team Structure Overview](#team-structure-overview)
2. [Domain Assignments](#domain-assignments)
3. [Developer Onboarding Checklist](#developer-onboarding-checklist)
4. [Git Workflow & Branch Strategy](#git-workflow--branch-strategy)
5. [Code Review Guidelines](#code-review-guidelines)
6. [Daily/Weekly Rituals](#dailyweekly-rituals)
7. [Feature Flags System](#feature-flags-system)
8. [Code Quality Standards](#code-quality-standards)
9. [Common Mistakes to Watch For](#common-mistakes-to-watch-for)
10. [Performance Monitoring](#performance-monitoring)
11. [Escalation Path](#escalation-path)
12. [Quick Reference Commands](#quick-reference-commands)

---

## Team Structure Overview

```
                    ┌─────────────────────┐
                    │   YOU (Tech Lead)   │
                    │  Architecture/PRs   │
                    └─────────┬───────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌─────▼─────┐         ┌────▼────┐
   │ Pod A   │          │  Pod B    │         │  Pod C  │
   │ Core    │          │ Features  │         │  Web    │
   └────┬────┘          └─────┬─────┘         └────┬────┘
        │                     │                    │
   ┌────┴────┐          ┌─────┴─────┐         ┌────┴────┐
   │Dev 1    │          │Dev 4,5,6  │         │Dev 10   │
   │Dev 2,3  │          │Dev 7,8,9  │         │(Web)    │
   │(Core/AI)│          │(Features) │         │         │
   └─────────┘          └───────────┘         └─────────┘
```

### Pod Structure

| Pod | Developers | Focus Area | Stand-up Time |
|-----|------------|------------|---------------|
| **Pod A: Core** | Dev 1, 2, 3 | Auth, AI Engine, AI UI | 9:00 AM |
| **Pod B: Features** | Dev 4, 5, 6, 7, 8, 9 | School/Parent/Membership/Payments/Comms | 9:30 AM |
| **Pod C: Web** | Dev 10 | Next.js Web Application | 10:00 AM |

---

## Domain Assignments

### Dev 1: Auth & Core Infrastructure 🔒

**Owner:** ___________________ (Fill name)  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| Authentication | `contexts/AuthContext.tsx` |
| Session Management | `lib/sessionManager.ts` |
| RBAC System | `lib/rbac/*` |
| Security Utilities | `lib/security/*`, `lib/encryption.ts` |
| Route Guards | `hooks/useRouteGuard.ts` |
| Edge Functions | `supabase/functions/auth-*/*` |

**Current Sprint Tasks:**
- [ ] Phone verification implementation
- [ ] Biometric auth improvements
- [ ] Session refresh edge cases

**Key Files to Master:**
```
contexts/AuthContext.tsx          # 400 lines - main auth state
lib/sessionManager.ts             # 200 lines - token handling
lib/rbac/types.ts                 # 150 lines - permission checks
hooks/useRouteGuard.ts            # 100 lines - route protection
```

**Review Pair:** Dev 10 (Web auth must match mobile)

---

### Dev 2: AI Engine & Orchestration 🤖

**Owner:** ___________________  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| AI Client | `services/dash-ai/DashAIClient.ts` |
| Tool Registry | `services/dash-ai/DashToolRegistry.ts` |
| Agent Orchestration | `services/AgentOrchestrator.ts` |
| AI Memory | `services/dash-ai/DashAIMemory.ts` |
| Edge Functions | `supabase/functions/ai-proxy/*` |

**Current Sprint Tasks:**
- [ ] Improve tool execution reliability
- [ ] Add AI usage analytics
- [ ] Implement conversation memory limits

**Key Files to Master:**
```
services/dash-ai/DashAIClient.ts      # Main AI API client
services/dash-ai/DashToolRegistry.ts  # Tool definitions
services/AgentOrchestrator.ts         # Plan-Act-Reflect loop
supabase/functions/ai-proxy/index.ts  # Edge function proxy
```

**Review Pair:** Dev 3 (AI UI/Voice)

---

### Dev 3: AI UI & Voice Interface 🎙️

**Owner:** ___________________  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| AI Chat Interface | `components/dash-ai/DashAIChat.tsx` |
| Voice Input | `components/dash-ai/VoiceInput.tsx` |
| Floating AI Button | `components/dash-ai/FloatingAIOrb.tsx` |
| Wake Word | `services/wakeWord/*` |
| Text-to-Speech | `services/textToSpeech.ts` |

**Current Sprint Tasks:**
- [ ] Voice input noise cancellation
- [ ] Chat message animations
- [ ] Accessibility improvements (screen readers)

**Key Files to Master:**
```
components/dash-ai/DashAIChat.tsx     # Main chat UI
components/dash-ai/VoiceInput.tsx     # Voice recording
components/dash-ai/FloatingAIOrb.tsx  # Floating action button
hooks/useDashAI.ts                    # AI hook for components
```

**Review Pair:** Dev 2 (AI Engine)

---

### Dev 4: Principal/School Administration 🏫

**Owner:** ___________________  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| Principal Dashboard | `app/screens/principal/*` |
| School Settings | `components/school/*` |
| Teacher Management | `hooks/useTeachers.ts` |
| Class Management | `hooks/useClasses.ts` |

**Current Sprint Tasks:**
- [ ] Bulk teacher import CSV
- [ ] School analytics dashboard
- [ ] Parent approval workflows

**Key Files to Master:**
```
app/screens/principal/dashboard.tsx   # Main principal screen
app/screens/principal/teachers.tsx    # Teacher management
hooks/useSchoolSettings.ts            # School configuration
components/school/ClassCard.tsx       # Class display
```

**Review Pair:** Dev 5 (Teacher Experience)

---

### Dev 5: Teacher Experience 👩‍🏫

**Owner:** ___________________  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| Teacher Dashboard | `app/screens/teacher/*` |
| Lesson Planning | `components/lessons/*` |
| Attendance | `hooks/useAttendance.ts` |
| Grading | `hooks/useGrading.ts` |
| Activities | `components/activities/*` |

**Current Sprint Tasks:**
- [ ] Activity builder improvements
- [ ] Bulk attendance marking
- [ ] AI-assisted lesson suggestions

**Key Files to Master:**
```
app/screens/teacher/dashboard.tsx     # Main teacher screen
app/screens/teacher/attendance.tsx    # Attendance tracking
components/lessons/LessonCard.tsx     # Lesson display
hooks/useAttendance.ts                # Attendance logic
```

**Review Pair:** Dev 4 (Principal)

---

### Dev 6: Parent Portal 👨‍👩‍👧

**Owner:** ___________________  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| Parent Dashboard | `app/screens/parent/*` |
| Child Management | `hooks/useChildren.ts` |
| Homework View | `components/homework/*` |
| POP Uploads | `hooks/pop/*` |
| Fee Tracking | `hooks/useParentPayments.ts` |

**Current Sprint Tasks:**
- [ ] Weekly AI-generated child reports
- [ ] Daily activity feed
- [ ] Push notification preferences

**Key Files to Master:**
```
app/screens/parent/dashboard.tsx      # Main parent screen
app/screens/parent/child-profile.tsx  # Child details
hooks/useParentPayments.ts            # Fee tracking
hooks/pop/paymentProcessing.ts        # POP approval logic
```

**Review Pair:** Dev 9 (Messaging) - parent-teacher chat

---

### Dev 7: Membership & Organizations 🏛️

**Owner:** ___________________  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| Membership Registration | `components/membership/registration/*` |
| SOA Dashboards | `app/screens/membership/*` |
| Wings/Regions | `hooks/useOrganization*.ts` |
| ID Cards | `components/membership/IDCard.tsx` |

**Current Sprint Tasks:**
- [ ] SOA Phase 2 regional rollout
- [ ] Member ID card generation
- [ ] Wing financial reporting

**Key Files to Master:**
```
app/screens/membership/ceo-dashboard.tsx       # CEO view
app/screens/membership/regional-dashboard.tsx  # Regional view
components/membership/registration/*           # Registration flow
hooks/useOrganizationMembers.ts               # Member queries
```

**Review Pair:** Dev 8 (Payments) - membership fees

---

### Dev 8: Payments & Subscriptions 💳

**Owner:** ___________________  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| PayFast Integration | `lib/payfast/*` |
| POP Processing | `hooks/pop/*` |
| Subscription Tiers | `lib/subscriptions.ts` |
| Edge Functions | `supabase/functions/payfast-webhook/*` |
| RevenueCat | `lib/revenuecat/*` |

**Current Sprint Tasks:**
- [ ] RevenueCat mobile subscription integration
- [ ] Self-service subscription management
- [ ] Payment failure retry logic

**Key Files to Master:**
```
lib/payfast/client.ts                          # PayFast API
hooks/pop/paymentProcessing.ts                 # POP approval
supabase/functions/payfast-webhook/index.ts    # Webhook handler
lib/subscriptions.ts                           # Tier definitions
```

**Review Pair:** Dev 7 (Membership) - membership payments

---

### Dev 9: Communications & Calls 📞

**Owner:** ___________________  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| Messaging | `components/messaging/*` |
| Video Calls | `components/calls/*` |
| Push Notifications | `lib/notifications/*` |
| WhatsApp | `services/whatsapp.ts` |
| Edge Functions | `supabase/functions/daily-*/*` |

**Current Sprint Tasks:**
- [ ] Group chat implementation
- [ ] Typing indicators
- [ ] Call quality improvements

**Key Files to Master:**
```
components/messaging/ChatInterface.tsx   # Main chat UI
components/calls/VideoCallInterface.tsx  # Video calls
components/calls/CallProvider.tsx        # Call state management
lib/notifications/NotificationService.ts # Push notifications
```

**Review Pair:** Dev 6 (Parent) - parent-teacher communication

---

### Dev 10: Web Application (Next.js) 🌐

**Owner:** ___________________  
**Slack/Discord:** @___________

| Responsibility | Files/Directories |
|----------------|-------------------|
| All Web Pages | `web/src/app/*` |
| Web Components | `web/src/components/*` |
| Web Hooks | `web/src/hooks/*` |
| Web Services | `web/src/services/*` |
| SSR/SSG | Next.js configuration |

**Current Sprint Tasks:**
- [ ] Dashboard feature parity with mobile
- [ ] PWA offline support
- [ ] Web exam prep features

**Key Files to Master:**
```
web/src/app/layout.tsx                  # Root layout
web/src/app/(dashboard)/page.tsx        # Main dashboard
web/src/lib/supabase/client.ts          # Supabase client (singleton!)
web/src/components/layout/Sidebar.tsx   # Navigation
```

**Review Pair:** Dev 1 (Auth) - web/mobile auth parity

---

## Developer Onboarding Checklist

### Day 1: Environment Setup

```bash
# Every developer must complete these steps

# 1. Clone repository
git clone git@github.com:DashSoil/NewDash.git
cd NewDash

# 2. Install dependencies
npm install
cd web && npm install && cd ..

# 3. Copy environment file (get values from Team Lead)
cp .env.example .env.local

# 4. Verify setup
npm run typecheck
npm run lint

# 5. Start development
npm start                 # Mobile (Expo)
cd web && npm run dev     # Web (Next.js)
```

### Day 1-2: Required Reading

| Document | Location | Priority |
|----------|----------|----------|
| Project Overview | `README.md` | ⭐⭐⭐ |
| Development Standards | `WARP.md` | ⭐⭐⭐ |
| Roadmap | `ROAD-MAP.md` | ⭐⭐ |
| Copilot Instructions | `.github/copilot-instructions.md` | ⭐⭐ |
| RBAC System | `lib/rbac/README.md` | ⭐⭐ |
| Database Schema | `scripts/README.md` | ⭐ |

### Day 2-3: Codebase Exploration

Each developer should:
1. Read ALL files in their assigned domain
2. Run the app and test their domain's features
3. Document any questions or unclear areas
4. Complete 2-3 small bug fixes to understand the workflow

### Day 3-5: First Task

- Pick a small task from domain backlog
- Create feature branch
- Submit first PR (expect heavy feedback - this is normal!)

---

## Git Workflow & Branch Strategy

### Branch Naming Convention

```
feature/<domain>/<short-description>
bugfix/<domain>/<issue-number>-<short-description>
hotfix/<description>
```

**Examples:**
```
feature/parent/weekly-ai-reports
feature/ai/voice-noise-cancellation
bugfix/payments/123-pop-amount-fix
hotfix/auth-session-crash
```

### Workflow

```
main (protected)
  │
  ├── develop (integration branch)
  │     │
  │     ├── feature/auth/phone-verification    (Dev 1)
  │     ├── feature/ai/tool-improvements       (Dev 2)
  │     ├── feature/parent/weekly-reports      (Dev 6)
  │     └── feature/web/dashboard-parity       (Dev 10)
  │
  └── hotfix/critical-bug (emergency fixes)
```

### Commit Message Format

```
<type>(<domain>): <short description>

<optional body>

<optional footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `style` - Formatting, no code change
- `test` - Adding tests
- `chore` - Build process, dependencies

**Examples:**
```
feat(parent): add weekly AI report generation

Implements the weekly child progress report feature using
Claude AI to summarize activities, achievements, and areas
for improvement.

Closes #234
```

```
fix(payments): correct POP approval amount_paid update

The updateFeeStatus function was not setting amount_paid
when approving POP uploads. This caused fees to appear
unpaid even after approval.

Fixes #456
```

### PR Requirements

Before submitting a PR:

```bash
# 1. Update from develop
git fetch origin
git rebase origin/develop

# 2. Run all checks
npm run typecheck          # Must pass
npm run lint               # Must pass
npm run test               # Must pass (if tests exist)
npm run check:console      # No console.log in prod code
npm run check:file-sizes   # Files under limits

# 3. Self-review diff
git diff origin/develop

# 4. Push and create PR
git push origin feature/your-branch
```

---

## Code Review Guidelines

### For Reviewers (You, the Lead)

#### Quick Review Checklist

```markdown
## Code Review Checklist

### Functionality
- [ ] Does the code do what the PR description says?
- [ ] Are edge cases handled?
- [ ] Does it work on both iOS and Android? (if mobile)

### Code Quality
- [ ] No `any` types (unless absolutely necessary with comment)
- [ ] No `console.log` statements (use logger)
- [ ] No hardcoded values (use constants/env vars)
- [ ] Functions are under 50 lines
- [ ] Files follow WARP.md size limits

### Security
- [ ] No secrets/keys in code
- [ ] User input is validated
- [ ] RLS policies respected (no service role bypass unless intentional)
- [ ] Permissions checked before actions

### Performance
- [ ] No unnecessary re-renders (memo, useCallback used correctly)
- [ ] Database queries are efficient (no N+1)
- [ ] Large lists use FlatList/virtualization

### Testing
- [ ] New functions have tests (if applicable)
- [ ] Existing tests still pass
```

#### Review Time Targets

| PR Size | Target Review Time |
|---------|-------------------|
| XS (< 50 lines) | Same day |
| S (50-200 lines) | 1 day |
| M (200-500 lines) | 2 days |
| L (500+ lines) | Split PR required |

### For Junior Developers

#### Self-Review Before Requesting Review

```markdown
Before requesting review, I confirm:

- [ ] I have read my own diff line-by-line
- [ ] I have tested on device/simulator
- [ ] I have run `npm run typecheck` and `npm run lint`
- [ ] I have updated relevant documentation
- [ ] PR description explains WHAT and WHY
- [ ] I have linked relevant issues
- [ ] I have assigned appropriate reviewers
```

---

## Daily/Weekly Rituals

### Daily Stand-up (15 min per pod)

**Pod A (Core):** 9:00 AM  
**Pod B (Features):** 9:30 AM  
**Pod C (Web):** 10:00 AM

**Format:**
1. What did you complete yesterday?
2. What are you working on today?
3. Any blockers?

### Weekly Full-Team Sync (Friday, 2:00 PM - 1 hour)

**Agenda:**
1. **Demo Time** (20 min) - Each pod shows one completed feature
2. **Blockers & Dependencies** (15 min) - Cross-team coordination
3. **Next Week Planning** (15 min) - Task assignment
4. **Knowledge Share** (10 min) - One dev teaches something they learned

### Bi-Weekly 1:1s (30 min each)

Meet with each developer individually:
- Career growth discussion
- Technical mentorship
- Feedback (both directions)
- Task clarity

---

## Feature Flags System

Use feature flags to merge incomplete features safely:

### Usage in Code

```typescript
// Import the feature flags
import { isFeatureEnabled } from '@/config/featureFlags';

// Check before rendering/executing
if (isFeatureEnabled('PARENT_WEEKLY_REPORTS')) {
  return <WeeklyReportCard />;
}

// Or use the hook
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function MyComponent() {
  const showNewFeature = useFeatureFlag('GROUP_CHAT');
  
  return showNewFeature ? <NewFeature /> : <OldFeature />;
}
```

### Available Flags

| Flag Name | Description | Owner | Status |
|-----------|-------------|-------|--------|
| `PARENT_WEEKLY_REPORTS` | AI-generated weekly reports | Dev 6 | 🟡 In Progress |
| `GROUP_CHAT` | Group messaging feature | Dev 9 | 🔴 Not Started |
| `VOICE_CHAT_V2` | Improved voice AI | Dev 3 | 🟡 In Progress |
| `REVENUECAT_PAYMENTS` | RevenueCat integration | Dev 8 | 🔴 Not Started |
| `SOA_PHASE_2` | SOA regional rollout | Dev 7 | 🟢 Ready |
| `WEB_DASHBOARD_V2` | New web dashboard | Dev 10 | 🟡 In Progress |

---

## Code Quality Standards

### File Size Limits (WARP.md)

| File Type | Max Lines | Action if Exceeded |
|-----------|-----------|-------------------|
| Components | 400 | Split into smaller components |
| Screens | 500 | Extract to hooks/sub-components |
| Services | 500 | Split by responsibility |
| Hooks | 200 | Split into multiple hooks |
| StyleSheet | 200 | Move to separate `.styles.ts` |

### TypeScript Strictness

```typescript
// ❌ BAD - Never use 'any'
const handleData = (data: any) => { ... }

// ✅ GOOD - Use proper types
interface UserData {
  id: string;
  name: string;
  email: string;
}
const handleData = (data: UserData) => { ... }

// ❌ BAD - Non-null assertion without reason
const name = user!.name;

// ✅ GOOD - Proper null checking
const name = user?.name ?? 'Unknown';
```

### Console Logging

```typescript
// ❌ BAD - No console.log in production
console.log('User data:', user);

// ✅ GOOD - Use the logger utility
import { logger } from '@/lib/logger';
logger.info('User data loaded', { userId: user.id });
```

### Error Handling

```typescript
// ❌ BAD - Silent failures
try {
  await doSomething();
} catch (e) {
  // nothing
}

// ✅ GOOD - Proper error handling
try {
  await doSomething();
} catch (error) {
  logger.error('Failed to do something', { error });
  Sentry.captureException(error);
  Alert.alert('Error', 'Something went wrong. Please try again.');
}
```

---

## Common Mistakes to Watch For

### 🚨 Critical Issues (Block PR)

| Issue | Example | Fix |
|-------|---------|-----|
| **Service role client-side** | `createClient(url, SERVICE_ROLE_KEY)` in component | Never expose service role; use Edge Functions |
| **Missing RLS check** | Direct DB query without `organization_id` filter | Always include tenant filter |
| **Secrets in code** | `const API_KEY = 'sk-xxx'` | Use environment variables |
| **Direct AI API call** | `fetch('https://api.anthropic.com/...')` in component | Use `ai-proxy` Edge Function |
| **Infinite loop** | `useEffect(() => { setX(x+1) }, [x])` | Add proper dependencies |

### ⚠️ Major Issues (Request Changes)

| Issue | Example | Fix |
|-------|---------|-----|
| **No error handling** | Unhandled promise rejection | Add try/catch with user feedback |
| **N+1 queries** | Loop with individual DB calls | Use batch query with `in()` |
| **Missing loading state** | Button with no feedback | Add loading spinner |
| **Hardcoded strings** | `title="Welcome"` | Use i18n: `t('welcome')` |
| **console.log** | `console.log('debug')` | Use logger utility |

### 💡 Minor Issues (Suggest Improvement)

| Issue | Example | Fix |
|-------|---------|-----|
| **Magic numbers** | `if (count > 50)` | `if (count > MAX_ITEMS)` |
| **Long functions** | 100+ line function | Extract helper functions |
| **Inconsistent naming** | `getUserData` vs `fetchUserInfo` | Standardize naming |
| **Missing comments** | Complex logic without explanation | Add JSDoc or inline comments |

---

## Performance Monitoring

### Key Metrics to Track

| Metric | Target | Tool |
|--------|--------|------|
| App Load Time | < 3s | PostHog |
| Screen Navigation | < 500ms | React Navigation metrics |
| API Response Time | < 1s | Supabase dashboard |
| Error Rate | < 1% | Sentry |
| AI Response Time | < 5s | Custom telemetry |

### How to Check Performance

```bash
# Check bundle size
npm run analyze

# Check for re-renders (development)
# Add to App.tsx temporarily:
# if (__DEV__) {
#   const whyDidYouRender = require('@welldone-software/why-did-you-render');
#   whyDidYouRender(React);
# }

# Profile on device
# Use React DevTools Profiler
```

---

## Escalation Path

### When to Escalate to Lead

| Situation | Action |
|-----------|--------|
| Blocked for > 4 hours | Ask in team chat first, then escalate |
| Security concern | Escalate immediately |
| Cross-domain dependency | Tag relevant domain owner + lead |
| Production bug | Escalate immediately |
| Unsure about architecture | Ask before implementing |

### Communication Channels

| Channel | Use For |
|---------|---------|
| Slack/Discord #general | Announcements, celebrations |
| Slack/Discord #dev-help | Technical questions |
| Slack/Discord #pr-reviews | PR notifications |
| Direct Message | Personal/sensitive matters |
| Standup | Daily blockers |
| Weekly Sync | Cross-team coordination |

---

## Quick Reference Commands

### Development

```bash
# Start mobile dev server
npm start

# Start with cache clear
npm run start:clear

# Start web dev server
cd web && npm run dev

# Run on Android
npm run android

# Run on iOS
npm run ios
```

### Code Quality

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Lint with auto-fix
npm run lint:fix

# Format code
npm run format

# Check for console.log
npm run check:console

# Check file sizes
npm run check:file-sizes

# Run tests
npm test
```

### Database

```bash
# Create migration
supabase migration new <name>

# Lint SQL
npm run lint:sql

# Push migration
supabase db push

# Check for drift
supabase db diff
```

### Deployment

```bash
# OTA update (Play Store)
npm run ota:playstore

# Build Android APK (local)
npm run build:android:apk

# Build Android AAB (cloud)
npm run build:android:aab

# Build iOS
npm run build:ios
```

### Git

```bash
# Create feature branch
git checkout -b feature/<domain>/<description>

# Update from develop
git fetch origin && git rebase origin/develop

# Push branch
git push origin feature/<domain>/<description>

# After PR merged, clean up
git checkout develop && git pull && git branch -d feature/<domain>/<description>
```

---

## Appendix: Domain Contact Matrix

| If you need help with... | Contact |
|--------------------------|---------|
| Login/Auth issues | Dev 1 |
| AI not responding | Dev 2 |
| Voice/Chat UI bugs | Dev 3 |
| School/Principal features | Dev 4 |
| Teacher features | Dev 5 |
| Parent features | Dev 6 |
| Membership/SOA | Dev 7 |
| Payments/Subscriptions | Dev 8 |
| Messaging/Calls | Dev 9 |
| Web application | Dev 10 |
| Architecture/Deployment | Lead (You) |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-06 | Lead | Initial version |

---

*This document should be reviewed and updated monthly or when team structure changes.*
