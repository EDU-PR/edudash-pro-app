# HOW-TO-101: EduDash Pro Complete Manual

> **Version**: 2.0.0 | **Last Updated**: December 31, 2025  
> **Comprehensive Operational Manual for EduDash Pro**

This manual has been expanded into three sections for better organization. Click the links below to navigate to the specific section you need.

---

## 📚 Manual Sections

### [Section A: Platform Overview & Features](HOW-TO-101-A.md)
Complete platform documentation including:
- Architecture & Technology Stack
- All 17 Dashboard Types (Super Admin to Learner)
- 50+ Feature Documentation
- Pricing Tiers & Feature Matrix
- Integration Points (AI, Payments, Video)

### [Section B: Dashboard Tutorials & Registration Flows](HOW-TO-101-B.md)
Step-by-step guides including:
- Role-by-Role Dashboard Tutorials (8 roles)
- Complete Registration Flow Walkthroughs
- Code File References for Debugging
- Troubleshooting Guides
- Database Table References

### [Section C: Team Structure & Hiring Guide](HOW-TO-101-C.md)
Operational and hiring documentation:
- Team Structure Recommendations
- Full Job Descriptions (9 roles with responsibilities)
- Hiring Priorities & Timeline
- Operational Guidelines
- Investor Information

---

## 🗺️ Related Documents

| Document | Purpose |
|----------|---------|
| [ROAD-MAP.md](../../ROAD-MAP.md) | Product roadmap with phases 1-5 |
| [WARP.md](../../WARP.md) | Development standards & rules |
| [README.md](../../README.md) | Quick start for developers |
| [copilot-instructions.md](../../.github/copilot-instructions.md) | AI assistant context |

---

## Quick Reference

### User Role Quick Links

| Role | Tutorial | Dashboard |
|------|----------|-----------|
| Super Admin | [Section B - Super Admin](HOW-TO-101-B.md#1-super-admin-dashboard-tutorial) | `app/(dashboard)/super-admin/` |
| Principal | [Section B - Principal](HOW-TO-101-B.md#2-principal-dashboard-tutorial) | `app/(dashboard)/principal/` |
| Teacher | [Section B - Teacher](HOW-TO-101-B.md#3-teacher-dashboard-tutorial) | `app/(dashboard)/teacher/` |
| Parent | [Section B - Parent](HOW-TO-101-B.md#4-parent-dashboard-tutorial) | `app/(dashboard)/parent/` |
| Learner | [Section B - Learner](HOW-TO-101-B.md#5-learner-dashboard-tutorial) | `app/(dashboard)/learner/` |

### Feature Quick Links

| Feature | Documentation |
|---------|---------------|
| All Features List | [Section A - Features](HOW-TO-101-A.md#5-complete-feature-list) |
| AI (Dash AI) | [Section A - AI Features](HOW-TO-101-A.md#ai-powered-dash-ai) |
| Payments | [Section A - Payments](HOW-TO-101-A.md#payment--subscription) |
| Registration Flows | [Section B - Registration](HOW-TO-101-B.md#part-2-registration-flows) |
| Pricing Tiers | [Section A - Pricing](HOW-TO-101-A.md#7-pricing-tiers--subscription-model) |

---

## Legacy Content (Archived Below)

The original content of this file has been preserved below for reference, but the expanded sections above contain more comprehensive and up-to-date information.

---

# Legacy HOW-TO-101 Content

> **Note**: This content has been expanded in Sections A, B, and C above.

## Table of Contents (Legacy)

1. [Platform Overview](#platform-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Authentication Flow](#authentication-flow)
4. [Organization Types](#organization-types)
5. [Key Features by Role](#key-features-by-role)
6. [Messaging System](#messaging-system)
7. [AI Integration (Dash AI)](#ai-integration-dash-ai)
8. [Payment System](#payment-system)
9. [Video Calls](#video-calls)
10. [Notifications](#notifications)
11. [Improvement Hints](#improvement-hints)

---

## Platform Overview

EduDash Pro is a **multi-tenant, mobile-first educational platform** supporting:

- **Educational Institutions**: Preschools, primary schools, secondary schools
- **Membership Organizations**: Soil of Africa (SOA), other NPOs
- **Skills Development**: Adult learning, vocational training

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
├──────────────────┬────────────────────┬─────────────────────┤
│   Mobile App     │    Web Portal      │   SOA Website       │
│   (Expo/RN)      │   (Next.js 14)     │   (Next.js)         │
└────────┬─────────┴────────┬───────────┴──────────┬──────────┘
         │                  │                       │
         └──────────────────┼───────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Supabase   │
                    ├─────────────┤
                    │ PostgreSQL  │ ← RLS Policies
                    │ Auth        │ ← Multi-tenant
                    │ Storage     │ ← Documents/Media
                    │ Edge Funcs  │ ← AI Proxy, Webhooks
                    │ Realtime    │ ← Live Updates
                    └─────────────┘
```

---

## User Roles & Permissions

### Role Hierarchy

| Role | Description | Scope |
|------|-------------|-------|
| `super_admin` | Platform owner, manages all schools | Global |
| `principal` | School admin, manages their preschool | Tenant |
| `teacher` | Classroom teacher, manages students | Tenant |
| `parent` | Parent/guardian of enrolled children | Tenant |
| `student` / `learner` | Enrolled student | Tenant |

### Membership Organization Roles (SOA)

| Role | Description |
|------|-------------|
| `ceo` / `president` | Organization president |
| `regional_manager` | Manages a province/region |
| `branch_manager` | Manages a local branch |
| `youth_president` | Youth wing leader |
| `member` | General member |

### Permission Check Example

```typescript
import { roleHasPermission } from '@/lib/rbac/types';

if (roleHasPermission(user.role, 'manage_courses')) {
  // Allow action
}
```

> **💡 Improvement**: Add granular permissions per feature (e.g., `ai.generate_lesson`, `messaging.create_group`)

---

## Authentication Flow

### Sign Up

1. User selects role (Teacher/Parent/Learner)
2. Email/password or Google OAuth
3. Profile created in `profiles` table
4. For schools: Associate with `preschool_id`
5. For SOA: Select region, pay registration fee

### Sign In

1. Supabase Auth validates credentials
2. Session token issued (JWT)
3. `routeAfterLogin()` determines dashboard:
   - Checks `profiles.role`
   - Checks `organization_members.member_type`
   - Routes to appropriate dashboard

### Sign Out

1. Clear navigation locks
2. Deactivate push tokens
3. Call `supabase.auth.signOut()`
4. Clear AsyncStorage/localStorage
5. Navigate to sign-in

> **💡 Improvement**: Add session timeout warnings, force logout on suspicious activity

---

## Organization Types

### 1. Educational (Preschools)

- **Table**: `preschools`
- **Features**: Classes, students, attendance, lessons, homework
- **Tenant ID**: `preschool_id`

### 2. Membership (SOA)

- **Table**: `organizations` + `organization_members`
- **Features**: Regions, member IDs, governance, finance
- **Tenant ID**: `organization_id`

### 3. Skills Development

- **Table**: `organizations` (type = 'skills_development')
- **Features**: Programs, cohorts, certifications, placements
- **Tenant ID**: `organization_id`

---

## Key Features by Role

### Super Admin

- **Dashboard**: `/screens/super-admin-dashboard`
- **AI Command Center**: Execute platform operations via AI
- **User Management**: Create/suspend users across all tenants
- **System Monitoring**: Health checks, error logs
- **WhatsApp Hub**: Manage automated messages

### Principal

- **Dashboard**: `/screens/principal-dashboard`
- **Teacher Management**: Hire, manage teachers
- **Student Enrollment**: Register new students
- **Financial Dashboard**: Fees, payments, reports
- **Campaigns**: Mass communication to parents

### Teacher

- **Dashboard**: `/screens/teacher-dashboard`
- **Lesson Planning**: Create lessons with AI assistance
- **Attendance**: Daily attendance tracking
- **Homework**: Assign and grade homework
- **Progress Reports**: Generate student reports

### Parent

- **Dashboard**: `/screens/parent-dashboard`
- **Child Progress**: View grades, attendance
- **Messaging**: Chat with teachers
- **Payments**: Pay school fees
- **Homework Help**: AI-assisted homework support

### President (SOA)

- **Dashboard**: `/screens/membership/ceo-dashboard`
- **Regional Overview**: All regions performance
- **Governance**: Board appointments, policies
- **Finance**: Revenue, expenses, reports
- **Analytics**: Membership growth, retention

---

## Messaging System

### Architecture

```
messages (table)
├── thread_id → message_threads
├── sender_id → auth.users
├── content (text)
├── attachments (JSON)
└── reply_to_id → messages

message_threads (table)
├── type: 'direct' | 'group' | 'channel'
├── name (for groups/channels)
└── metadata

message_participants (table)
├── thread_id
├── user_id
└── role: 'admin' | 'member'

message_reactions (table)
├── message_id
├── user_id
└── emoji
```

### Features

- **Direct Messages**: 1-on-1 conversations
- **Group Chats**: Multiple participants (user-created)
- **Channels**: Organization-wide broadcasts (admin-created)
- **Reactions**: Emoji reactions on messages
- **Replies**: Thread replies to messages
- **Attachments**: Images, documents

> **💡 Improvement**: 
> - Add read receipts
> - Add typing indicators via Realtime
> - Enable message search
> - Add message pinning

---

## AI Integration (Dash AI)

### Supported Languages

AI responses are **restricted to South African languages only**:
- English (`en`)
- Afrikaans (`af`)
- Zulu (`zu`)

Other languages will receive English responses.

### Architecture

```
Client (DashAIClient)
    ↓
Edge Function (ai-proxy)
    ↓
├── Quota Check (user_ai_tiers)
├── Language Validation
├── PII Scrubbing
└── API Call → Claude/OpenAI/Gemini
    ↓
Response → Client
```

### Key Capabilities

| Feature | Description |
|---------|-------------|
| Lesson Generation | AI creates lesson plans |
| Homework Help | Explains concepts to students |
| Grading Assistance | Auto-grades with feedback |
| Report Generation | Creates student reports |
| Voice Chat | STT + TTS conversational AI |

### TTS Languages

Text-to-Speech only works for supported languages:
- `en-ZA` → Leah (Azure Neural)
- `af-ZA` → Adri (Azure Neural)
- `zu-ZA` → Thando (Azure Neural)

> **💡 Improvement**:
> - Add more SA languages (Xhosa, Sotho, Tswana)
> - Implement streaming for faster responses
> - Add context memory for multi-turn conversations


---

## Payment System

### Current Integration: PayFast

- **Sandbox**: Enabled for testing
- **Webhooks**: `supabase/functions/payfast-webhook/`
- **Subscription Plans**: Free, Basic, Pro, Enterprise

### Flow

1. User selects subscription/product
2. `payments-create-checkout` creates PayFast session
3. User completes payment on PayFast
4. `payfast-webhook` receives ITN notification
5. Update `subscriptions` table
6. Grant features based on tier

### Revenue Tracking

```sql
-- Tables
subscriptions (user subscriptions)
payments (payment records)
invoices (generated invoices)
member_invoices (SOA-specific)
```

> **💡 Improvement**:
> - Connect RevenueCat for cross-platform purchases
> - Add Stripe as alternative gateway
> - Implement refund flow
> - Add promo codes

---

## Video Calls

### Provider: Daily.co

- **Token Generation**: `supabase/functions/daily-token/`
- **Room Management**: `supabase/functions/daily-rooms/`

### Features

- Voice calls (1-on-1)
- Video calls (1-on-1 and group)
- Screen sharing
- Picture-in-picture mode

### Components

- `VideoCallInterface.tsx` - Main video UI
- `WhatsAppStyleVideoCall.tsx` - Mobile-optimized
- `VoiceCallInterface.tsx` - Audio-only calls
- `CallProvider.tsx` - Call state management

> **💡 Improvement**:
> - Add call recording
> - Add virtual backgrounds
> - Add waiting room
> - Add breakout rooms for classes

---

## Notifications

### Push Notifications

- **Mobile**: Expo Notifications
- **Web**: Web Push API
- **Edge Function**: `send-push`, `push-queue-processor`

### Notification Types

| Type | Recipients |
|------|-----------|
| `new_message` | Direct/group participants |
| `homework_assigned` | Students + parents |
| `attendance_alert` | Parents |
| `payment_reminder` | Parents |
| `announcement` | Role-based targeting |

### Multi-Account Support

`NotificationRouter.ts` routes notifications to correct profile when user has multiple accounts.

> **💡 Improvement**:
> - Add notification preferences per type
> - Add quiet hours
> - Add digest mode (daily summary)
> - Add in-app notification center

---

## Improvement Hints

### High Priority

1. **Complete Translations**
   - `af.json`: 43% complete → needs 1200+ keys
   - `zu.json`: 19% complete → needs 1700+ keys
   - Impact: Seamless language switching

2. **Message Reactions UI**
   - Database ready, UI needs completion
   - Add emoji picker to message long-press menu

3. **Group Chat Creation**
   - Tables exist (`message_threads`, `message_participants`)
   - Need "New Group" button in messages screen
   - Need participant selector component

4. **Channel/Community Creation**
   - Admin-only feature for organization channels
   - Add to governance/admin screens

### Medium Priority

5. **Keyboard Handling**
   - Audit all input components for `KeyboardAvoidingView`
   - Ensure `android:windowSoftInputMode="adjustResize"`

6. **Twilio Phone Verification**
   - Add to registration flow
   - Create Edge Function for SMS OTP
   - Store verified phone in profiles

7. **RevenueCat Integration**
   - Connect for iOS/Android subscriptions
   - Sync with Supabase subscriptions table
   - Add restore purchases flow

### Revenue Optimization

8. **Ad Strategy (Free Tier)**
   - Implement interstitial ads between lessons
   - Banner ads on parent dashboard
   - No ads for paid tiers
   - Use AdMob for both platforms

9. **Freemium Limits**
   | Feature | Free | Basic | Pro |
   |---------|------|-------|-----|
   | AI Queries/day | 10 | 100 | Unlimited |
   | Storage | 100MB | 1GB | 10GB |
   | Video Call mins | 30 | 300 | Unlimited |
   | Classes | 1 | 5 | Unlimited |

10. **Upsell Triggers**
    - When free user hits limit
    - When features preview locked content
    - After successful lesson with AI

---

## Quick Reference

### Key Files

| Purpose | File |
|---------|------|
| Auth Flow | `lib/authActions.ts`, `lib/routeAfterLogin.ts` |
| RBAC | `lib/rbac/types.ts`, `lib/rbac/roles-permissions.json` |
| AI Client | `services/dash-ai/DashAIClient.ts` |
| Messaging | `hooks/useTeacherMessaging.ts`, `hooks/useParentMessaging.ts` |
| Payments | `supabase/functions/payments-create-checkout/` |
| Notifications | `lib/NotificationRouter.ts` |

### Environment Variables

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Payments
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=

# Video
DAILY_API_KEY=

# Push
EXPO_ACCESS_TOKEN=
```

---

## Support

For issues, check:
1. `docs/` folder for detailed guides
2. `WARP.md` for development standards
3. `ROAD-MAP.md` for planned features
