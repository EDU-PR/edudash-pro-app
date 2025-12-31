# HOW-TO-101 Section A: Platform Overview & Features

> **EduDash Pro Complete Manual** | **Section A of 3**  
> **Version**: 2.0.0 | **Last Updated**: December 31, 2025

This section covers the platform architecture, complete feature documentation, and subscription tiers.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [System Architecture](#2-system-architecture)
3. [Complete Feature Documentation](#3-complete-feature-documentation)
4. [Subscription Tiers & Pricing](#4-subscription-tiers--pricing)
5. [Technology Stack](#5-technology-stack)

---

## 1. Platform Overview

### What is EduDash Pro?

EduDash Pro is a **multi-tenant, mobile-first educational platform** built for the South African market, supporting:

| Organization Type | Description | Example Users |
|-------------------|-------------|---------------|
| **Educational Institutions** | Preschools, primary, secondary schools | Principals, Teachers, Parents, Students |
| **Membership Organizations** | NPOs, community groups (e.g., Soil of Africa) | Presidents, Regional Managers, Members |
| **Skills Development** | Adult learning, vocational training, TVET | Org Admins, Instructors, Learners |

### Core Value Propositions

1. **AI-Powered Learning**: Dash AI assists with lesson planning, homework help, grading, and voice interactions
2. **Multi-Tenant Architecture**: Each school/organization is isolated with row-level security
3. **Mobile-First Design**: React Native app with web portal for admin functions
4. **South African Focus**: PayFast payments, SA language support (EN, AF, ZU), local compliance
5. **Real-Time Communication**: Messaging, video calls, push notifications

### Platform Statistics (Demo Data)

```
┌─────────────────────────────────────────┐
│         EDUDASH PRO METRICS             │
├─────────────────────────────────────────┤
│  Organizations Supported    │    50+    │
│  User Roles                 │    17     │
│  Edge Functions             │    50+    │
│  Screens/Dashboards         │   100+    │
│  AI Capabilities            │    15+    │
│  Languages Supported        │     3     │
└─────────────────────────────────────────┘
```

---

## 2. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
├─────────────────────┬─────────────────────┬─────────────────────────┤
│     Mobile App      │     Web Portal      │     SOA Website         │
│   (Expo/React Native)│   (Next.js 14)     │    (Next.js)            │
│   iOS • Android     │   Admin Dashboards  │   Public Site           │
└──────────┬──────────┴──────────┬──────────┴────────────┬────────────┘
           │                     │                        │
           └─────────────────────┼────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │       SUPABASE          │
                    ├─────────────────────────┤
                    │  PostgreSQL + RLS       │ ← Multi-tenant isolation
                    │  Supabase Auth          │ ← JWT, OAuth, OTP
                    │  Supabase Storage       │ ← Documents, Media
                    │  Edge Functions (Deno)  │ ← AI Proxy, Webhooks
                    │  Realtime              │ ← Live updates
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼───────┐    ┌───────────▼──────────┐    ┌───────▼───────┐
│  AI Services  │    │   Payment Services   │    │  Video/Comms  │
├───────────────┤    ├──────────────────────┤    ├───────────────┤
│ Anthropic     │    │ PayFast (SA)         │    │ Daily.co      │
│ OpenAI        │    │ RevenueCat (planned) │    │ Azure Speech  │
│ Azure Speech  │    │                      │    │ Expo Notify   │
└───────────────┘    └──────────────────────┘    └───────────────┘
```

### Multi-Tenant Data Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TENANT ISOLATION MODEL                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │  Preschool  │         │Organization │         │   Skills    │   │
│  │   Tenant    │         │   Tenant    │         │   Tenant    │   │
│  │             │         │             │         │             │   │
│  │ preschool_id│         │org_id       │         │org_id       │   │
│  │             │         │type='member'│         │type='skills'│   │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘   │
│         │                       │                       │          │
│         ▼                       ▼                       ▼          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │   Classes   │         │   Regions   │         │  Programs   │   │
│  │  Students   │         │   Branches  │         │   Courses   │   │
│  │  Teachers   │         │   Members   │         │  Learners   │   │
│  │  Parents    │         │   Events    │         │Certificates │   │
│  └─────────────┘         └─────────────┘         └─────────────┘   │
│                                                                     │
│  RLS Policy: user.organization_id = row.organization_id            │
│              OR user.preschool_id = row.preschool_id               │
│              OR user.role = 'super_admin' (bypass)                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │───▶│ Sign In  │───▶│ Supabase │───▶│   JWT    │
│          │    │  Screen  │    │   Auth   │    │  Token   │
└──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                      │
                                                      ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│Dashboard │◀───│  Route   │◀───│  Fetch   │◀───│  Check   │
│  Screen  │    │  After   │    │ Profile  │    │   RBAC   │
│          │    │  Login   │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

Key Files:
- lib/authActions.ts       → Sign in/up/out logic
- lib/routeAfterLogin.ts   → Dashboard routing by role
- contexts/AuthContext.tsx → Auth state management
- hooks/useRouteGuard.ts   → Route protection
```

---

## 3. Complete Feature Documentation

### 3.1 AI Features (Dash AI)

Dash AI is the intelligent assistant powering EduDash Pro, built on Anthropic Claude with Azure Speech services.

#### Capabilities

| Capability | Description | Availability |
|------------|-------------|--------------|
| **Lesson Generation** | Create CAPS-aligned lesson plans | Teachers, Principals |
| **Homework Help** | Explain concepts, guide problem-solving | Students, Parents |
| **AI Grading** | Auto-grade with detailed feedback | Teachers |
| **Progress Reports** | Generate student progress narratives | Teachers |
| **Voice Chat** | Conversational AI with STT/TTS | All users |
| **Content Generation** | Create worksheets, activities | Teachers |
| **Exam Prep** | Generate practice questions | Students |
| **CV Analysis** | Parse and extract CV data | Org Admins |

#### Supported Languages

| Language | Code | TTS Voice | Status |
|----------|------|-----------|--------|
| English (SA) | `en-ZA` | Leah (Azure Neural) | ✅ Full |
| Afrikaans | `af-ZA` | Adri (Azure Neural) | ✅ Full |
| Zulu | `zu-ZA` | Thando (Azure Neural) | ✅ Full |
| Xhosa | `xh-ZA` | - | 🔄 Planned |
| Sotho | `st-ZA` | - | 🔄 Planned |

#### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Mobile    │────▶│  DashAI     │────▶│  ai-proxy   │
│   Client    │     │  Client     │     │Edge Function│
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┤
                    │                          │
               ┌────▼────┐              ┌──────▼──────┐
               │  Quota  │              │  Anthropic  │
               │  Check  │              │   Claude    │
               └────┬────┘              └──────┬──────┘
                    │                          │
               ┌────▼────┐              ┌──────▼──────┐
               │user_ai_ │              │  Response   │
               │ tiers   │              │  + Stream   │
               └─────────┘              └─────────────┘

Key Files:
- services/dash-ai/DashAIClient.ts    → Main AI client
- services/dash-ai/DashToolRegistry.ts → Tool definitions
- supabase/functions/ai-proxy/        → Edge function
- lib/ai/capabilities.ts              → Feature flags
```

#### Usage Quotas by Tier

| Tier | Daily Queries | Monthly Tokens | Voice Minutes |
|------|---------------|----------------|---------------|
| Free | 10 | 50,000 | 5 |
| Basic | 100 | 500,000 | 60 |
| Pro | Unlimited | 2,000,000 | 300 |
| Enterprise | Unlimited | Unlimited | Unlimited |

---

### 3.2 Messaging System

Real-time messaging between teachers, parents, and students.

#### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Direct Messages | 1-on-1 conversations | ✅ Complete |
| Group Chats | Multi-user conversations | ✅ Complete |
| Channels | Organization broadcasts | ✅ Complete |
| Voice Messages | Record and send audio | ✅ Complete |
| Attachments | Images, documents | ✅ Complete |
| Reactions | Emoji reactions | 🔄 UI Pending |
| Read Receipts | Seen indicators | 🔄 Planned |
| Typing Indicators | Real-time typing | 🔄 Planned |

#### Database Schema

```sql
-- Message threads (conversations)
message_threads
├── id (UUID)
├── type: 'direct' | 'group' | 'channel'
├── name (for groups/channels)
├── metadata (JSON)
└── created_at

-- Messages
messages
├── id (UUID)
├── thread_id → message_threads
├── sender_id → profiles
├── content (text)
├── attachments (JSON array)
├── reply_to_id → messages (for threads)
└── created_at

-- Participants
message_participants
├── thread_id → message_threads
├── user_id → profiles
├── role: 'admin' | 'member'
└── joined_at

-- Reactions (database ready)
message_reactions
├── message_id → messages
├── user_id → profiles
├── emoji
└── created_at
```

#### Key Files

| Purpose | File |
|---------|------|
| Teacher Messaging Hook | `hooks/useTeacherMessaging.ts` |
| Parent Messaging Hook | `hooks/useParentMessaging.ts` |
| Message Composer | `components/messaging/MessageComposer.tsx` |
| Voice Recording | `components/messaging/VoiceRecorder.tsx` |
| Typing Indicator | `components/messaging/TypingIndicator.tsx` |

---

### 3.3 Video & Voice Calls

WebRTC-based calling powered by Daily.co.

#### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Voice Calls | Audio-only calls | ✅ Complete |
| Video Calls | Full video conferencing | ✅ Complete |
| Screen Sharing | Share device screen | ✅ Complete |
| Picture-in-Picture | Floating video window | ✅ Complete |
| Background Mode | Continue call when backgrounded | ✅ Complete |
| Live Lessons | Teacher-led live sessions | ✅ Complete |
| Call Recording | Record calls | 🔄 Planned |
| Virtual Backgrounds | Background blur/replace | 🔄 Planned |
| Waiting Room | Hold participants before joining | 🔄 Planned |

#### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Caller    │────▶│   Daily.co  │◀────│   Callee    │
│             │     │   Server    │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   ▲                   │
       │                   │                   │
       ▼                   │                   ▼
┌─────────────┐     ┌──────┴──────┐     ┌─────────────┐
│  daily-token│     │ daily-rooms │     │  daily-token│
│Edge Function│     │Edge Function│     │Edge Function│
└─────────────┘     └─────────────┘     └─────────────┘

Key Files:
- components/calls/CallProvider.tsx       → Call state
- components/calls/VideoCallInterface.tsx → Video UI
- components/calls/VoiceCallInterface.tsx → Audio UI
- hooks/useDaily.ts                       → Daily.co hook
- supabase/functions/daily-token/         → Token generation
```

---

### 3.4 Payment System

PayFast integration for South African payments.

#### Subscription Plans

| Plan | Monthly Price | Annual Price | Target Users |
|------|---------------|--------------|--------------|
| **Free** | R0 | R0 | Individual teachers, trial users |
| **Basic** | R99 | R999 | Small preschools (<30 students) |
| **Pro** | R299 | R2,999 | Medium schools (30-100 students) |
| **Enterprise** | Custom | Custom | Large schools, districts |

#### Features by Plan

| Feature | Free | Basic | Pro | Enterprise |
|---------|------|-------|-----|------------|
| Students | 5 | 30 | 100 | Unlimited |
| Teachers | 1 | 3 | 10 | Unlimited |
| AI Queries/day | 10 | 100 | Unlimited | Unlimited |
| Storage | 100MB | 1GB | 10GB | 100GB |
| Video Minutes | 30/mo | 300/mo | Unlimited | Unlimited |
| Classes | 1 | 5 | Unlimited | Unlimited |
| Custom Branding | ❌ | ❌ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ❌ | ✅ |
| Ads | ✅ | ❌ | ❌ | ❌ |

#### Payment Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │───▶│ Select   │───▶│ PayFast  │───▶│ Webhook  │
│          │    │  Plan    │    │ Checkout │    │ Received │
└──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                      │
                                                      ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Access  │◀───│  Grant   │◀───│  Update  │◀───│ Validate │
│ Features │    │  Tier    │    │  Table   │    │   ITN    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

Key Files:
- supabase/functions/payments-create-checkout/ → Create session
- supabase/functions/payfast-webhook/          → ITN handler
- hooks/useSubscription.ts                     → Subscription state
- contexts/SubscriptionContext.tsx             → Plan context
```

---

### 3.5 Notifications

Multi-channel notification system.

#### Channels

| Channel | Platform | Provider | Status |
|---------|----------|----------|--------|
| Push (Mobile) | iOS/Android | Expo Notifications | ✅ Complete |
| Push (Web) | Browsers | Web Push API | ✅ Complete |
| In-App | All | Custom | ✅ Complete |
| Email | All | SendGrid | ✅ Complete |
| SMS | Mobile | Twilio | 🔄 Planned |

#### Notification Types

| Type | Description | Recipients |
|------|-------------|------------|
| `new_message` | New message received | Thread participants |
| `homework_assigned` | New homework posted | Students, Parents |
| `homework_due` | Homework deadline approaching | Students, Parents |
| `attendance_alert` | Absence recorded | Parents |
| `payment_reminder` | Payment due soon | Parents |
| `payment_received` | Payment confirmed | Parents, Principals |
| `announcement` | Organization announcement | Role-based |
| `update_available` | App update ready | All users |
| `call_incoming` | Incoming call | Call recipient |

#### Key Files

| Purpose | File |
|---------|------|
| Notification Service | `lib/NotificationService.ts` |
| Multi-Account Router | `lib/NotificationRouter.ts` |
| Context | `contexts/NotificationContext.tsx` |
| Push Queue | `supabase/functions/push-queue-processor/` |
| Send Push | `supabase/functions/send-push/` |

---

### 3.6 Attendance System

Daily attendance tracking for schools.

#### Features

- Daily check-in/check-out
- Absence recording with reasons
- Late arrival tracking
- Parent notifications for absences
- Attendance reports (daily, weekly, monthly)
- Export to CSV/PDF

#### Workflow

```
Teacher App                 Database                    Parent App
     │                          │                           │
     │  Mark Present/Absent     │                           │
     ├─────────────────────────▶│                           │
     │                          │                           │
     │                          │  If Absent, Notify        │
     │                          ├──────────────────────────▶│
     │                          │                           │
     │                          │                    View Alert
     │                          │                           │
```

---

### 3.7 Lesson Planning

AI-assisted lesson creation aligned with CAPS curriculum.

#### Features

| Feature | Description |
|---------|-------------|
| AI Generation | Generate full lesson plans from topic |
| CAPS Alignment | Automatic curriculum mapping |
| Resource Suggestions | Related materials and activities |
| Differentiation | Adapt for different learning levels |
| Templates | Save and reuse lesson structures |
| Sharing | Share lessons with other teachers |
| Library | Browse community-created lessons |

#### Lesson Structure

```json
{
  "title": "Introduction to Fractions",
  "grade": "Grade 4",
  "subject": "Mathematics",
  "duration": "45 minutes",
  "caps_outcomes": ["NS-4.1", "NS-4.2"],
  "objectives": [
    "Understand what a fraction represents",
    "Identify numerator and denominator"
  ],
  "materials": ["Fraction circles", "Worksheets"],
  "activities": [
    {
      "name": "Introduction",
      "duration": "5 min",
      "description": "Review whole numbers..."
    },
    {
      "name": "Main Activity",
      "duration": "25 min",
      "description": "Hands-on fraction exploration..."
    }
  ],
  "assessment": "Exit ticket with 5 fraction questions",
  "homework": "Workbook pages 34-35"
}
```

---

### 3.8 Homework System

Assignment creation, submission, and grading.

#### Workflow

```
┌────────────────────────────────────────────────────────────────┐
│                    HOMEWORK WORKFLOW                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Teacher                Student               AI/Teacher       │
│     │                      │                      │            │
│     │  Create Assignment   │                      │            │
│     ├─────────────────────▶│                      │            │
│     │                      │                      │            │
│     │                      │  Submit Work         │            │
│     │                      ├─────────────────────▶│            │
│     │                      │                      │            │
│     │                      │                 AI Grade          │
│     │                      │                      │            │
│     │                      │◀─────────────────────┤            │
│     │                      │  View Feedback       │            │
│     │                      │                      │            │
│     │  Review Grades       │                      │            │
│     │◀─────────────────────┤                      │            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Assignment Types

- Written responses
- Multiple choice quizzes
- File uploads (PDF, images)
- Audio/video submissions
- Interactive worksheets

---

### 3.9 Progress Reports

Generate comprehensive student progress reports.

#### Report Components

| Section | Description |
|---------|-------------|
| Student Info | Name, class, term, dates |
| Attendance Summary | Days present/absent/late |
| Academic Progress | Grades by subject |
| Skills Assessment | Development areas |
| Teacher Comments | Narrative feedback |
| Goals | Next term objectives |
| Signatures | Teacher, Principal, Parent |

#### Generation Options

- AI-assisted narrative generation
- Template-based reports
- Bulk generation for entire class
- PDF export with school branding
- Digital signature capture

---

### 3.10 Financial Management

Fee tracking and financial reporting for schools.

#### Features

| Feature | Description |
|---------|-------------|
| Fee Structures | Define fee schedules |
| Invoicing | Generate parent invoices |
| Payment Tracking | Record payments received |
| Outstanding Balances | View unpaid amounts |
| Payment Reminders | Automated notifications |
| Financial Reports | Income, expenses, summaries |
| Petty Cash | Small expense tracking |
| Export | CSV, PDF reports |

---

### 3.11 Membership Management (SOA)

Member registration and organization management for Soil of Africa.

#### Features

| Feature | Description |
|---------|-------------|
| Member Registration | Online signup with fees |
| Member ID Cards | Digital membership cards |
| Regional Hierarchy | Province → Region → Branch |
| Governance | Board, meetings, policies |
| Document Vault | Constitution, policies |
| Events | Event management |
| Finance | Dues, donations tracking |
| Youth Wing | Separate youth organization |

#### Member ID Card

```
┌─────────────────────────────────────────┐
│         SOIL OF AFRICA                  │
│         MEMBERSHIP CARD                 │
├─────────────────────────────────────────┤
│  ┌───────┐                              │
│  │ PHOTO │   Name: John Doe             │
│  │       │   ID: SOA-2024-001234        │
│  └───────┘   Region: Gauteng            │
│              Branch: Johannesburg       │
│              Joined: Jan 2024           │
│              Status: Active             │
│                                         │
│  [QR CODE]              Valid: Dec 2025 │
└─────────────────────────────────────────┘
```

---

### 3.12 Skills Development

Program management for adult learning and vocational training.

#### Features

| Feature | Description |
|---------|-------------|
| Program Creation | Define courses and curricula |
| Cohort Management | Group learners by intake |
| Enrollment | Self-service or admin enrollment |
| Course Player | Video lessons with progress |
| Assignments | Submissions with deadlines |
| Assessments | Quizzes and practical tests |
| Certificates | Digital credentials |
| CV Builder | AI-assisted CV creation |
| Placements | Job placement tracking |

---

## 4. Subscription Tiers & Pricing

### Educational Institutions

| Feature | Free | Basic (R99/mo) | Pro (R299/mo) | Enterprise |
|---------|------|----------------|---------------|------------|
| **Students** | 5 | 30 | 100 | Unlimited |
| **Teachers** | 1 | 3 | 10 | Unlimited |
| **Classes** | 1 | 5 | Unlimited | Unlimited |
| **AI Queries** | 10/day | 100/day | Unlimited | Unlimited |
| **Storage** | 100MB | 1GB | 10GB | 100GB |
| **Video Minutes** | 30/mo | 300/mo | Unlimited | Unlimited |
| **Attendance** | ✅ | ✅ | ✅ | ✅ |
| **Messaging** | ✅ | ✅ | ✅ | ✅ |
| **Lesson Plans** | 5/mo | 50/mo | Unlimited | Unlimited |
| **Progress Reports** | Basic | Standard | Custom | Custom |
| **Financial Module** | ❌ | Basic | Full | Full |
| **Custom Branding** | ❌ | ❌ | ✅ | ✅ |
| **API Access** | ❌ | ❌ | ❌ | ✅ |
| **Priority Support** | ❌ | Email | Email+Chat | Dedicated |
| **Ads** | ✅ | ❌ | ❌ | ❌ |

### Membership Organizations

| Feature | Free | Standard (R149/mo) | Premium (R399/mo) |
|---------|------|---------------------|-------------------|
| **Members** | 50 | 500 | Unlimited |
| **Regions/Branches** | 1 | 5 | Unlimited |
| **Admin Users** | 1 | 5 | Unlimited |
| **Events** | 2/mo | 10/mo | Unlimited |
| **Storage** | 500MB | 5GB | 50GB |
| **Member Cards** | Digital | Digital | Digital + Print |
| **Custom Branding** | ❌ | ✅ | ✅ |
| **Finance Module** | Basic | Full | Full |
| **Governance** | ❌ | ✅ | ✅ |
| **API Access** | ❌ | ❌ | ✅ |

### Skills Development

| Feature | Starter (R199/mo) | Growth (R499/mo) | Scale (R999/mo) |
|---------|-------------------|------------------|-----------------|
| **Learners** | 50 | 200 | 1000 |
| **Programs** | 3 | 10 | Unlimited |
| **Instructors** | 2 | 5 | Unlimited |
| **Video Hours** | 10 | 50 | Unlimited |
| **Storage** | 5GB | 25GB | 100GB |
| **Certificates** | ✅ | ✅ | ✅ |
| **CV Builder** | ❌ | ✅ | ✅ |
| **Placements** | ❌ | ✅ | ✅ |
| **Custom Branding** | ❌ | ✅ | ✅ |
| **API Access** | ❌ | ❌ | ✅ |

---

## 5. Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| React Native | Mobile framework | 0.76+ |
| Expo | Development platform | SDK 54 |
| expo-router | File-based routing | v4 |
| TypeScript | Type safety | 5.x |
| TailwindCSS (NativeWind) | Mobile styling | 4.x |
| Next.js | Web application | 14 |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| Supabase | Backend-as-a-Service | Latest |
| PostgreSQL | Database | 15+ |
| Deno | Edge Functions runtime | Latest |
| Row Level Security | Multi-tenant isolation | - |

### AI & Speech

| Technology | Purpose |
|------------|---------|
| Anthropic Claude | Primary AI model |
| OpenAI GPT-4 | Secondary AI |
| Azure Speech Services | TTS/STT |
| Picovoice | Wake word detection |

### Integrations

| Service | Purpose |
|---------|---------|
| PayFast | SA Payments |
| Daily.co | Video calls |
| Expo Notifications | Push notifications |
| Firebase | FCM (Android) |
| Sentry | Error tracking |
| PostHog | Analytics |

### Development Tools

| Tool | Purpose |
|------|---------|
| EAS Build | Cloud builds |
| EAS Update | OTA updates |
| ESLint | Code linting |
| Prettier | Code formatting |
| Jest | Testing |

---

## Quick Reference

### Key Configuration Files

| File | Purpose |
|------|---------|
| `app.json` | Expo configuration |
| `app.config.js` | Dynamic Expo config |
| `eas.json` | EAS Build profiles |
| `package.json` | Dependencies |
| `tsconfig.json` | TypeScript config |
| `.env` | Environment variables |

### Environment Variables

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=REDACTED

# AI Services
ANTHROPIC_API_KEY=REDACTED
OPENAI_API_KEY=REDACTED
AZURE_SPEECH_KEY=REDACTED
AZURE_SPEECH_REGION=southafricanorth

# Payments
PAYFAST_MERCHANT_ID=your-id
PAYFAST_MERCHANT_KEY=REDACTED
PAYFAST_PASSPHRASE=REDACTED

# Video
DAILY_API_KEY=your-key

# Push Notifications
EXPO_ACCESS_TOKEN=REDACTED

# EAS
EAS_PROJECT_ID=playstore  # or your project alias
```

---

## Next Sections

- **[Section B: Dashboard Tutorials & Registration Flows](HOW-TO-101-B.md)**
- **[Section C: Team Structure & Hiring Guide](HOW-TO-101-C.md)**
- **[ROAD-MAP.md](../../ROAD-MAP.md)** - Product Roadmap
