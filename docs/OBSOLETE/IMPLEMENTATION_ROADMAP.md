# Implementation Roadmap - Learner Dashboard & Enhanced Features

## Current Status
- ✅ Version code bumped to 13
- ✅ Committed and pushed to main
- ✅ Preview build initiated
- ✅ Program creation & sharing features completed
- ✅ Bulk CV import completed

---

## Phase 1: Learner Dashboard (Priority: High)

### 1.1 Learner Dashboard Screen
**Location:** `app/screens/learner-dashboard.tsx`

**Features:**
- Active enrollments carousel
- Progress cards per program
- Upcoming assignments widget
- Quick action buttons
- Recent activity feed
- Certificates earned display

**Components Needed:**
- `components/learner/ProgramProgressCard.tsx`
- `components/learner/AssignmentWidget.tsx`
- `components/learner/QuickActions.tsx`
- `components/learner/ActivityFeed.tsx`

**Database:**
- Query enrollments with progress
- Fetch assignments with deadlines
- Get certificates earned

---

### 1.2 Connections & Networking
**Location:** `app/screens/learner/connections.tsx`

**Features:**
- **Peer Connections:**
  - Search learners by program/name
  - Send/accept connection requests
  - Connections list
  - View connection profiles
  - Message connections

- **Instructor Connections:**
  - View instructors for enrolled programs
  - Direct messaging
  - Office hours booking
  - Announcements feed

**Database Tables:**
```sql
CREATE TABLE learner_connections (
  id UUID PRIMARY KEY,
  learner_id UUID REFERENCES profiles(id),
  connection_id UUID REFERENCES profiles(id),
  connection_type TEXT, -- 'peer' or 'instructor'
  status TEXT, -- 'pending', 'accepted', 'blocked'
  created_at TIMESTAMPTZ
);

CREATE TABLE study_groups (
  id UUID PRIMARY KEY,
  name TEXT,
  program_id UUID REFERENCES courses(id),
  created_by UUID REFERENCES profiles(id),
  members JSONB, -- Array of member IDs
  created_at TIMESTAMPTZ
);
```

---

### 1.3 Submissions & Assignments
**Location:** `app/screens/learner/assignments.tsx`

**Features:**
- **Assignment List:**
  - Pending (with deadlines)
  - Submitted (awaiting grade)
  - Graded (with feedback)
  - Filter by program

- **Submission Interface:**
  - File upload (PDF, DOCX, images)
  - Text response editor
  - Video/audio recording
  - Submission preview
  - Edit before deadline

**File Upload:**
- Use Supabase Storage
- Store in: `submissions/{enrollment_id}/{assignment_id}/`
- Support: PDF, DOCX, images, video, audio

**Database:**
```sql
CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id),
  learner_id UUID REFERENCES profiles(id),
  enrollment_id UUID REFERENCES enrollments(id),
  files JSONB, -- Array of file URLs
  text_response TEXT,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  grade DECIMAL,
  feedback TEXT,
  status TEXT -- 'draft', 'submitted', 'graded'
);
```

---

### 1.4 Online Courses & Learning
**Location:** `app/screens/learner/courses/[id].tsx`

**Features:**
- **Course Player:**
  - Video player with controls
  - Progress tracking
  - Download for offline
  - Subtitles/captions

- **Content Structure:**
  - Modules/lessons
  - Resources sidebar
  - Quiz/assessments
  - Completion tracking

- **Progress Dashboard:**
  - Completion percentage
  - Time spent
  - Last accessed
  - Certificates earned

**Components:**
- `components/learner/VideoPlayer.tsx`
- `components/learner/CourseContent.tsx`
- `components/learner/ProgressTracker.tsx`

---

## Phase 2: CV Management & Creation

### 2.1 CV Builder Tool
**Location:** `app/screens/learner/cv-builder.tsx`

**Features:**
- **Step-by-Step Wizard:**
  1. Personal Information
  2. Education
  3. Work Experience
  4. Skills
  5. Certifications
  6. References
  7. Preview & Export

- **Templates:**
  - Modern professional
  - Skills-focused
  - Creative/portfolio
  - Traditional

- **Auto-Fill:**
  - Pull from learner profile
  - Extract from enrollments
  - Use certifications earned
  - Skills from programs

- **Export:**
  - PDF download
  - Share link
  - Send to organization
  - Print-friendly version

**Database:**
```sql
CREATE TABLE learner_cvs (
  id UUID PRIMARY KEY,
  learner_id UUID REFERENCES profiles(id),
  title TEXT,
  template_id TEXT,
  content JSONB, -- Full CV data structure
  pdf_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

### 2.2 CV Upload & Processing
**Location:** `app/screens/learner/cv-upload.tsx`

**Features:**
- **Upload Existing CV:**
  - PDF, DOCX, images
  - Drag & drop interface
  - Preview before upload
  - OCR for scanned docs

- **Auto-Parse:**
  - Extract text from PDF
  - Parse structure
  - Extract skills
  - Suggest profile updates

**Implementation:**
- Use `expo-document-picker` for file selection
- Upload to Supabase Storage
- Use Edge Function for OCR/parsing (if needed)
- Store parsed data in `learner_cvs` table

---

### 2.3 Portfolio Builder
**Location:** `app/screens/learner/portfolio.tsx`

**Features:**
- Upload work samples
- Organize by category/program
- Add descriptions
- Skills showcase
- Certificates display
- Public/private settings
- Share link generation

---

## Phase 3: Organization Enhancements

### 3.1 Enhanced CV Processing
**Location:** `app/screens/org-admin/cv-processing.tsx`

**Features:**
- **Bulk CV Upload:**
  - Multi-file selection
  - Batch processing
  - Progress tracking
  - Error reporting

- **OCR & Parsing:**
  - Extract candidate data
  - Skills extraction
  - Experience parsing
  - Education detection

- **Smart Matching:**
  - Match CVs to programs
  - Skills gap analysis
  - Recommendation engine
  - Priority scoring

**Edge Function:** `cv-processor`
- Receives uploaded CV
- Performs OCR (if image)
- Extracts structured data
- Returns parsed information

---

### 3.2 Document Library
**Location:** `app/screens/org-admin/documents.tsx`

**Features:**
- Upload program materials
- Organize by folders
- Version control
- Access permissions
- Download tracking
- Search functionality

---

### 3.3 Organization CV Builder
**Location:** `app/screens/org-admin/cv-templates.tsx`

**Features:**
- Create branded CV templates
- Customize for organization
- Pre-fill with program data
- Generate CVs for learners
- Bulk CV generation

---

## Phase 4: Dash AI Automation Tools

### 4.1 AI Tools for Organizations
**Location:** `app/screens/org-admin/ai-tools.tsx`

**Features:**

1. **CV Analyzer:**
   - Analyze uploaded CVs
   - Extract skills automatically
   - Match to programs
   - Generate candidate summaries

2. **Content Generator:**
   - Program descriptions
   - Assignment prompts
   - Announcements
   - Email templates

3. **Auto-Enrollment Assistant:**
   - Analyze CV and suggest programs
   - Auto-enroll based on criteria
   - Generate enrollment recommendations

4. **Analytics Insights:**
   - Learner engagement analysis
   - Completion predictions
   - At-risk learner flags
   - Success factors

5. **Communication Automation:**
   - Auto-respond to queries
   - Smart reminders
   - Progress updates
   - Welcome messages

**Implementation:**
- Use existing Dash AI service
- Create prompt templates
- Store AI-generated content
- Allow review/edit before sending

**Database:**
```sql
CREATE TABLE ai_generated_content (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  content_type TEXT, -- 'program_description', 'assignment', etc.
  prompt TEXT,
  generated_text TEXT,
  reviewed BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ
);

CREATE TABLE ai_recommendations (
  id UUID PRIMARY KEY,
  learner_id UUID REFERENCES profiles(id),
  recommendation_type TEXT,
  program_id UUID REFERENCES courses(id),
  confidence_score DECIMAL,
  reasoning TEXT,
  acted_upon BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ
);
```

---

## Phase 5: Enhanced Settings

### 5.1 Organization Settings
**Location:** `app/screens/org-admin/settings.tsx`

**Sections:**

1. **Profile & Branding:**
   - Organization logo upload
   - Brand colors
   - Contact information
   - Social media links
   - About section

2. **Program Settings:**
   - Default enrollment settings
   - Completion criteria
   - Certificate templates
   - Assessment rules

3. **Communication:**
   - Email templates
   - SMS templates
   - Notification preferences
   - Auto-response rules

4. **AI Preferences:**
   - Enable/disable AI features
   - Customize AI prompts
   - Auto-enrollment rules
   - Content approval workflow

5. **Integrations:**
   - Sponsor portal settings
   - Payment gateway
   - Email service (SendGrid, etc.)
   - Analytics (Google Analytics, etc.)

6. **File Management:**
   - Storage quota
   - File retention policies
   - Backup settings

### 5.2 Learner Settings
**Location:** `app/screens/learner/settings.tsx`

**Sections:**

1. **Profile:**
   - Personal information
   - Profile picture
   - Bio/About
   - Skills & interests

2. **Privacy:**
   - Connection visibility
   - Portfolio sharing settings
   - Profile visibility
   - Data export

3. **Notifications:**
   - Assignment reminders
   - Grade notifications
   - Connection requests
   - Program updates
   - Marketing emails (opt-in/out)

4. **Preferences:**
   - Language selection
   - Theme (dark/light)
   - Offline mode
   - Auto-download settings

5. **CV & Portfolio:**
   - Default CV template
   - Portfolio visibility
   - Auto-update CV from enrollments

---

## Database Migrations Needed

### Migration 1: Learner Features
```sql
-- Learner connections
CREATE TABLE learner_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('peer', 'instructor')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(learner_id, connection_id)
);

-- Study groups
CREATE TABLE study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  program_id UUID REFERENCES courses(id),
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES profiles(id),
  members JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assignment submissions
CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id),
  learner_id UUID REFERENCES profiles(id),
  enrollment_id UUID REFERENCES enrollments(id),
  files JSONB DEFAULT '[]'::jsonb,
  text_response TEXT,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  grade DECIMAL,
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Learner CVs
CREATE TABLE learner_cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template_id TEXT,
  content JSONB NOT NULL,
  pdf_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Portfolio items
CREATE TABLE portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  program_id UUID REFERENCES courses(id),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Migration 2: Organization Enhancements
```sql
-- Organization settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '{}'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ai_preferences JSONB DEFAULT '{}'::jsonb;

-- CV templates
CREATE TABLE cv_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  design JSONB NOT NULL,
  fields JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI generated content
CREATE TABLE ai_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  content_type TEXT NOT NULL,
  prompt TEXT,
  generated_text TEXT,
  reviewed BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI recommendations
CREATE TABLE ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID REFERENCES profiles(id),
  organization_id UUID REFERENCES organizations(id),
  recommendation_type TEXT NOT NULL,
  program_id UUID REFERENCES courses(id),
  confidence_score DECIMAL,
  reasoning TEXT,
  acted_upon BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## File Structure

```
app/
├── screens/
│   ├── learner-dashboard.tsx
│   ├── learner/
│   │   ├── connections.tsx
│   │   ├── assignments.tsx
│   │   ├── courses/
│   │   │   └── [id].tsx
│   │   ├── cv-builder.tsx
│   │   ├── cv-upload.tsx
│   │   ├── portfolio.tsx
│   │   └── settings.tsx
│   └── org-admin/
│       ├── cv-processing.tsx
│       ├── documents.tsx
│       ├── cv-templates.tsx
│       └── ai-tools.tsx

components/
├── learner/
│   ├── ProgramProgressCard.tsx
│   ├── AssignmentWidget.tsx
│   ├── QuickActions.tsx
│   ├── ActivityFeed.tsx
│   ├── VideoPlayer.tsx
│   ├── CourseContent.tsx
│   ├── CVBuilder/
│   │   ├── PersonalInfoStep.tsx
│   │   ├── EducationStep.tsx
│   │   ├── ExperienceStep.tsx
│   │   ├── SkillsStep.tsx
│   │   └── PreviewStep.tsx
│   └── PortfolioItem.tsx
└── org-admin/
    ├── CVProcessor.tsx
    ├── AIToolCard.tsx
    └── DocumentLibrary.tsx

hooks/
├── useLearnerDashboard.ts
├── useAssignments.ts
├── useConnections.ts
├── usePortfolio.ts
└── useAITools.ts

services/
├── cvParser.ts
├── aiContentGenerator.ts
└── documentStorage.ts
```

---

## Next Implementation Steps

1. **Create database migrations** for all new tables
2. **Build learner dashboard** screen with basic layout
3. **Implement file upload** functionality with Supabase Storage
4. **Create CV builder** wizard component
5. **Build connections** feature
6. **Implement assignment** submission system
7. **Create Dash AI tools** interface
8. **Enhance settings** screens

---

## Technical Notes

- Use Supabase Storage for all file uploads
- Implement proper error handling for large files
- Add progress indicators for uploads
- Use React Query for data fetching
- Implement optimistic updates where appropriate
- Add offline support for viewing content
- Ensure proper RBAC for all features

