# Learner Dashboard & Features - Implementation Plan

## Overview
Comprehensive learner dashboard for Skills Development Centre students with connections, submissions, online courses, CV management, and AI-powered assistance.

---

## 1. Learner Dashboard

### Core Features
- **Progress Overview:**
  - Active enrollments with progress bars
  - Upcoming assignments/deadlines
  - Certificates earned
  - Completion percentage per program
  - Recent activity feed

- **Quick Actions:**
  - Join live classes
  - Submit assignment
  - View resources
  - Connect with peers/instructors
  - Upload CV/Portfolio

- **Program Cards:**
  - Current enrollments
  - Program progress
  - Next lesson/assignment
  - Quick access buttons

---

## 2. Connections & Networking

### Features
- **Peer Connections:**
  - Search learners in same program
  - Send connection requests
  - View connections
  - Group study rooms

- **Instructor Connection:**
  - Direct messaging
  - Office hours booking
  - Q&A forum
  - Announcements

- **Study Groups:**
  - Create/join study groups
  - Group messaging
  - Shared resources
  - Collaborative assignments

---

## 3. Submissions & Assignments

### Features
- **Assignment Management:**
  - View all assignments (pending, submitted, graded)
  - Submission deadlines
  - File upload (PDF, images, documents)
  - Submission history
  - Grade feedback

- **Portfolio Builder:**
  - Upload projects/work samples
  - Organize by program/category
  - Share with employers/instructors
  - CV integration

- **Submission Types:**
  - File uploads
  - Text responses
  - Video recordings
  - Images/photos
  - Audio recordings

---

## 4. Online Courses & Learning

### Features
- **Course Content:**
  - Video lessons
  - Document resources
  - Interactive quizzes
  - Progress tracking
  - Completion certificates

- **Learning Path:**
  - Module structure
  - Prerequisites
  - Recommended next steps
  - Skill assessments

- **Offline Support:**
  - Download content
  - Offline viewing
  - Sync when online

---

## 5. CV Management & Creation

### Features
- **CV Builder:**
  - Step-by-step CV creation wizard
  - Templates (skills development focused)
  - Auto-fill from profile/enrollments
  - Export as PDF
  - Preview before saving

- **CV Upload:**
  - Upload existing CV (PDF, DOCX)
  - Auto-parse CV data
  - Extract skills/experience
  - Link to profile

- **CV Library:**
  - Multiple CV versions
  - Customize per job application
  - Version history
  - Share with organizations

- **Skills Portfolio:**
  - Skills showcase
  - Certificates display
  - Work samples
  - Projects portfolio

---

## 6. Dash AI Tools for Organizations

### Automation Features
- **Auto-Enrollment:**
  - AI analyzes CVs and suggests program matches
  - Auto-enroll based on criteria
  - Smart recommendations

- **Content Generation:**
  - Generate program descriptions
  - Create assignment prompts
  - Write announcements
  - Draft email templates

- **Analytics & Insights:**
  - Learner engagement analysis
  - Completion rate predictions
  - At-risk learner identification
  - Success factor analysis

- **Communication Automation:**
  - Auto-respond to common queries
  - Reminder notifications
  - Progress updates
  - Welcome messages

- **CV Processing:**
  - Auto-extract skills from CVs
  - Match CVs to programs
  - Generate candidate summaries
  - Flag incomplete applications

---

## 7. Organization Enhancements

### File Management
- **CV Upload & Processing:**
  - Bulk CV upload (PDF, DOCX, images)
  - OCR for scanned documents
  - Auto-extract candidate data
  - Skills extraction
  - Duplicate detection

- **Document Library:**
  - Store program materials
  - Resource sharing
  - Version control
  - Access permissions

- **Media Support:**
  - Image uploads for portfolios
  - Video content hosting
  - Audio recordings
  - Document storage

### CV Creation Tool
- **Admin CV Builder:**
  - Create standardized CV templates
  - Customize for organization brand
  - Pre-fill with program data
  - Generate professional CVs for learners
  - Export multiple formats

---

## 8. Enhanced Settings

### Organization Settings
- **Profile & Branding:**
  - Organization logo
  - Brand colors
  - Contact information
  - Social media links

- **Program Settings:**
  - Default program settings
  - Enrollment rules
  - Completion criteria
  - Certificate templates

- **Communication Settings:**
  - Email templates
  - Notification preferences
  - Auto-response rules
  - Reminder schedules

- **AI Settings:**
  - Enable/disable AI features
  - Customize AI prompts
  - Auto-enrollment rules
  - Content generation preferences

- **Integrations:**
  - Sponsor portal access
  - Payment gateway settings
  - Email service configuration
  - Analytics connections

### Learner Settings
- **Profile:**
  - Personal information
  - Profile picture
  - Bio/About
  - Skills & interests

- **Privacy:**
  - Connection visibility
  - Portfolio sharing
  - Profile visibility
  - Data export

- **Notifications:**
  - Assignment reminders
  - Grade notifications
  - Connection requests
  - Program updates

- **Preferences:**
  - Language
  - Theme (dark/light)
  - Offline mode
  - Auto-download settings

---

## Implementation Priority

### Phase 1 (MVP)
1. ✅ Basic learner dashboard
2. ✅ Assignment submissions (file upload)
3. ✅ CV upload & basic management
4. ✅ Program progress tracking
5. ✅ Enhanced org settings

### Phase 2 (Core Features)
1. CV builder tool
2. Connections & networking
3. Online course player
4. Dash AI automation tools
5. Portfolio builder

### Phase 3 (Advanced)
1. Study groups
2. Offline mode
3. Advanced analytics
4. AI content generation
5. Sponsor portal

---

## Technical Considerations

### File Storage
- Use Supabase Storage for:
  - CVs (PDF, DOCX)
  - Assignment submissions
  - Portfolio images
  - Program resources
  - Certificates

### AI Integration
- Use Dash AI for:
  - CV parsing
  - Content generation
  - Auto-recommendations
  - Analytics insights

### Database Schema
- `learner_profiles` - Extended learner data
- `cv_files` - CV storage and metadata
- `submissions` - Assignment submissions
- `connections` - Peer/instructor connections
- `study_groups` - Group management
- `portfolio_items` - Learner portfolio

---

## Next Steps

1. Design learner dashboard UI/UX
2. Create database migrations for new tables
3. Implement file upload functionality
4. Build CV builder component
5. Integrate Dash AI tools
6. Enhance settings screens

