# HOW-TO-101 Section B: Dashboard Tutorials & Registration Flows

> **EduDash Pro Complete Manual** | **Section B of 3**  
> **Version**: 2.0.0 | **Last Updated**: December 31, 2025

This section covers step-by-step tutorials for all dashboards, registration flows, and debugging guides.

**Workshop manual convention:** All role tutorials use the same behavior: **Test instructions (UI)** give numbered steps with which screen to open and which button to tap (no code or unit-test summaries). **App visuals** reference screenshots from the current native mobile app — see [Workshop Screenshots](../workshop-screenshots/README.md) for how to capture and add them.

---

## Table of Contents

1. [User Roles Overview](#1-user-roles-overview)
2. [Dashboard Tutorials by Role](#2-dashboard-tutorials-by-role)
3. [Registration Flows](#3-registration-flows)
4. [Debugging Guide](#4-debugging-guide)
5. [Common Issues & Solutions](#5-common-issues--solutions)

---

## 1. User Roles Overview

### Role Hierarchy

```
                    ┌─────────────────┐
                    │   SUPER ADMIN   │  ← Platform Owner
                    │    (Global)     │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌────────▼────────┐   ┌──────▼──────┐
│   PRINCIPAL   │   │    PRESIDENT    │   │  ORG ADMIN  │
│  (Preschool)  │   │  (Membership)   │   │  (Skills)   │
└───────┬───────┘   └────────┬────────┘   └──────┬──────┘
        │                    │                    │
        │           ┌────────┼────────┐          │
        │           │        │        │          │
┌───────▼───────┐ ┌─▼─┐  ┌───▼───┐ ┌──▼──┐ ┌────▼────┐
│    TEACHER    │ │REG│  │BRANCH │ │YOUTH│ │INSTRUCTOR│
│               │ │MGR│  │ MGR   │ │PRES │ │          │
└───────┬───────┘ └───┘  └───────┘ └─────┘ └────┬────┘
        │                                        │
┌───────▼───────┐                        ┌──────▼──────┐
│    PARENT     │                        │   LEARNER   │
└───────┬───────┘                        └─────────────┘
        │
┌───────▼───────┐
│    STUDENT    │
└───────────────┘
```

### Role Permissions Matrix

| Permission       | Super Admin | Principal | Teacher |  Parent   | Student |
| ---------------- | :---------: | :-------: | :-----: | :-------: | :-----: |
| View All Schools |      ✅      |     ❌     |    ❌    |     ❌     |    ❌    |
| Manage Teachers  |      ✅      |     ✅     |    ❌    |     ❌     |    ❌    |
| Manage Students  |      ✅      |     ✅     |    ✅    |     ❌     |    ❌    |
| Create Lessons   |      ✅      |     ✅     |    ✅    |     ❌     |    ❌    |
| Mark Attendance  |      ✅      |     ✅     |    ✅    |     ❌     |    ❌    |
| View Own Child   |      ❌      |     ❌     |    ❌    |     ✅     |    ❌    |
| Submit Homework  |      ❌      |     ❌     |    ❌    |     ❌     |    ✅    |
| Use AI Chat      |      ✅      |     ✅     |    ✅    |     ✅     |    ✅    |
| Financial Access |      ✅      |     ✅     |    ❌    | View Only |    ❌    |

---

## 2. Dashboard Tutorials by Role

### 2.1 Super Admin Dashboard

**Screen**: `app/screens/super-admin-dashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  SUPER ADMIN DASHBOARD                              [Settings]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Total Users │  │   Schools   │  │   Revenue   │             │
│  │   12,458    │  │     127     │  │  R1.2M/mo   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  Quick Actions:                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │    AI      │ │   Users    │ │   Schools  │ │  System    │   │
│  │  Command   │ │ Management │ │ Management │ │  Health    │   │
│  │  Center    │ │            │ │            │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Subscrip-  │ │ Feature    │ │  WhatsApp  │ │ Analytics  │   │
│  │   tions    │ │   Flags    │ │    Hub     │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Actions

| Action               | How To                       | Screen                              |
| -------------------- | ---------------------------- | ----------------------------------- |
| View all users       | Tap "Users Management"       | `super-admin-users.tsx`             |
| Create new school    | Tap "Schools" → "Add School" | `school-onboarding-wizard.tsx`      |
| Check system health  | Tap "System Health"          | `super-admin-system-monitoring.tsx` |
| Execute AI commands  | Tap "AI Command Center"      | `super-admin-ai-command-center.tsx` |
| Manage subscriptions | Tap "Subscriptions"          | `super-admin-subscriptions.tsx`     |
| Toggle features      | Tap "Feature Flags"          | `super-admin-feature-flags.tsx`     |

#### Available Screens

| Screen            | Path                                | Purpose                |
| ----------------- | ----------------------------------- | ---------------------- |
| Main Dashboard    | `super-admin-dashboard.tsx`         | Overview metrics       |
| AI Command Center | `super-admin-ai-command-center.tsx` | Execute AI operations  |
| AI Quotas         | `super-admin-ai-quotas.tsx`         | Manage AI limits       |
| Users             | `super-admin-users.tsx`             | User management        |
| Organizations     | `super-admin-organizations.tsx`     | Org management         |
| Subscriptions     | `super-admin-subscriptions.tsx`     | Plan management        |
| System Monitoring | `super-admin-system-monitoring.tsx` | Health checks          |
| Feature Flags     | `super-admin-feature-flags.tsx`     | Feature toggles        |
| Announcements     | `super-admin-announcements.tsx`     | Platform-wide messages |
| Analytics         | `super-admin-analytics.tsx`         | Usage analytics        |
| DevOps            | `super-admin-devops.tsx`            | Deployment tools       |
| Leads             | `super-admin-leads.tsx`             | Sales leads            |
| Moderation        | `super-admin-moderation.tsx`        | Content moderation     |
| WhatsApp Hub      | `super-admin-whatsapp.tsx`          | WhatsApp management    |
| Settings          | `super-admin-settings.tsx`          | Platform settings      |

---

### 2.2 Principal Dashboard

**Screen**: `app/screens/principal-dashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  [School Logo]  Sunshine Preschool           [Notifications] ⚙️ │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Today's Overview                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Students │  │ Teachers │  │Attendance│  │ Revenue  │        │
│  │    85    │  │    12    │  │   92%    │  │ R45,000  │        │
│  │ enrolled │  │ active   │  │ today    │  │ this mo  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  Quick Actions                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Teachers  │ │  Students  │ │  Parents   │ │  Classes   │   │
│  │            │ │            │ │            │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Finance   │ │  Reports   │ │ Campaigns  │ │  Settings  │   │
│  │            │ │            │ │            │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  Recent Activity                                                │
│  • New parent registered: Jane Doe (2 min ago)                 │
│  • Attendance submitted: Class A (10 min ago)                  │
│  • Payment received: R1,500 from Smith Family (1 hr ago)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Actions

| Action               | How To                      | Screen                             |
| -------------------- | --------------------------- | ---------------------------------- |
| Add teacher          | Teachers → "Invite Teacher" | `teacher-management.tsx`           |
| Enroll student       | Students → "Add Student"    | `student-enrollment.tsx`           |
| Generate parent code | Parents → "Generate Code"   | `principal-parent-invite-code.tsx` |
| View finances        | Tap "Finance"               | `financial-dashboard.tsx`          |
| Send announcement    | Tap "Campaigns"             | `campaigns.tsx`                    |
| View reports         | Tap "Reports"               | `principal-report-review.tsx`      |

#### Navigation Flow

```
Principal Dashboard
├── Teachers
│   ├── View All Teachers
│   ├── Invite New Teacher
│   └── Teacher Details
├── Students
│   ├── View All Students
│   ├── Enroll Student
│   ├── Student Details
│   └── Class Assignment
├── Parents
│   ├── View Parents
│   ├── Generate Invite Code
│   └── Parent Requests
├── Classes
│   ├── Class List
│   ├── Create Class
│   └── Assign Teachers
├── Finance
│   ├── Dashboard
│   ├── Invoices
│   ├── Payments
│   └── Reports
├── Attendance
│   └── School-wide View
├── Reports
│   ├── Progress Reports
│   └── Analytics
└── Settings
    ├── School Profile
    ├── Branding
    └── Notifications
```

#### Test instructions (UI)

1. Sign in as a principal and land on the principal dashboard.
2. Open the **Learning** section (expand if collapsed).
3. Tap **AI Daily Routine** to open the Daily Program Planner.
4. To add a teacher: tap **Teachers** in Quick Actions, then **Invite Teacher**.
5. To generate a parent code: tap **Parents**, then **Generate Code**.

#### App visuals (native mobile)

| Step / screen | Screenshot |
|---------------|------------|
| Dashboard overview | ![Principal dashboard](../workshop-screenshots/principal-dashboard-overview.png) |
| Learning section with AI Daily Routine | ![Principal Learning](../workshop-screenshots/principal-dashboard-learning-section.png) |

*(Add the PNG files to `docs/workshop-screenshots/` as per the [screenshots README](../workshop-screenshots/README.md).)*

---

### 2.3 Teacher Dashboard

**Screen**: `app/screens/teacher-dashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  Good Morning, Ms. Sarah! 👋                   [Chat] [Profile] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  My Classes Today                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Class A (Grade R) • 8:00 AM - 12:00 PM • 24 students   │   │
│  │ [Take Attendance] [Start Lesson] [View Students]        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Quick Actions                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Attendance │ │  Lessons   │ │  Homework  │ │  Messages  │   │
│  │            │ │            │ │            │ │     3      │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Reports   │ │  Dash AI   │ │ Live Class │ │  Calendar  │   │
│  │            │ │     🤖     │ │            │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  Pending Tasks                                                  │
│  ⚠️ 5 homework submissions to grade                            │
│  ⚠️ 2 progress reports due this week                           │
│  ✅ Attendance marked for today                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Actions

| Action           | How To                             | Screen                        |
| ---------------- | ---------------------------------- | ----------------------------- |
| Take attendance  | Tap class → "Take Attendance"      | `attendance.tsx`              |
| Create lesson    | Tap "Lessons" → "Create New"       | `create-lesson.tsx`           |
| AI lesson help   | Tap "Dash AI" → describe lesson    | `dash-ai-chat.tsx`            |
| Assign homework  | Tap "Homework" → "Assign New"      | `assign-homework.tsx`         |
| Grade homework   | Tap "Homework" → select submission | `ai-homework-grader-live.tsx` |
| Message parent   | Tap "Messages" → select parent     | `teacher-messages.tsx`        |
| Create report    | Tap "Reports" → "New Report"       | `progress-report-creator.tsx` |
| Start live class | Tap "Live Class"                   | `start-live-lesson.tsx`       |

#### Daily Workflow

```
Morning:
1. Check dashboard for today's classes
2. Review any messages from parents
3. Take attendance when class starts

During Class:
4. Follow lesson plan (or create with AI)
5. Record any incidents or notes

End of Day:
6. Assign homework if needed
7. Respond to parent messages
8. Update any progress notes
```

#### Test instructions (UI)

1. Sign in as a teacher and land on the teacher dashboard.
2. Tap **Daily Program** or **Open Planner** to open today’s routine (or the daily program planner).
3. To take attendance: tap the class card, then **Take Attendance**.
4. To start a tutor session: tap **Start Tutor Session** (or **Dash AI** then describe the need).
5. To assign homework: tap **Homework** (or equivalent) → **Assign New**.

#### App visuals (native mobile)

| Step / screen | Screenshot |
|---------------|------------|
| Teacher dashboard overview | ![Teacher dashboard](../workshop-screenshots/teacher-dashboard-overview.png) |
| Daily Program / Planner entry | ![Teacher Daily Program](../workshop-screenshots/teacher-daily-program-open.png) |

*(Add PNGs to `docs/workshop-screenshots/` per the [screenshots README](../workshop-screenshots/README.md).)*

---

### 2.4 Parent Dashboard

**Screen**: `app/screens/parent-dashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  Welcome back, Mrs. Johnson! 👋                       [Profile] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  My Children                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 👦 Tommy Johnson                                        │   │
│  │    Class A (Grade R) • Teacher: Ms. Sarah               │   │
│  │    ✅ Present today • 📚 1 homework due                 │   │
│  │    [View Progress] [Messages] [Homework]                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Quick Actions                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Attendance │ │  Homework  │ │  Messages  │ │  Payments  │   │
│  │   History  │ │    Help    │ │     2      │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Progress  │ │  Dash AI   │ │   School   │ │  Settings  │   │
│  │  Reports   │ │    Help    │ │    Info    │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  Recent Updates                                                 │
│  📝 New homework: "Letter Recognition" (due Tomorrow)          │
│  ✅ Attendance: Tommy was present today                        │
│  💬 New message from Ms. Sarah (1 hour ago)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Actions

| Action            | How To                           | Screen                          |
| ----------------- | -------------------------------- | ------------------------------- |
| View attendance   | Tap "Attendance History"         | `parent-attendance.tsx`         |
| Get homework help | Tap "Homework Help" or "Dash AI" | `ai-homework-helper.tsx`        |
| Message teacher   | Tap "Messages" → select teacher  | `parent-messages.tsx`           |
| Make payment      | Tap "Payments"                   | `manage-subscription.tsx`       |
| View reports      | Tap "Progress Reports"           | View PDF reports                |
| Add child         | Profile → "Add Another Child"    | `parent-child-registration.tsx` |

#### Test instructions (UI)

1. Sign in as a parent and land on the parent dashboard.
2. Tap **School Announcements** (megaphone icon) to open the list — shared daily routines and menus appear here.
3. To view a child’s homework: tap **My Child's Homework** (or **Homework** in quick actions).
4. To message the teacher: tap **Message Teacher** or **Messages**.
5. To pay fees: tap **Fees & Payments** or **Payments**.

#### App visuals (native mobile)

| Step / screen | Screenshot |
|---------------|------------|
| Parent dashboard overview | ![Parent dashboard](../workshop-screenshots/parent-dashboard-overview.png) |
| School Announcements list (routines appear here) | ![Parent Announcements](../workshop-screenshots/parent-announcements-list.png) |

*(Add PNGs to `docs/workshop-screenshots/` per the [screenshots README](../workshop-screenshots/README.md).)*

---

### 2.5 Student/Learner Dashboard

**Screen**: `app/screens/learner-dashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  Hi Tommy! 🎒 Ready to learn?                          [Avatar] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Today's Tasks                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📚 Homework: Letter Recognition                         │   │
│  │    Due: Tomorrow • Status: Not Started                  │   │
│  │    [Start] [Get Help from Dash]                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Quick Actions                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Homework  │ │  Lessons   │ │  Dash AI   │ │   Grades   │   │
│  │            │ │            │ │    🤖      │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  My Progress 🌟                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ████████████░░░░░░░  60% Complete This Week            │   │
│  │  🏆 3 assignments completed • 2 remaining               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Fun Activities                                                 │
│  [Worksheet] [Exam Prep] [Explore Lessons]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Actions (Age-Appropriate)

| Action              | How To                       | Screen                   |
| ------------------- | ---------------------------- | ------------------------ |
| Do homework         | Tap "Homework" → select task | `homework.tsx`           |
| Get help            | Tap "Dash AI" → ask question | `ai-homework-helper.tsx` |
| View lessons        | Tap "Lessons"                | `lessons-hub.tsx`        |
| Check grades        | Tap "Grades"                 | `grades.tsx`             |
| Practice worksheets | Tap "Worksheet"              | `worksheet-viewer.tsx`   |

---

### 2.6 President Dashboard (SOA/Membership)

**Screen**: `app/screens/membership/ceo-dashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  Welcome to Soil Of Africa                             [Menu]   │
│  SOIL OF AFRICA                               ● 87% Health      │
│  Executive Overview                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    2,847     │  │   R 2548K    │  │    94.5%     │          │
│  │Total Members │  │Annual Revenue│  │Retention Rate│          │
│  │   ↗ +12.5%   │  │   ↗ +18.3%   │  │   ↗ +2.3%    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  Executive Actions                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Broadcast  │ │  Document  │ │  Regional  │ │ Strategic  │   │
│  │            │ │   Vault    │ │  Managers  │ │    Plan    │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Financial  │ │ Governance │ │ Analytics  │ │Performance │   │
│  │  Reports   │ │            │ │            │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ════════════════════════════════════════════════════════════  │
│  [Home] [Regions] [Finance] [Members] [Settings]               │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Actions

| Action            | How To                  | Screen                             |
| ----------------- | ----------------------- | ---------------------------------- |
| Send broadcast    | Tap "Broadcast"         | `membership/broadcast.tsx`         |
| View documents    | Tap "Document Vault"    | `membership/documents.tsx`         |
| Manage regions    | Tap "Regional Managers" | `membership/regional-managers.tsx` |
| View governance   | Tap "Governance"        | `membership/governance.tsx`        |
| Financial reports | Tap "Financial Reports" | `membership/finance.tsx`           |
| View analytics    | Tap "Analytics"         | `membership/analytics.tsx`         |

---

### 2.7 Org Admin Dashboard (Skills Development)

**Screen**: `app/screens/org-admin-dashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  Skills Academy Admin                              [Notifications]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Overview                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    450       │  │      8       │  │     85%      │          │
│  │   Learners   │  │   Programs   │  │  Completion  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  Quick Actions                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Programs  │ │  Learners  │ │Instructors │ │  Cohorts   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ CV Import  │ │Placements  │ │   Certs    │ │ Analytics  │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Actions

| Action            | How To                        | Screen                            |
| ----------------- | ----------------------------- | --------------------------------- |
| Create program    | Tap "Programs" → "Create New" | `org-admin/create-program.tsx`    |
| Import CVs        | Tap "CV Import"               | `org-admin/bulk-cv-import.tsx`    |
| Enroll learner    | Tap "Learners" → "Enroll"     | `org-admin/manual-enrollment.tsx` |
| Issue certificate | Tap "Certs" → select learner  | `org-admin/certifications.tsx`    |
| Track placements  | Tap "Placements"              | `org-admin/placements.tsx`        |

---

## 3. Registration Flows

### 3.1 Preschool Registration Flow

#### Step-by-Step Guide

```
┌────────────────────────────────────────────────────────────────┐
│                 PRESCHOOL REGISTRATION FLOW                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Step 1: Download App                                          │
│  └── Download EduDash Pro from Play Store/App Store            │
│                                                                │
│  Step 2: Sign Up as Principal                                  │
│  └── Select "I'm a Principal/School Admin"                     │
│  └── Enter email and password                                  │
│  └── Verify email                                              │
│                                                                │
│  Step 3: School Setup Wizard                                   │
│  └── School name and type                                      │
│  └── Address and contact info                                  │
│  └── Upload logo (optional)                                    │
│  └── Select subscription plan                                  │
│                                                                │
│  Step 4: Payment (if paid plan)                                │
│  └── Redirected to PayFast                                     │
│  └── Complete payment                                          │
│  └── Return to app                                             │
│                                                                │
│  Step 5: Create First Class                                    │
│  └── Class name (e.g., "Grade R - Lions")                      │
│  └── Grade level                                               │
│  └── Capacity                                                  │
│                                                                │
│  Step 6: Invite Teachers                                       │
│  └── Enter teacher emails                                      │
│  └── Teachers receive invite link                              │
│                                                                │
│  Step 7: Generate Parent Codes                                 │
│  └── Create unique join codes                                  │
│  └── Share with parents                                        │
│                                                                │
│  ✅ School is ready to use!                                    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Key Files for Debugging

| Step           | File                                           | Purpose                |
| -------------- | ---------------------------------------------- | ---------------------- |
| Sign Up        | `app/screens/principal-signup.tsx`             | Principal registration |
| School Setup   | `app/screens/school-registration.tsx`          | School creation        |
| Subscription   | `app/screens/subscription-setup.tsx`           | Plan selection         |
| Payment        | `supabase/functions/payments-create-checkout/` | PayFast checkout       |
| Webhook        | `supabase/functions/payfast-webhook/`          | Payment confirmation   |
| First Class    | `app/screens/class-details.tsx`                | Class creation         |
| Teacher Invite | `app/screens/teacher-management.tsx`           | Send invites           |
| Parent Code    | `app/screens/principal-parent-invite-code.tsx` | Generate codes         |

---

### 3.2 Teacher Registration Flow

```
┌────────────────────────────────────────────────────────────────┐
│                   TEACHER REGISTRATION FLOW                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Option A: Invited by Principal                                │
│  └── Receive email with invite link                            │
│  └── Click link → opens app                                    │
│  └── Create account (email pre-filled)                         │
│  └── Complete profile (name, phone, qualifications)            │
│  └── Automatically linked to school                            │
│  └── ✅ Ready to use                                           │
│                                                                │
│  Option B: Self-Registration (with school code)                │
│  └── Download app                                              │
│  └── Select "I'm a Teacher"                                    │
│  └── Create account                                            │
│  └── Enter school code (from principal)                        │
│  └── Request sent to principal for approval                    │
│  └── Principal approves                                        │
│  └── ✅ Linked to school                                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Key Files

| Step             | File                                         |
| ---------------- | -------------------------------------------- |
| Invite Accept    | `app/screens/teacher-invite-accept.tsx`      |
| Self Register    | `app/screens/teacher-registration.tsx`       |
| Profile Complete | `app/screens/teacher-profile-completion.tsx` |
| Approval Queue   | `app/screens/principal-registrations.tsx`    |

---

### 3.3 Parent Registration Flow

```
┌────────────────────────────────────────────────────────────────┐
│                   PARENT REGISTRATION FLOW                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Step 1: Get Code from School                                  │
│  └── Principal provides unique school code                     │
│  └── Example: "SUNSHINE-2024" or QR code                       │
│                                                                │
│  Step 2: Download & Sign Up                                    │
│  └── Download EduDash Pro                                      │
│  └── Select "I'm a Parent"                                     │
│  └── Create account (email + password)                         │
│                                                                │
│  Step 3: Join School                                           │
│  └── Enter school code OR scan QR                              │
│  └── School details displayed for confirmation                 │
│                                                                │
│  Step 4: Register Child                                        │
│  └── Child's name and date of birth                            │
│  └── Select class (if known)                                   │
│  └── Upload photo (optional)                                   │
│                                                                │
│  Step 5: Approval (if required)                                │
│  └── School may require approval                               │
│  └── Notification when approved                                │
│                                                                │
│  ✅ Can now view child's dashboard                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Key Files

| Step               | File                                        |
| ------------------ | ------------------------------------------- |
| Parent Signup      | `app/screens/parent-registration.tsx`       |
| Join by Code       | `app/screens/parent-join-by-code.tsx`       |
| Child Registration | `app/screens/parent-child-registration.tsx` |
| Link Existing      | `app/screens/parent-link-child.tsx`         |
| Claim Child        | `app/screens/parent-claim-child.tsx`        |

---

### 3.4 Membership Organization Registration (SOA)

```
┌────────────────────────────────────────────────────────────────┐
│               MEMBERSHIP REGISTRATION FLOW (SOA)               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Step 1: Visit Registration                                    │
│  └── Open app or soa-web.vercel.app                            │
│  └── Tap "Join Soil of Africa"                                 │
│                                                                │
│  Step 2: Personal Information                                  │
│  └── Full name, ID number                                      │
│  └── Email and phone                                           │
│  └── Date of birth                                             │
│  └── Physical address                                          │
│                                                                │
│  Step 3: Select Region                                         │
│  └── Province → Region → Branch                                │
│  └── Nearest branch auto-suggested                             │
│                                                                │
│  Step 4: Pay Registration Fee                                  │
│  └── R150 registration fee                                     │
│  └── PayFast checkout                                          │
│  └── Payment confirmed                                         │
│                                                                │
│  Step 5: Member ID Generated                                   │
│  └── Unique ID: SOA-2024-XXXXXX                                │
│  └── Digital member card available                             │
│  └── Welcome email sent                                        │
│                                                                │
│  ✅ Full access to member dashboard                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Key Files

| Step              | File                                            |
| ----------------- | ----------------------------------------------- |
| Join Screen       | `app/screens/membership/join.tsx`               |
| Registration Form | `app/screens/membership/register.tsx`           |
| Region Selection  | Component in register screen                    |
| Payment           | `supabase/functions/payments-registration-fee/` |
| Member Card       | `app/screens/membership/id-card.tsx`            |

---

### 3.5 Skills Development Learner Registration

```
┌────────────────────────────────────────────────────────────────┐
│            SKILLS DEVELOPMENT LEARNER REGISTRATION             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Option A: Self-Enrollment                                     │
│  └── Browse available programs                                 │
│  └── Select program                                            │
│  └── Create account                                            │
│  └── Complete profile                                          │
│  └── Pay enrollment fee (if applicable)                        │
│  └── ✅ Enrolled in program                                    │
│                                                                │
│  Option B: Organization Enrolls Learner                        │
│  └── Org admin imports learner data (CSV/manual)               │
│  └── Learner receives invite email                             │
│  └── Learner creates account                                   │
│  └── Auto-enrolled in assigned programs                        │
│  └── ✅ Ready to start learning                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Key Files

| Step                 | File                                          |
| -------------------- | --------------------------------------------- |
| Learner Registration | `app/screens/learner-registration.tsx`        |
| Program Browse       | `app/screens/learner/programs.tsx`            |
| Manual Enrollment    | `app/screens/org-admin/manual-enrollment.tsx` |
| Bulk Import          | `app/screens/org-admin/bulk-cv-import.tsx`    |

---

## 4. Debugging Guide

### 4.1 Authentication Issues

#### Problem: User can't sign in

**Check these files:**

| File                       | What to Check                                               |
| -------------------------- | ----------------------------------------------------------- |
| `lib/authActions.ts`       | Sign in logic                                               |
| `lib/supabase.ts`          | Supabase client config                                      |
| `contexts/AuthContext.tsx` | Auth state                                                  |
| `.env`                     | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

**Debug Steps:**
```typescript
// Add to sign-in function
console.log('[Auth] Attempting sign in with:', email);
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
console.log('[Auth] Result:', { data, error });
```

**Common Causes:**
- Invalid Supabase URL/key
- Email not verified
- Wrong password
- RLS blocking profile fetch

---

#### Problem: User lands on wrong dashboard

**Check these files:**

| File                         | What to Check           |
| ---------------------------- | ----------------------- |
| `lib/routeAfterLogin.ts`     | Dashboard routing logic |
| `profiles` table             | `role` column value     |
| `organization_members` table | `member_type` column    |

**Debug Steps:**
```typescript
// In routeAfterLogin.ts
console.log('[Route] Profile:', profile);
console.log('[Route] Role:', profile.role);
console.log('[Route] Org Member:', orgMember);
console.log('[Route] Routing to:', determinedRoute);
```

**Fix:** Ensure `profiles.role` matches expected value (e.g., `'principal'`, `'teacher'`, `'parent'`).

---

### 4.2 Payment Issues

#### Problem: Payment not confirming

**Check these files:**

| File                                           | What to Check     |
| ---------------------------------------------- | ----------------- |
| `supabase/functions/payfast-webhook/`          | Webhook handler   |
| `supabase/functions/payments-create-checkout/` | Checkout creation |
| PayFast dashboard                              | ITN logs          |

**Debug Steps:**
1. Check PayFast sandbox logs for ITN delivery
2. Check Supabase function logs: `supabase functions logs payfast-webhook`
3. Verify webhook URL is correct in PayFast settings
4. Check signature validation

**Common Causes:**
- Incorrect passphrase
- Webhook URL not accessible
- Signature mismatch
- Amount mismatch between request and ITN

---

### 4.3 Messaging Issues

#### Problem: Messages not sending

**Check these files:**

| File                           | What to Check         |
| ------------------------------ | --------------------- |
| `hooks/useTeacherMessaging.ts` | Send message function |
| `hooks/useParentMessaging.ts`  | Parent version        |
| `messages` table RLS           | Policies              |

**Debug Steps:**
```typescript
// Before sending
console.log('[Message] Sending:', { threadId, content });
const { data, error } = await supabase.from('messages').insert(...);
console.log('[Message] Result:', { data, error });
```

**Common Causes:**
- RLS policy blocking insert
- Missing thread_id
- User not a participant in thread

---

### 4.4 AI/Dash Issues

#### Problem: AI not responding

**Check these files:**

| File                               | What to Check  |
| ---------------------------------- | -------------- |
| `services/dash-ai/DashAIClient.ts` | API calls      |
| `supabase/functions/ai-proxy/`     | Proxy function |
| `user_ai_tiers` table              | User quota     |

**Debug Steps:**
1. Check quota: `SELECT * FROM user_ai_tiers WHERE user_id = '<id>'`
2. Check function logs: `supabase functions logs ai-proxy`
3. Verify ANTHROPIC_API_KEY is set in Supabase secrets

**Common Causes:**
- Quota exceeded
- Invalid API key
- Network timeout
- Function cold start

---

### 4.5 OTA Update Issues

#### Problem: Update not applying

**What We Fixed Today:**
The `production` channel was not linked to the `production` branch.

**Check these:**
1. Channel-branch link: `eas channel:list`
2. Update exists on branch: `eas update:list --branch production`
3. Runtime version matches: Check `app.json` → `runtimeVersion`
4. Fingerprint matches: Compare update fingerprint with build fingerprint

**Fix Command:**
```bash
EAS_PROJECT_ID=playstore npx eas channel:edit production --branch production
```

---

### 4.6 Notification Issues

#### Problem: Push notifications not received

**Check these files:**

| File                            | What to Check      |
| ------------------------------- | ------------------ |
| `lib/NotificationService.ts`    | Token registration |
| `supabase/functions/send-push/` | Send function      |
| `expo_push_tokens` table        | Token stored       |

**Debug Steps:**
1. Verify push token saved: `SELECT * FROM expo_push_tokens WHERE user_id = '<id>'`
2. Check function logs: `supabase functions logs send-push`
3. Test with Expo push tool: https://expo.dev/notifications

**Common Causes:**
- Token not saved
- Token expired (reinstall app)
- Incorrect project ID
- Notification permissions denied

---

## 5. Common Issues & Solutions

### 5.1 Quick Fixes

| Issue               | Solution                                                  |
| ------------------- | --------------------------------------------------------- |
| App stuck on splash | Clear cache: `expo start --clear`                         |
| Build failing       | Check `eas.json` profile, ensure dependencies installed   |
| Types error         | Run `npm run typecheck`, update `lib/database.types.ts`   |
| RLS blocking data   | Check policies in Supabase dashboard                      |
| Supabase connection | Verify env vars, check Supabase status                    |
| Metro bundler crash | Increase memory: `NODE_OPTIONS=--max-old-space-size=8192` |

### 5.2 Reset Procedures

#### Reset User Session
```typescript
import { supabase } from '@/lib/supabase';
await supabase.auth.signOut();
// Clear AsyncStorage if needed
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.clear();
```

#### Reset Development Environment
```bash
# Clear all caches
npm run start:clear
# Or manually:
rm -rf node_modules/.cache
rm -rf .expo
watchman watch-del-all  # if on Mac
npm start -- --reset-cache
```

#### Reset Database Types
```bash
# Regenerate from Supabase
npx supabase gen types typescript --project-id lvvvjywrmpcqrpvuptdi > lib/database.types.ts
```

---

## File Reference Quick Lookup

### Authentication

| Purpose           | File                       |
| ----------------- | -------------------------- |
| Auth Context      | `contexts/AuthContext.tsx` |
| Sign In/Up/Out    | `lib/authActions.ts`       |
| Route After Login | `lib/routeAfterLogin.ts`   |
| Session Manager   | `lib/sessionManager.ts`    |
| Route Guard       | `hooks/useRouteGuard.ts`   |
| Supabase Client   | `lib/supabase.ts`          |

### Dashboards

| Role            | File                                       |
| --------------- | ------------------------------------------ |
| Super Admin     | `app/screens/super-admin-dashboard.tsx`    |
| Principal       | `app/screens/principal-dashboard.tsx`      |
| Teacher         | `app/screens/teacher-dashboard.tsx`        |
| Parent          | `app/screens/parent-dashboard.tsx`         |
| Student         | `app/screens/learner-dashboard.tsx`        |
| President (SOA) | `app/screens/membership/ceo-dashboard.tsx` |
| Org Admin       | `app/screens/org-admin-dashboard.tsx`      |

### Features

| Feature       | Key File                              |
| ------------- | ------------------------------------- |
| Messaging     | `hooks/useTeacherMessaging.ts`        |
| AI Chat       | `services/dash-ai/DashAIClient.ts`    |
| Calls         | `components/calls/CallProvider.tsx`   |
| Payments      | `supabase/functions/payfast-webhook/` |
| Notifications | `lib/NotificationRouter.ts`           |
| Attendance    | `app/screens/attendance.tsx`          |
| Lessons       | `services/LessonsService.ts`          |
| Homework      | `app/screens/homework.tsx`            |

---

## Next Sections

- **[Section A: Platform Overview & Features](HOW-TO-101-A.md)**
- **[Section C: Team Structure & Hiring Guide](HOW-TO-101-C.md)**
- **[ROAD-MAP.md](../../ROAD-MAP.md)** - Product Roadmap
