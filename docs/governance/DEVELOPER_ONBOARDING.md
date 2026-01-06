# Developer Onboarding Checklist

> Complete this checklist within your first week. Check off items as you complete them.
> 
> **Your Domain:** _________________  
> **Your Mentor/Pair:** _________________  
> **Start Date:** _________________

---

## Day 1: Environment Setup ⚙️

### Prerequisites
- [ ] GitHub account with 2FA enabled
- [ ] Added to DashSoil/NewDash repository
- [ ] Slack/Discord workspace access
- [ ] Notion/Linear access (if applicable)

### Development Environment
```bash
# Commands to run - check each as completed
```

- [ ] **Git configured**
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your.email@example.com"
  ```

- [ ] **Repository cloned**
  ```bash
  git clone git@github.com:DashSoil/NewDash.git
  cd NewDash
  ```

- [ ] **Node.js installed** (v18+ required)
  ```bash
  node --version  # Should show v18.x.x or higher
  npm --version   # Should show 9.x.x or higher
  ```

- [ ] **Dependencies installed**
  ```bash
  npm install
  cd web && npm install && cd ..
  ```

- [ ] **Environment file configured**
  ```bash
  cp .env.example .env.local
  # Get values from Team Lead
  ```

- [ ] **Expo CLI installed**
  ```bash
  npm install -g expo-cli eas-cli
  ```

- [ ] **Supabase CLI installed**
  ```bash
  npm install -g supabase
  supabase login  # Get credentials from Lead
  ```

- [ ] **VS Code Extensions installed**
  - [ ] ESLint
  - [ ] Prettier
  - [ ] TypeScript + TSLint
  - [ ] React Native Tools
  - [ ] GitLens
  - [ ] Error Lens
  - [ ] GitHub Copilot (if available)

### Verify Setup
- [ ] **Mobile app starts**
  ```bash
  npm start
  # Scan QR code with Expo Go app
  ```

- [ ] **Web app starts**
  ```bash
  cd web && npm run dev
  # Visit http://localhost:3000
  ```

- [ ] **Type checking passes**
  ```bash
  npm run typecheck
  ```

- [ ] **Linting passes**
  ```bash
  npm run lint
  ```

---

## Day 1-2: Required Reading 📚

### Priority 1 (Must Read)
- [ ] `README.md` - Project overview
- [ ] `WARP.md` - Development standards (⚠️ CRITICAL - memorize these rules!)
- [ ] `docs/governance/TEAM_MANAGEMENT.md` - Team structure & workflows
- [ ] `.github/copilot-instructions.md` - Copilot AI coding guidelines

### Priority 2 (Domain Context)
- [ ] `ROAD-MAP.md` - Feature roadmap
- [ ] `lib/rbac/README.md` - Role-based access control
- [ ] Your domain's section in `TEAM_MANAGEMENT.md`

### Priority 3 (Reference)
- [ ] `scripts/README.md` - Database setup
- [ ] Supabase documentation: https://supabase.com/docs
- [ ] Expo documentation: https://docs.expo.dev

---

## Day 2-3: Codebase Exploration 🔍

### Your Domain Deep Dive
Complete these for YOUR assigned domain:

- [ ] **Read ALL files in your domain directories**
  - Use `find <directory> -name "*.ts" -o -name "*.tsx"` to list files
  - Take notes on unclear code

- [ ] **Run the app and test your domain's features**
  - Document what each screen does
  - Note any bugs or UX issues you find

- [ ] **Map dependencies**
  - What hooks/services does your domain use?
  - What shared components does it depend on?
  - What database tables does it access?

### Questions to Answer
Write answers in your notes:

1. What are the 3 most important files in my domain?
2. What Supabase tables does my domain use?
3. Who is my review pair and what overlap do we have?
4. What's the next planned feature for my domain (check ROAD-MAP.md)?

### Document Your Findings
- [ ] Create `docs/domains/<your-domain>/OVERVIEW.md` with your findings
- [ ] Include: key files, database tables, current state, planned features

---

## Day 3-4: First Bug Fixes 🐛

### Purpose
Complete 2-3 small bug fixes to learn the workflow. Don't worry about being slow - focus on doing it correctly.

### Bug Fix Workflow

**Step 1: Find a bug**
- [ ] Check GitHub Issues for `good-first-issue` label
- [ ] Or find a small bug while exploring your domain
- [ ] Assign the issue to yourself

**Step 2: Create a branch**
```bash
git checkout develop
git pull origin develop
git checkout -b bugfix/<your-domain>/<issue-number>-<short-description>
# Example: git checkout -b bugfix/parent/42-fee-display-wrong
```

**Step 3: Make the fix**
- [ ] Understand the bug fully before coding
- [ ] Make minimal, focused changes
- [ ] Test your fix thoroughly

**Step 4: Verify quality**
```bash
npm run typecheck    # Must pass
npm run lint         # Must pass
npm run check:console # No console.log
```

**Step 5: Commit with proper message**
```bash
git add .
git commit -m "fix(<domain>): <short description>

<longer explanation if needed>

Fixes #<issue-number>"
```

**Step 6: Push and create PR**
```bash
git push origin bugfix/<your-domain>/<description>
# Go to GitHub and create Pull Request
# Use the PR template
```

### First Bug Fixes Completed
- [ ] Bug Fix #1: Issue #_____ - _______________
- [ ] Bug Fix #2: Issue #_____ - _______________
- [ ] Bug Fix #3 (optional): Issue #_____ - _______________

---

## Day 4-5: First Feature Task 🚀

### Pick Your First Feature
- [ ] Review domain backlog with Team Lead
- [ ] Select a small feature (estimate: 1-2 days)
- [ ] Create feature branch

### Feature Development Checklist

- [ ] **Plan before coding**
  - What files will you modify/create?
  - What components do you need?
  - What database changes (if any)?

- [ ] **Add feature flag** (if new feature)
  ```typescript
  // In config/featureFlags.ts
  YOUR_NEW_FEATURE: {
    enabled: false,
    owner: 'Dev X',
    description: 'Description here',
    addedDate: '2026-01-XX',
  },
  ```

- [ ] **Implement incrementally**
  - Small commits, each one working
  - Test frequently
  - Ask for help after 2 hours stuck

- [ ] **Create comprehensive PR**
  - Fill out entire PR template
  - Add screenshots for UI changes
  - Request review from pair + lead

---

## Week 1 Completion 🎉

### Milestones
- [ ] Development environment working
- [ ] All required reading completed
- [ ] Domain exploration documented
- [ ] 2+ bug fixes merged
- [ ] First feature PR submitted
- [ ] Attended all standups
- [ ] Met with Team Lead for 1:1

### Week 1 Self-Assessment

Rate yourself (1-5) on:

| Area | Rating | Notes |
|------|--------|-------|
| Environment setup | /5 | |
| Understanding codebase | /5 | |
| Git workflow | /5 | |
| Code quality standards | /5 | |
| Communication | /5 | |

### Questions for Team Lead
List questions you have after Week 1:

1. 
2. 
3. 

---

## Ongoing Learning 📈

### Weekly Goals
- [ ] Complete at least 2 PRs per week
- [ ] Review at least 2 PRs from pair developer
- [ ] Share one learning at weekly sync

### Monthly Goals
- [ ] Complete major feature in your domain
- [ ] Document any architectural decisions
- [ ] Mentor any newer team members

### Resources

| Resource | URL |
|----------|-----|
| React Native Docs | https://reactnative.dev |
| Expo Docs | https://docs.expo.dev |
| Next.js Docs | https://nextjs.org/docs |
| Supabase Docs | https://supabase.com/docs |
| TypeScript Handbook | https://www.typescriptlang.org/docs |
| TailwindCSS | https://tailwindcss.com/docs |

---

## Emergency Contacts

| Situation | Contact | Method |
|-----------|---------|--------|
| Blocked on task | Review Pair | Slack DM |
| Production issue | Team Lead | Slack @channel |
| Access issues | Team Lead | Email + Slack |
| Security concern | Team Lead | Private DM immediately |

---

*Checklist completed on: _____________ (Date)*

*Team Lead sign-off: _____________ (Signature)*
