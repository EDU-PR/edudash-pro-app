# HOW-TO-101 Section C: Team Structure & Hiring Guide

> **EduDash Pro Complete Manual** | **Section C of 3**  
> **Version**: 2.0.0 | **Last Updated**: December 31, 2025

This section covers team structure, job descriptions, hiring recommendations, and upcoming features.

---

## Table of Contents

1. [Team Structure Overview](#1-team-structure-overview)
2. [Job Descriptions](#2-job-descriptions)
3. [Hiring Priorities & Timeline](#3-hiring-priorities--timeline)
4. [Operational Guidelines](#4-operational-guidelines)
5. [Upcoming Features Summary](#5-upcoming-features-summary)
6. [Investor Information](#6-investor-information)

---

## 1. Team Structure Overview

### Current Phase: MVP/Startup

```
                    ┌─────────────────────────┐
                    │      CEO / FOUNDER      │
                    │    (Product Vision)     │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼───────┐       ┌───────▼───────┐       ┌───────▼───────┐
│     CTO       │       │   PRODUCT     │       │   BUSINESS    │
│  (Technical)  │       │   MANAGER     │       │   DEV/SALES   │
└───────┬───────┘       └───────────────┘       └───────────────┘
        │
┌───────┴───────────────────────┐
│                               │
▼                               ▼
┌─────────────┐         ┌─────────────┐
│   MOBILE    │         │   BACKEND   │
│ DEVELOPER   │         │  DEVELOPER  │
└─────────────┘         └─────────────┘
```

### Target Team Size by Phase

| Phase | Team Size | Timeline |
|-------|-----------|----------|
| **MVP/Startup** | 5-7 people | Current - 6 months |
| **Growth** | 10-15 people | 6-12 months |
| **Scale** | 20-30 people | 12-24 months |

### Minimum Viable Team (5-7 People)

| Role | Responsibility | Urgency |
|------|----------------|---------|
| CEO/Founder | Vision, strategy, fundraising | ✅ Filled |
| CTO / Tech Lead | Architecture, code reviews, technical decisions | 🔴 Critical |
| Mobile Developer | React Native/Expo development | 🔴 Critical |
| Backend Developer | Supabase, Edge Functions, database | 🔴 Critical |
| Product Manager | Requirements, prioritization, user feedback | 🟡 High |
| DevOps (Part-time) | CI/CD, builds, monitoring | 🟡 High |
| QA (Part-time) | Testing, bug reporting | 🟢 Medium |

---

## 2. Job Descriptions

### 2.1 Chief Technology Officer (CTO)

**Department**: Engineering  
**Reports To**: CEO/Founder  
**Location**: Remote (South Africa preferred)  
**Type**: Full-time

#### About the Role

We're looking for a technical co-founder/CTO to lead the technical vision and execution of EduDash Pro, a mobile-first educational platform serving South African schools and organizations. You'll architect solutions, mentor developers, and ensure code quality while driving our AI-powered features forward.

#### Responsibilities

- **Technical Leadership**
  - Define and execute technical strategy and architecture
  - Make critical technology decisions (frameworks, services, infrastructure)
  - Create and maintain technical roadmap aligned with product goals
  - Establish coding standards, review processes, and best practices

- **Team Management**
  - Hire, mentor, and manage engineering team
  - Conduct code reviews and provide constructive feedback
  - Foster a culture of innovation and continuous improvement
  - Run effective sprint planning and retrospectives

- **Hands-On Development**
  - Lead development of complex features (AI integration, real-time systems)
  - Debug and resolve critical production issues
  - Implement security measures and compliance requirements
  - Optimize performance and scalability

- **Stakeholder Collaboration**
  - Work with CEO on product strategy and prioritization
  - Communicate technical decisions to non-technical stakeholders
  - Estimate effort and manage technical debt
  - Liaise with external partners (Supabase, Anthropic, Daily.co)

#### Requirements

**Must Have:**
- 7+ years of software development experience
- 3+ years in a technical leadership role
- Expert-level knowledge of TypeScript/JavaScript
- Strong experience with React Native or React
- Experience with PostgreSQL and database design
- Understanding of cloud architecture and serverless

**Preferred:**
- Experience with Expo/React Native
- Experience with Supabase or Firebase
- AI/ML integration experience
- South African market knowledge
- Startup experience

#### Technical Stack You'll Work With

- **Frontend**: React Native, Expo, TypeScript, NativeWind
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **AI**: Anthropic Claude, OpenAI, Azure Speech
- **Infrastructure**: EAS Build, Vercel, GitHub Actions
- **Payments**: PayFast, RevenueCat (planned)

#### Compensation

- **Salary**: R80,000 - R150,000/month (based on experience)
- **Equity**: 5-15% (negotiable for co-founder role)
- **Benefits**: Remote work, flexible hours, equipment budget

---

### 2.2 Senior Mobile Developer (React Native)

**Department**: Engineering  
**Reports To**: CTO  
**Location**: Remote (South Africa preferred)  
**Type**: Full-time

#### About the Role

Join our team as a Senior Mobile Developer to build and maintain the EduDash Pro mobile application serving thousands of students, teachers, and parents across South Africa. You'll work with React Native and Expo to deliver native-quality experiences on iOS and Android.

#### Responsibilities

- **Feature Development**
  - Build new features across the mobile application
  - Implement UI/UX designs with pixel-perfect accuracy
  - Integrate with backend APIs and real-time services
  - Develop offline-capable features

- **Quality & Performance**
  - Write clean, maintainable, well-tested code
  - Optimize app performance and reduce bundle size
  - Debug and fix issues across iOS and Android
  - Implement accessibility (a11y) best practices

- **Platform Management**
  - Manage app releases (Play Store, App Store)
  - Configure EAS Build profiles
  - Implement and test OTA updates
  - Handle native module integration

- **Collaboration**
  - Participate in code reviews
  - Work with backend team on API design
  - Contribute to technical documentation
  - Mentor junior developers (when hired)

#### Requirements

**Must Have:**
- 4+ years of mobile development experience
- 2+ years with React Native
- Strong TypeScript/JavaScript skills
- Experience with state management (Context, Redux, Zustand)
- Understanding of native iOS/Android concepts
- Experience with REST APIs and real-time data

**Preferred:**
- Expo development experience
- Experience with expo-router (file-based routing)
- Push notification implementation
- Video/audio streaming experience (WebRTC)
- South African education sector knowledge

#### Day-to-Day Examples

- Implement new teacher messaging features
- Fix Android-specific keyboard handling issues
- Add new Dash AI conversation capabilities
- Optimize lesson list rendering performance
- Review pull requests from team members

#### Compensation

- **Salary**: R50,000 - R90,000/month
- **Benefits**: Remote work, flexible hours, learning budget

---

### 2.3 Backend Developer (Supabase/PostgreSQL)

**Department**: Engineering  
**Reports To**: CTO  
**Location**: Remote (South Africa preferred)  
**Type**: Full-time

#### About the Role

We need a skilled Backend Developer to design and maintain our Supabase-powered backend. You'll work on database architecture, Edge Functions, real-time features, and integrations with external services like PayFast, Daily.co, and AI APIs.

#### Responsibilities

- **Database Development**
  - Design and optimize PostgreSQL schemas
  - Implement Row Level Security (RLS) policies
  - Write efficient SQL queries and stored procedures
  - Manage database migrations

- **Edge Functions**
  - Develop Deno-based Edge Functions
  - Implement API endpoints for AI, payments, webhooks
  - Handle authentication and authorization
  - Optimize function performance and cold starts

- **Integrations**
  - Maintain PayFast payment integration
  - Manage Daily.co video calling integration
  - Implement AI service proxies (Claude, OpenAI, Azure)
  - Build webhook handlers for external services

- **Infrastructure**
  - Monitor database performance
  - Implement caching strategies
  - Set up backup and disaster recovery
  - Document API endpoints and data models

#### Requirements

**Must Have:**
- 4+ years of backend development experience
- Strong PostgreSQL experience
- Experience with serverless/edge functions
- Understanding of authentication (JWT, OAuth)
- REST API design and implementation
- Experience with TypeScript or JavaScript

**Preferred:**
- Supabase experience
- Deno runtime experience
- Payment gateway integration experience
- Real-time systems (WebSocket, SSE)
- Multi-tenant SaaS architecture

#### Technical Responsibilities

| Area | Technologies |
|------|--------------|
| Database | PostgreSQL, RLS, Triggers, Functions |
| Edge Functions | Deno, TypeScript, Supabase Functions |
| Auth | Supabase Auth, JWT, OAuth |
| Storage | Supabase Storage, signed URLs |
| Real-time | Supabase Realtime, PostgreSQL LISTEN/NOTIFY |

#### Compensation

- **Salary**: R45,000 - R85,000/month
- **Benefits**: Remote work, flexible hours, learning budget

---

### 2.4 Full-Stack Developer (Web - Next.js)

**Department**: Engineering  
**Reports To**: CTO  
**Location**: Remote  
**Type**: Full-time

#### About the Role

Build and maintain the EduDash Pro web portal using Next.js 14 and TailwindCSS. The web app serves admin dashboards, landing pages, and features that complement the mobile experience.

#### Responsibilities

- Develop web dashboard features using Next.js App Router
- Build responsive UI with TailwindCSS
- Implement server-side rendering (SSR) and static generation
- Integrate with Supabase backend (same as mobile)
- Optimize Core Web Vitals and SEO
- Deploy to Vercel with proper caching strategies

#### Requirements

**Must Have:**
- 3+ years of web development experience
- 2+ years with React
- Experience with Next.js (App Router preferred)
- Strong TypeScript skills
- CSS/TailwindCSS proficiency
- Understanding of web performance optimization

**Preferred:**
- Supabase/Firebase experience
- Experience with auth patterns (SSR + client)
- SEO and marketing site experience
- Experience with Vercel deployment

#### Compensation

- **Salary**: R40,000 - R75,000/month
- **Benefits**: Remote work, flexible hours

---

### 2.5 Product Manager

**Department**: Product  
**Reports To**: CEO  
**Location**: Remote (South Africa preferred)  
**Type**: Full-time

#### About the Role

Drive product strategy and execution for EduDash Pro. You'll work directly with schools, teachers, and parents to understand their needs, prioritize features, and ensure we're building the right product.

#### Responsibilities

- **User Research**
  - Conduct user interviews with schools and parents
  - Analyze usage data and feedback
  - Identify pain points and opportunities
  - Create user personas and journey maps

- **Product Strategy**
  - Define and prioritize product roadmap
  - Write detailed feature specifications
  - Set KPIs and track product metrics
  - Make data-driven prioritization decisions

- **Execution**
  - Work with engineering on sprint planning
  - Review designs and provide feedback
  - Conduct user acceptance testing
  - Manage feature launches and communications

- **Stakeholder Management**
  - Present roadmap to CEO and investors
  - Communicate with customer success on feedback
  - Align marketing on product positioning
  - Document product decisions and rationale

#### Requirements

**Must Have:**
- 3+ years of product management experience
- Experience with B2B or B2C SaaS products
- Strong analytical and communication skills
- Ability to write clear specifications
- Experience with agile methodologies

**Preferred:**
- Education technology (EdTech) experience
- South African market knowledge
- Experience with mobile products
- Technical background (can read code)

#### Compensation

- **Salary**: R45,000 - R80,000/month
- **Benefits**: Remote work, flexible hours

---

### 2.6 DevOps Engineer (Part-time/Contract)

**Department**: Engineering  
**Reports To**: CTO  
**Location**: Remote  
**Type**: Part-time or Contract

#### About the Role

Manage our build and deployment infrastructure, ensuring reliable releases for mobile and web applications.

#### Responsibilities

- Configure and maintain EAS Build profiles
- Set up GitHub Actions CI/CD pipelines
- Monitor application health and performance
- Manage environment variables and secrets
- Implement logging and alerting (Sentry, PostHog)
- Handle app store submissions and reviews
- Create and manage development environments

#### Requirements

**Must Have:**
- 3+ years of DevOps/SRE experience
- Experience with CI/CD pipelines
- Understanding of mobile app deployment
- Experience with cloud platforms
- Shell scripting skills

**Preferred:**
- EAS Build experience
- Expo/React Native deployment experience
- Supabase or Firebase operations
- Experience with Vercel

#### Time Commitment

- 10-20 hours per week
- On-call for critical issues (rare)
- Available for release coordination

#### Compensation

- **Hourly**: R400 - R700/hour
- **Monthly Retainer**: R15,000 - R30,000/month

---

### 2.7 QA Engineer / Tester (Part-time)

**Department**: Quality Assurance  
**Reports To**: CTO / Product Manager  
**Location**: Remote  
**Type**: Part-time

#### About the Role

Ensure the quality of EduDash Pro through systematic testing across mobile and web platforms.

#### Responsibilities

- Create and execute test plans
- Perform manual testing on iOS and Android
- Test web portal functionality
- Report bugs with clear reproduction steps
- Verify bug fixes
- Perform regression testing before releases
- Test payment flows (in sandbox)
- Accessibility testing

#### Requirements

**Must Have:**
- 2+ years of QA/testing experience
- Experience with mobile app testing
- Familiarity with bug tracking tools (GitHub Issues)
- Attention to detail
- Good communication skills

**Preferred:**
- Experience with Expo/React Native apps
- Knowledge of automated testing
- South African education context

#### Time Commitment

- 15-25 hours per week
- More hours before major releases

#### Compensation

- **Hourly**: R200 - R400/hour
- **Monthly**: R10,000 - R20,000/month

---

### 2.8 Customer Success Manager (Growth Phase)

**Department**: Customer Success  
**Reports To**: CEO  
**Location**: Remote (South Africa)  
**Type**: Full-time

#### About the Role

Help schools succeed with EduDash Pro through onboarding, training, and ongoing support.

#### Responsibilities

- **Onboarding**
  - Guide new schools through setup process
  - Conduct training sessions for principals and teachers
  - Create onboarding documentation and videos
  - Monitor early usage and engagement

- **Support**
  - Respond to customer inquiries
  - Troubleshoot common issues
  - Escalate technical issues to engineering
  - Maintain knowledge base and FAQs

- **Success**
  - Monitor customer health metrics
  - Identify at-risk accounts
  - Conduct regular check-ins with key accounts
  - Gather and relay product feedback

- **Growth**
  - Identify upsell opportunities
  - Generate referrals and case studies
  - Support marketing with testimonials

#### Requirements

**Must Have:**
- 2+ years in customer success or support
- Excellent communication skills (English, Afrikaans a plus)
- Experience with SaaS products
- Patience and empathy
- Problem-solving abilities

**Preferred:**
- Education sector experience
- Experience with school administration
- Training/facilitation experience
- Salesforce or HubSpot experience

#### Compensation

- **Salary**: R25,000 - R45,000/month
- **Benefits**: Remote work, commission on upsells

---

### 2.9 UI/UX Designer (Growth Phase)

**Department**: Design  
**Reports To**: Product Manager  
**Location**: Remote  
**Type**: Full-time or Contract

#### About the Role

Design beautiful, intuitive interfaces for the EduDash Pro mobile app and web portal.

#### Responsibilities

- Create UI designs for new features
- Maintain and evolve design system
- Design user flows and wireframes
- Conduct usability testing
- Create prototypes for validation
- Ensure accessibility compliance
- Collaborate with developers on implementation

#### Requirements

**Must Have:**
- 3+ years of UI/UX design experience
- Mobile app design experience
- Proficiency in Figma
- Understanding of design systems
- Portfolio demonstrating mobile work

**Preferred:**
- React Native/Mobile design experience
- Education or children's app experience
- Animation/motion design skills
- User research experience

#### Deliverables

- Figma design files
- Design system components
- Prototype flows
- Design specifications

#### Compensation

- **Salary**: R35,000 - R60,000/month
- **Contract**: R300 - R500/hour

---

## 3. Hiring Priorities & Timeline

### Phase 1: Immediate (0-3 months) 🔴

| Role | Priority | Reason |
|------|----------|--------|
| **CTO / Tech Lead** | Critical | Architecture decisions, code quality |
| **Mobile Developer** | Critical | Feature velocity, bug fixes |
| **Backend Developer** | Critical | Database, Edge Functions, integrations |

**Total Investment**: R175,000 - R325,000/month

### Phase 2: Near-term (3-6 months) 🟡

| Role | Priority | Reason |
|------|----------|--------|
| **Product Manager** | High | User research, prioritization |
| **DevOps (Part-time)** | High | Build reliability, CI/CD |
| **Web Developer** | Medium | Web portal enhancements |

**Additional Investment**: R100,000 - R200,000/month

### Phase 3: Growth (6-12 months) 🟢

| Role | Priority | Reason |
|------|----------|--------|
| **Customer Success** | High | School onboarding, retention |
| **QA Engineer** | Medium | Quality assurance |
| **UI/UX Designer** | Medium | Design quality, consistency |

**Additional Investment**: R70,000 - R125,000/month

### Total Team Cost Projection

| Phase | Team Size | Monthly Cost |
|-------|-----------|--------------|
| Phase 1 | 3-4 | R175,000 - R325,000 |
| Phase 2 | 5-7 | R275,000 - R525,000 |
| Phase 3 | 8-10 | R345,000 - R650,000 |

---

## 4. Operational Guidelines

### 4.1 Development Workflow

```
Feature Request → Specification → Design → Development → Review → QA → Deploy
       │               │            │           │          │       │      │
       └── Product ────┴── Design ──┴── Eng ────┴── Eng ───┴── QA ─┴── DevOps
```

### 4.2 Release Process

#### Mobile App Releases

```bash
# 1. Code freeze and testing
git checkout main
git pull

# 2. Version bump
# Edit app.json: version, versionCode, runtimeVersion

# 3. Build for testing (APK)
EAS_PROJECT_ID=playstore npx eas build --profile playstore-apk --platform android

# 4. Test thoroughly

# 5. Build for store (AAB)
EAS_PROJECT_ID=playstore npx eas build --profile playstore --platform android

# 6. Submit to Play Store
EAS_PROJECT_ID=playstore npx eas submit --platform android

# 7. OTA update for existing users
NODE_OPTIONS="--max-old-space-size=8192" EAS_PROJECT_ID=playstore npx eas update --branch production --message "Release notes here"
```

#### Web Releases

```bash
# Automatic via Vercel on push to main
git push origin main
# Vercel builds and deploys automatically
```

### 4.3 On-Call / Incident Response

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| P0 - Platform Down | 15 minutes | All hands |
| P1 - Major Feature Broken | 1 hour | CTO + relevant dev |
| P2 - Minor Feature Broken | 4 hours | Assigned dev |
| P3 - Cosmetic / Low Impact | Next sprint | Product backlog |

### 4.4 Communication Channels

| Channel | Purpose |
|---------|---------|
| Slack / Discord | Daily communication |
| GitHub | Code, issues, PRs |
| Notion / Linear | Product specs, roadmap |
| Google Meet | Meetings |
| Email | External communication |

### 4.5 Meeting Cadence

| Meeting | Frequency | Attendees |
|---------|-----------|-----------|
| Daily Standup | Daily, 15 min | Engineering |
| Sprint Planning | Bi-weekly | Product + Engineering |
| Retrospective | Bi-weekly | Product + Engineering |
| Product Review | Weekly | CEO + Product |
| All Hands | Monthly | Everyone |

---

## 5. Upcoming Features Summary

For detailed roadmap, see [ROAD-MAP.md](../../ROAD-MAP.md).

### Phase 1: Q1 2026 - Core Enhancements

| Feature | Priority | Description |
|---------|----------|-------------|
| **Organization Join Requests** | High | Users can request to join schools/orgs |
| **Group Chat UI** | High | Create and manage group conversations |
| **Translation Completion** | High | Finish AF and ZU translations |
| **Message Reactions** | Medium | Emoji reactions on messages |

### Phase 2: Q1-Q2 2026 - Communication

| Feature | Priority | Description |
|---------|----------|-------------|
| **Phone Verification** | Critical | Twilio OTP for phone numbers |
| **WhatsApp Group Migration** | High | Import contacts from WhatsApp |
| **Enhanced Notifications** | Medium | Preferences, quiet hours, digests |

### Phase 3: Q2-Q3 2026 - Advanced Features

| Feature | Priority | Description |
|---------|----------|-------------|
| **Interactive Whiteboard** | Medium | Drawing/annotation for tablets |
| **Staged Module Locking** | High | Progressive unlock with upsells |
| **RevenueCat Integration** | High | iOS/Android subscriptions |

### Phase 4: Q3 2026 - STEM & Robotics

| Feature | Priority | Description |
|---------|----------|-------------|
| **Dash AI Robotics Expert** | High | STEM/robotics curriculum |
| **Robotics Challenges** | Medium | Interactive challenges with validation |
| **Virtual Simulator** | Low | Browser-based robot simulator |

### Phase 5: Q4 2026 - Enterprise

| Feature | Priority | Description |
|---------|----------|-------------|
| **Multi-School Districts** | Medium | Group schools under district admin |
| **Public API** | Medium | REST API for integrations |
| **White-Label Solution** | Low | Custom branding per tenant |

---

## 6. Investor Information

### 6.1 Market Opportunity

#### South African Education Market

| Metric | Value |
|--------|-------|
| Preschools in SA | ~18,000 |
| Primary Schools | ~25,000 |
| Secondary Schools | ~6,000 |
| Total Addressable Market | ~R10B/year |
| Serviceable Market (Private) | ~R2B/year |

#### Growth Drivers

1. **Digital Adoption**: COVID accelerated EdTech adoption
2. **Government Push**: DBE digital transformation initiatives
3. **Parent Demand**: Increased interest in child's education visibility
4. **Teacher Tools**: Teachers seeking AI assistance

### 6.2 Competitive Advantages

| Advantage | Description |
|-----------|-------------|
| **AI-First** | Deep AI integration for lesson planning, grading |
| **SA-Focused** | PayFast, local languages, CAPS curriculum |
| **Mobile-First** | Built for mobile-first markets |
| **Multi-Tenant** | Serve schools, NPOs, skills orgs on one platform |
| **Voice-Enabled** | Dash AI voice assistant for all users |

### 6.3 Business Model

#### Revenue Streams

| Stream | Description | % of Revenue |
|--------|-------------|--------------|
| **SaaS Subscriptions** | Monthly/annual school plans | 70% |
| **Membership Fees** | SOA registration/dues | 15% |
| **Enterprise Deals** | Custom implementations | 10% |
| **Advertising** | Free tier banner ads | 5% |

#### Unit Economics (Target)

| Metric | Value |
|--------|-------|
| Average Revenue Per User (ARPU) | R150/month |
| Customer Acquisition Cost (CAC) | R500 |
| Lifetime Value (LTV) | R3,600 (24 months) |
| LTV:CAC Ratio | 7.2x |
| Monthly Churn | 3-5% |

### 6.4 Funding Requirements

#### Seed Round (Current)

| Use of Funds | Amount | Purpose |
|--------------|--------|---------|
| Engineering | R3M | 3 senior developers × 12 months |
| Product | R800K | PM + design × 12 months |
| Operations | R500K | Infrastructure, tools, legal |
| Marketing | R500K | School acquisition, content |
| Reserve | R700K | Buffer |
| **Total** | **R5.5M** | 18-month runway |

#### Key Milestones

| Timeline | Milestone |
|----------|-----------|
| Month 3 | 50 active schools |
| Month 6 | 150 active schools |
| Month 12 | 500 active schools |
| Month 18 | 1,000 active schools, profitability path |

---

## Quick Reference Cards

### For New Developers

```
1. Clone repo: git clone <repo>
2. Install deps: npm install
3. Copy .env: cp .env.example .env
4. Start dev: npm start
5. Read WARP.md for standards
6. Check ROAD-MAP.md for priorities
```

### For New Designers

```
1. Access Figma: [link to figma]
2. Review existing components
3. Design mobile-first (375px width)
4. Use existing color palette
5. Export assets as PNG 1x/2x/3x
```

### For New Product People

```
1. Read HOW-TO-101 (all sections)
2. Review ROAD-MAP.md
3. Access analytics: PostHog dashboard
4. Join user interviews
5. Create specs in Notion/Linear
```

### Emergency Contacts

| Issue | Contact | Method |
|-------|---------|--------|
| Production Down | CTO | Phone |
| Payment Issues | Backend Lead | Slack |
| App Store Issues | DevOps | Slack |
| Customer Escalation | CEO | Email |

---

## Document Versions

| Section | Version | Last Updated |
|---------|---------|--------------|
| HOW-TO-101-A | 2.0.0 | Dec 31, 2025 |
| HOW-TO-101-B | 2.0.0 | Dec 31, 2025 |
| HOW-TO-101-C | 2.0.0 | Dec 31, 2025 |
| ROAD-MAP | 2.0.0 | Dec 31, 2025 |

---

## Related Documents

- **[Section A: Platform Overview & Features](HOW-TO-101-A.md)**
- **[Section B: Dashboard Tutorials & Registration Flows](HOW-TO-101-B.md)**
- **[ROAD-MAP.md](../../ROAD-MAP.md)** - Product Roadmap
- **[WARP.md](../../WARP.md)** - Development Standards
- **[README.md](../../README.md)** - Quick Start Guide
