# EduDash Pro Product Roadmap

> **Version**: 2.0.2 | **Last Updated**: January 1, 2026  
> **Current App Version**: 1.0.11 | **Runtime**: 1.0.11

This document outlines the product roadmap for EduDash Pro, including completed features, in-progress work, and planned enhancements.

---

## Table of Contents

1. [Current Status](#current-status)
2. [Phase 1: Core Enhancements (Q1 2026)](#phase-1-core-enhancements-q1-2026)
3. [Phase 2: Communication & Verification (Q1-Q2 2026)](#phase-2-communication--verification-q1-q2-2026)
4. [Phase 3: Advanced Platform Features (Q2-Q3 2026)](#phase-3-advanced-platform-features-q2-q3-2026)
5. [Phase 4: STEM & Robotics (Q3 2026)](#phase-4-stem--robotics-q3-2026)
6. [Phase 5: Enterprise & Scale (Q4 2026)](#phase-5-enterprise--scale-q4-2026)
7. [Technical Debt & Infrastructure](#technical-debt--infrastructure)
8. [Database Migrations Required](#database-migrations-required)

---

## Current Status

### ✅ Completed Features

#### Platform Core
- [x] Multi-tenant architecture with RLS
- [x] Role-based access control (RBAC)
- [x] Authentication (Email, Google OAuth, OTP)
- [x] Session management with refresh tokens (24-hour expiry configured)
- [x] Multi-account support (switch profiles)

#### Educational Features
- [x] Preschool management (classes, students)
- [x] Attendance tracking
- [x] Lesson planning with AI
- [x] Homework assignment and grading
- [x] Progress reports generation
- [x] CAPS curriculum alignment

#### Membership Organizations (SOA)
- [x] Member registration with ID cards
- [x] Regional/branch hierarchy
- [x] Governance screens (board, meetings, policies)
- [x] Youth Wing management
- [x] Document management
- [x] Finance tracking
- [x] CEO/President Dashboard with real Supabase data
- [x] Regional Managers screen with live data
- [x] Organization statistics hook (`useOrganizationStats`)

#### Skills Development
- [x] Program creation and management
- [x] Learner enrollment
- [x] Course player with video
- [x] CV Builder tool
- [x] Bulk CV import
- [x] Certification system

#### AI Integration (Dash AI)
- [x] Lesson generation
- [x] Homework help
- [x] AI grading with feedback
- [x] Voice chat (STT + TTS)
- [x] Conversation memory
- [x] South African language support (EN, AF, ZU)
- [x] Keyboard-aware UI (auto-scroll on keyboard show)

#### Communication
- [x] Direct messaging
- [x] Push notifications (Expo + FCM)
- [x] WhatsApp integration (outbound)
- [x] Email notifications
- [x] Video/voice calls (Daily.co)

#### Payments
- [x] PayFast integration
- [x] Subscription management
- [x] Invoice generation
- [x] Registration fee processing

---

## Phase 1: Core Enhancements (Q1 2026)

### 1.1 Learner Dashboard Improvements
**Priority**: High | **Status**: In Progress

| Feature | Description | Status |
|---------|-------------|--------|
| Active Enrollments Carousel | Visual program cards | 🔄 In Progress |
| Progress Cards | Per-program completion tracking | 🔄 In Progress |
| Assignments Widget | Upcoming deadlines display | ⏳ Planned |
| Certificates Display | Earned credentials showcase | ⏳ Planned |
| Activity Feed | Recent actions timeline | ⏳ Planned |

**Files**: `app/screens/learner-dashboard.tsx`, `components/learner/`

### 1.2 Group Chat & Channels
**Priority**: High | **Status**: Database Ready

| Feature | Description | Status |
|---------|-------------|--------|
| Create Group Chat | Select participants, set name | ⏳ Planned |
| Group Admin Controls | Add/remove members, mute | ⏳ Planned |
| Organization Channels | Broadcast to role groups | ⏳ Planned |
| Message Reactions UI | Emoji picker on long-press | ⏳ Planned |
| Read Receipts | Seen indicators | ⏳ Planned |
| Typing Indicators | Real-time typing display | ⏳ Planned |

**Database**: `message_threads`, `message_participants` tables exist

### 1.3 Translation Completion
**Priority**: High | **Status**: In Progress

| Language | Current | Target |
|----------|---------|--------|
| English (en) | 100% | 100% |
| Afrikaans (af) | 43% | 100% |
| Zulu (zu) | 19% | 100% |
| Xhosa (xh) | 0% | 80% |
| Sotho (st) | 0% | 80% |

**Files**: `locales/*.json`

### 1.4 Organization Join Requests 🆕
**Priority**: High | **Status**: Planned

Allow users to discover and request to join existing organizations/schools on the platform.

| Feature | Description |
|---------|-------------|
| Organization Directory | Browse public schools/orgs |
| Search & Filter | By location, type, name |
| Join Request Form | Submit request with details |
| Admin Approval Flow | Principal/admin reviews requests |
| Auto-Enrollment | Upon approval, add to org |
| Notification System | Alerts for request status |

**Database Changes**:
```sql
CREATE TABLE join_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  organization_id UUID REFERENCES organizations(id),
  preschool_id UUID REFERENCES preschools(id),
  request_type TEXT, -- 'student', 'parent', 'teacher', 'member'
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  message TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Screens Needed**:
- `app/screens/discover-organizations.tsx`
- `app/screens/join-request.tsx`
- `app/screens/principal-join-requests.tsx`

---

## Phase 1.5: State-of-the-Art Parent Features (Q1 2026)

### 1.5.1 Weekly AI-Generated Learning Reports 🆕
**Priority**: High | **Status**: Planned

Personalized weekly insights delivered to parents about their child's learning journey.

| Feature | Description |
|---------|-------------|
| AI Report Generation | Claude generates personalized weekly summaries |
| Progress Highlights | Key achievements and milestones reached |
| Areas of Focus | Subjects/skills needing attention |
| Teacher Notes Integration | Include teacher observations |
| Comparative Analytics | Progress vs curriculum expectations |
| Actionable Tips | Home activities to support learning |
| Multi-Language Support | Reports in parent's preferred language |
| Delivery Options | Push notification + in-app + email digest |

**Implementation**:
```typescript
// Edge Function: generate-weekly-report
interface WeeklyLearningReport {
  studentId: string;
  weekNumber: number;
  highlights: string[];        // "Mastered counting to 20"
  focusAreas: string[];        // "Letter recognition needs practice"
  attendanceSummary: {
    daysPresent: number;
    daysAbsent: number;
  };
  homeworkCompletion: number;  // Percentage
  teacherNotes: string[];
  homeActivities: string[];    // AI-suggested activities
  moodSummary?: string;        // If mood tracking enabled
}
```

**Database Changes**:
```sql
CREATE TABLE weekly_learning_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id),
  preschool_id UUID NOT NULL REFERENCES preschools(id),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  report_data JSONB NOT NULL,
  ai_model TEXT DEFAULT 'claude-3-5-sonnet',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  sent_via JSONB DEFAULT '[]'::jsonb, -- ['push', 'email', 'in_app']
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, week_start)
);

CREATE INDEX idx_weekly_reports_parent ON weekly_learning_reports(parent_id);
CREATE INDEX idx_weekly_reports_student_week ON weekly_learning_reports(student_id, week_start);
```

**Screens Needed**:
- `app/screens/parent-weekly-report.tsx`
- `components/reports/WeeklyReportCard.tsx`
- `components/reports/WeeklyReportDetail.tsx`

### 1.5.2 Daily Activity Feed 🆕
**Priority**: High | **Status**: Planned

Real-time updates from the classroom throughout the day.

| Feature | Description |
|---------|-------------|
| Live Activity Stream | Timestamped updates from teachers |
| Photo/Video Moments | Media shared by teachers (with consent) |
| Activity Categories | Learning, Play, Meals, Rest, Special Events |
| Reactions | Parents can react with emoji 💝 |
| Comments | Optional parent comments (moderated) |
| Notification Preferences | Choose which activities to be notified about |
| Daily Summary | End-of-day digest of all activities |
| Privacy Controls | Per-child visibility settings |

**Implementation**:
```typescript
interface DailyActivity {
  id: string;
  studentId: string;
  teacherId: string;
  activityType: 'learning' | 'play' | 'meal' | 'rest' | 'special' | 'milestone';
  title: string;
  description?: string;
  mediaUrls?: string[];
  timestamp: Date;
  visibility: 'parent_only' | 'class_parents' | 'all_parents';
  reactions: { parentId: string; emoji: string }[];
  comments: { parentId: string; text: string; createdAt: Date }[];
}
```

**Database Changes**:
```sql
CREATE TABLE daily_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  preschool_id UUID NOT NULL REFERENCES preschools(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('learning', 'play', 'meal', 'rest', 'special', 'milestone')),
  title TEXT NOT NULL,
  description TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  visibility TEXT DEFAULT 'parent_only' CHECK (visibility IN ('parent_only', 'class_parents', 'all_parents')),
  activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_activity_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES daily_activities(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(activity_id, parent_id)
);

CREATE TABLE daily_activity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES daily_activities(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id),
  comment_text TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_daily_activities_student ON daily_activities(student_id, activity_at DESC);
CREATE INDEX idx_daily_activities_class ON daily_activities(class_id, activity_at DESC);
CREATE INDEX idx_daily_activities_preschool ON daily_activities(preschool_id, activity_at DESC);
```

**Screens Needed**:
- `app/screens/parent-activity-feed.tsx`
- `components/activities/ActivityCard.tsx`
- `components/activities/ActivityMediaViewer.tsx`
- `components/activities/DailySummaryCard.tsx`
- `app/screens/teacher-post-activity.tsx`

**Teacher Interface**:
- Quick-post buttons for common activities
- Batch photo upload with auto-tagging
- Template messages for routine activities
- Voice-to-text for quick descriptions

---

## Phase 2: Communication & Verification (Q1-Q2 2026)

### 2.1 Phone Number Verification System 🆕
**Priority**: Critical | **Status**: Planned

Required for WhatsApp group migration and enhanced security.

| Feature | Description |
|---------|-------------|
| Phone Input | International format with country picker |
| Twilio OTP | SMS verification code |
| Verification Flow | Enter code, verify, store |
| Profile Update | Store verified phone in profiles |
| Re-verification | Periodic re-verify for security |

**Implementation**:
```
Edge Function: verify-phone
├── POST /send-otp → Twilio SMS
├── POST /verify-otp → Validate code
└── Store verified_phone in profiles
```

**Database Changes**:
```sql
ALTER TABLE profiles ADD COLUMN phone_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN phone_verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN phone_country_code TEXT;
```

### 2.2 WhatsApp Group Migration 🆕
**Priority**: High | **Status**: Planned (Requires 2.1)

Migrate existing WhatsApp groups into EduDash Pro messaging.

| Feature | Description |
|---------|-------------|
| Import WhatsApp Contacts | Via phone numbers |
| Match to Platform Users | Link by verified phone |
| Create Platform Group | Mirror WhatsApp group |
| Invite Non-Users | Send signup invites |
| Message History | Optional import (manual) |
| Gradual Migration | Keep both active initially |

**Flow**:
1. User exports WhatsApp group participant list
2. Upload CSV with phone numbers
3. System matches verified phones to users
4. Creates EduDash Pro group with matched users
5. Sends invite links to unmatched numbers
6. Admin can send announcement to migrate

**Screens Needed**:
- `app/screens/import-whatsapp-group.tsx`
- `app/screens/group-migration-status.tsx`

### 2.3 Enhanced Notification System
**Priority**: Medium | **Status**: Planned

| Feature | Description |
|---------|-------------|
| Notification Preferences | Per-type opt-in/out |
| Quiet Hours | Schedule no-disturb times |
| Digest Mode | Daily/weekly summary emails |
| In-App Notification Center | View all notifications |
| Notification Categories | Group by type |

---

## Phase 3: Advanced Platform Features (Q2-Q3 2026)

### 3.1 Interactive Whiteboard 🆕
**Priority**: Medium | **Status**: Planned

Digital whiteboard for lessons on tablets/stylus-enabled devices.

| Feature | Description |
|---------|-------------|
| Canvas Drawing | Freehand drawing tools |
| Shape Tools | Lines, circles, rectangles |
| Text Tool | Add text annotations |
| Image Import | Add images to canvas |
| Layers | Multiple drawing layers |
| Collaboration | Real-time sync (Realtime) |
| Save/Export | PNG, PDF export |
| Templates | Pre-made lesson templates |

**Supported Devices**:
- iPads with Apple Pencil
- Android tablets with stylus
- Touch-screen laptops
- Mouse/trackpad (basic support)

**Components Needed**:
- `components/whiteboard/Canvas.tsx`
- `components/whiteboard/Toolbar.tsx`
- `components/whiteboard/ColorPicker.tsx`
- `components/whiteboard/ShapeTools.tsx`

**Libraries**:
- `react-native-canvas` or custom implementation
- `react-native-svg` for vector graphics
- Supabase Realtime for collaboration

### 3.2 Staged Module Locking 🆕
**Priority**: High | **Status**: Planned

Lock course content behind progression or payment gates.

| Feature | Description |
|---------|-------------|
| Module Prerequisites | Complete Module 1 before 2 |
| Assessment Gates | Pass quiz to unlock next |
| Time-Based Unlock | Drip content over time |
| Payment Unlock | Upgrade tier to access |
| Preview Mode | Show locked content preview |
| Unlock Notifications | Alert when content unlocks |

**Implementation**:
```sql
CREATE TABLE module_locks (
  id UUID PRIMARY KEY,
  module_id UUID REFERENCES course_modules(id),
  lock_type TEXT, -- 'prerequisite', 'assessment', 'time', 'payment'
  prerequisite_module_id UUID,
  required_score DECIMAL,
  unlock_date TIMESTAMPTZ,
  required_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_module_progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  module_id UUID REFERENCES course_modules(id),
  is_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score DECIMAL
);
```

**Upgrade Triggers**:
- Show upgrade modal when hitting locked content
- Display "Upgrade to Pro to unlock" with pricing
- Track conversion from upsell prompts

### 3.3 RevenueCat Integration
**Priority**: High | **Status**: Planned

Cross-platform subscription management.

| Feature | Description |
|---------|-------------|
| iOS Subscriptions | App Store Connect |
| Android Subscriptions | Google Play Billing |
| Sync with PayFast | Unified subscription state |
| Restore Purchases | Cross-device restore |
| Subscription Analytics | Churn, LTV, MRR tracking |

---

## Phase 4: STEM & Robotics (Q3 2026)

### 4.1 Dash AI as Robotics Expert 🆕
**Priority**: High | **Status**: Planned

Transform Dash AI into a specialized robotics and STEM tutor.

| Feature | Description |
|---------|-------------|
| Robotics Curriculum | Age-appropriate content |
| Code Explanation | Explain programming concepts |
| Circuit Diagrams | Generate and explain circuits |
| Project Ideas | Suggest STEM projects |
| Troubleshooting | Debug robot/code issues |
| Safety Guidelines | Electrical/mechanical safety |

**Capabilities**:
```typescript
// New AI capabilities for robotics
const ROBOTICS_CAPABILITIES = {
  'robotics.lesson_generation': true,
  'robotics.code_explanation': true,
  'robotics.circuit_design': true,
  'robotics.project_guidance': true,
  'robotics.troubleshooting': true,
  'robotics.competition_prep': true,
};
```

**Curriculum Topics**:
- Basic Electronics (LEDs, resistors, circuits)
- Microcontrollers (Arduino, Raspberry Pi)
- Programming (Scratch, Python, C++)
- Mechanical Design (gears, motors, structures)
- Sensors (ultrasonic, IR, temperature)
- Robot Types (line followers, obstacle avoiders, arms)

### 4.2 Robotics Challenge System 🆕
**Priority**: Medium | **Status**: Planned

Interactive challenges for hands-on learning.

| Feature | Description |
|---------|-------------|
| Challenge Library | Curated robotics challenges |
| Difficulty Levels | Beginner to Advanced |
| Submission System | Upload videos/photos of builds |
| AI Validation | Verify challenge completion |
| Leaderboard | School/regional rankings |
| Certificates | Digital badges for completion |

**Edge Function**: `validate-robotics-challenge` (already exists, needs expansion)

### 4.3 Virtual Robotics Simulator
**Priority**: Low | **Status**: Future

| Feature | Description |
|---------|-------------|
| 2D Simulator | Basic robot movement |
| Code Editor | Write and test code |
| Virtual Sensors | Simulated sensor input |
| Challenge Environments | Pre-built scenarios |

---

## Phase 5: Enterprise & Scale (Q4 2026)

### 5.1 Multi-School Districts
**Priority**: Medium | **Status**: Planned

| Feature | Description |
|---------|-------------|
| District Management | Group multiple schools |
| District Admin Role | Oversee all schools |
| Cross-School Reports | Aggregated analytics |
| Shared Resources | District-wide lesson library |
| Unified Billing | Single invoice for district |

### 5.2 API & Integrations
**Priority**: Medium | **Status**: Planned

| Feature | Description |
|---------|-------------|
| Public API | RESTful API for integrations |
| Webhooks | Event-driven notifications |
| SSO | SAML/OAuth for enterprises |
| LMS Integration | Connect to existing LMS |
| SIS Integration | Student Information Systems |

### 5.3 Advanced Analytics
**Priority**: Medium | **Status**: Planned

| Feature | Description |
|---------|-------------|
| Predictive Analytics | At-risk student detection |
| Learning Outcomes | Measure educational impact |
| Engagement Metrics | Usage patterns analysis |
| Custom Reports | Build custom dashboards |
| Export to BI Tools | Power BI, Tableau connectors |

### 5.4 White-Label Solution
**Priority**: Low | **Status**: Future

| Feature | Description |
|---------|-------------|
| Custom Branding | Full brand customization |
| Custom Domain | school.example.com |
| Isolated Instance | Dedicated infrastructure |
| Custom Features | Tenant-specific development |

---

## Technical Debt & Infrastructure

### High Priority

| Item | Description | Effort |
|------|-------------|--------|
| TypeScript Strict Mode | Enable strict null checks | Medium |
| Test Coverage | Increase to 80%+ | High |
| Performance Audit | Optimize slow screens | Medium |
| Memory Leaks | Fix identified leaks | Low |
| Bundle Size | Reduce app size | Medium |

### Medium Priority

| Item | Description | Effort |
|------|-------------|--------|
| Offline Support | Full offline capability | High |
| Error Boundaries | Comprehensive error handling | Low |
| Analytics Pipeline | Unified event tracking | Medium |
| Documentation | API and code docs | Medium |

### Infrastructure

| Item | Description | Status |
|------|-------------|--------|
| CDN for Assets | Faster media delivery | ⏳ Planned |
| Database Replicas | Read replicas for scale | ⏳ Planned |
| Edge Caching | Cache frequent queries | ⏳ Planned |
| Auto-Scaling | Handle traffic spikes | ⏳ Planned |

---

## Database Migrations Required

### Migration: Phase 1 Features
```sql
-- Join requests for organizations
CREATE TABLE join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('student', 'parent', 'teacher', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  message TEXT,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT join_request_target CHECK (
    (organization_id IS NOT NULL AND preschool_id IS NULL) OR
    (organization_id IS NULL AND preschool_id IS NOT NULL)
  )
);

-- Index for quick lookups
CREATE INDEX idx_join_requests_user ON join_requests(user_id);
CREATE INDEX idx_join_requests_org ON join_requests(organization_id);
CREATE INDEX idx_join_requests_school ON join_requests(preschool_id);
CREATE INDEX idx_join_requests_status ON join_requests(status);
```

### Migration: Phone Verification
```sql
-- Phone verification fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_country_code TEXT;

-- OTP storage (temporary)
CREATE TABLE phone_verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-cleanup expired OTPs
CREATE INDEX idx_otp_expires ON phone_verification_otps(expires_at);
```

### Migration: WhatsApp Group Migration
```sql
-- WhatsApp group import tracking
CREATE TABLE whatsapp_group_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID NOT NULL REFERENCES profiles(id),
  group_name TEXT NOT NULL,
  original_participants JSONB NOT NULL, -- Array of phone numbers
  matched_users JSONB DEFAULT '[]'::jsonb,
  unmatched_phones JSONB DEFAULT '[]'::jsonb,
  message_thread_id UUID REFERENCES message_threads(id),
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

### Migration: Module Locking
```sql
-- Module lock configurations
CREATE TABLE module_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL CHECK (lock_type IN ('prerequisite', 'assessment', 'time', 'payment')),
  prerequisite_module_id UUID REFERENCES course_modules(id),
  required_score DECIMAL CHECK (required_score >= 0 AND required_score <= 100),
  unlock_date TIMESTAMPTZ,
  required_tier TEXT CHECK (required_tier IN ('basic', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User module progress tracking
CREATE TABLE user_module_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  is_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  unlocked_by TEXT, -- 'prerequisite', 'payment', 'admin', 'time'
  completed_at TIMESTAMPTZ,
  score DECIMAL,
  time_spent_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Index for progress queries
CREATE INDEX idx_module_progress_user ON user_module_progress(user_id);
CREATE INDEX idx_module_progress_module ON user_module_progress(module_id);
```

### Migration: Whiteboard
```sql
-- Whiteboard sessions
CREATE TABLE whiteboard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  lesson_id UUID REFERENCES lessons(id),
  class_id UUID,
  title TEXT,
  canvas_data JSONB DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  is_collaborative BOOLEAN DEFAULT false,
  participants JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Whiteboard templates
CREATE TABLE whiteboard_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  canvas_data JSONB NOT NULL,
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | Dec 31, 2025 | Consolidated roadmap, added new features |
| 1.0.0 | Dec 2025 | Initial roadmap |

---

## Contributing

To propose new features or changes to this roadmap:

1. Create a GitHub issue with `[ROADMAP]` prefix
2. Include: Feature description, use case, priority suggestion
3. Tag relevant team members for review
4. Discuss in weekly product meeting

---

## References

- [HOW-TO-101.md](docs/features/HOW-TO-101.md) - Complete platform guide
- [WARP.md](WARP.md) - Development standards
- [IMPLEMENTATION_ROADMAP.md](docs/OBSOLETE/IMPLEMENTATION_ROADMAP.md) - Legacy roadmap (archived)
