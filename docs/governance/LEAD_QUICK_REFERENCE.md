# Team Lead Quick Reference Card

> Print this or keep it handy for daily team management

---

## 🕐 Daily Schedule

| Time | Activity | Duration |
|------|----------|----------|
| 9:00 AM | Pod A Standup (Core: Dev 1,2,3) | 15 min |
| 9:30 AM | Pod B Standup (Features: Dev 4,5,6,7,8,9) | 15 min |
| 10:00 AM | Pod C Standup (Web: Dev 10) | 10 min |
| 10:30 AM | PR Review Block | 1-2 hours |
| Afternoon | 1:1s (2-3 per day) | 30 min each |
| 4:00 PM | End-of-day PR sweep | 30 min |

---

## 🚨 Red Flags to Watch

### In Code Reviews

| Flag | Action |
|------|--------|
| `any` type usage | Block PR - request proper types |
| `console.log` | Block PR - use logger |
| File > 500 lines | Block PR - must split |
| Missing error handling | Request changes |
| Hardcoded secrets | **IMMEDIATE BLOCK** - security review |
| Service role key client-side | **IMMEDIATE BLOCK** |
| Missing RLS filter | Block PR - add organization filter |
| N+1 database queries | Request optimization |

### In Standups

| Flag | Action |
|------|--------|
| "Blocked" 2+ days | Escalate, pair program |
| "Almost done" 3+ days | Check actual progress |
| Same task all week | Break into smaller tasks |
| No questions ever | Encourage questions, may be struggling silently |
| Vague updates | Ask for specifics |

### In PRs

| Flag | Action |
|------|--------|
| PR > 500 lines | Request split |
| No tests for new logic | Request tests |
| No PR description | Return for details |
| Modifies multiple domains | Verify with both owners |
| Changes shared types | Extra scrutiny |

---

## ✅ PR Review Shortcuts

### Quick Approve Criteria
- Bug fix < 50 lines
- Documentation only
- Style/formatting
- Test addition (no logic change)

### Require Deep Review
- Auth/security changes
- Payment code
- Database migrations
- Shared component changes
- Cross-domain changes

### Auto-Block
- Failing CI checks
- Missing typecheck/lint
- Secrets in code
- Breaking changes without migration

---

## 📊 Team Health Metrics

### Weekly Tracking

| Metric | Target | Current |
|--------|--------|---------|
| PRs merged | 15-20 | ____ |
| Avg PR review time | < 24h | ____ |
| Bugs introduced | < 3 | ____ |
| Blockers resolved | 100% | ____ |
| Standup attendance | 100% | ____ |

### Per-Developer Tracking

| Dev | PRs/Week | Avg Quality | Blockers | Notes |
|-----|----------|-------------|----------|-------|
| Dev 1 | | | | |
| Dev 2 | | | | |
| Dev 3 | | | | |
| Dev 4 | | | | |
| Dev 5 | | | | |
| Dev 6 | | | | |
| Dev 7 | | | | |
| Dev 8 | | | | |
| Dev 9 | | | | |
| Dev 10 | | | | |

---

## 🔧 Common Commands

```bash
# Check if code is ready for review
npm run typecheck && npm run lint && npm run check:console

# Deploy OTA update (after PR merged)
npm run ota:playstore

# Create database migration
supabase migration new <name>

# Check database drift
supabase db diff

# View all feature flags status
grep -A3 "enabled:" config/featureFlags.ts
```

---

## 📞 Escalation Contacts

| Issue | Contact |
|-------|---------|
| Production down | You + on-call |
| Security breach | You + security team |
| Database issue | You + Supabase support |
| AI service down | Dev 2 + Anthropic status |
| Payment failure | Dev 8 + PayFast support |

---

## 🎯 Sprint Planning Template

### Sprint Goals (2 weeks)
1. _________________________________
2. _________________________________
3. _________________________________

### Feature Flag Targets
| Flag | Status End of Sprint |
|------|---------------------|
| | |
| | |

### Risk Items
| Risk | Mitigation |
|------|------------|
| | |

---

## 💬 1:1 Questions

### Weekly 1:1
1. What's going well?
2. What's challenging?
3. What do you need from me?
4. Anything blocking you?

### Monthly 1:1
1. How are you progressing toward your goals?
2. What skills do you want to develop?
3. What feedback do you have for me?
4. Are you happy on this project?

---

## 🏆 Recognition Ideas

- Shoutout in weekly sync for great PRs
- "Clean Code" award for best refactor
- "Bug Squasher" for fixing tricky bugs
- "Knowledge Sharer" for best documentation
- "Team Player" for helping others

---

*Last updated: January 6, 2026*
