---
name: Pull Request
about: Submit code changes for review
title: "[DOMAIN] Brief description"
labels: ''
assignees: ''
---

## 📋 PR Type
<!-- Check all that apply -->
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [ ] 📝 Documentation update
- [ ] 🔧 Refactoring (no functional changes)
- [ ] 🧪 Test addition/update
- [ ] 🎨 Style/UI change

## 🎯 Domain
<!-- Select your domain -->
- [ ] Auth & Core (Dev 1)
- [ ] AI Engine (Dev 2)
- [ ] AI UI/Voice (Dev 3)
- [ ] Principal/School (Dev 4)
- [ ] Teacher (Dev 5)
- [ ] Parent Portal (Dev 6)
- [ ] Membership/SOA (Dev 7)
- [ ] Payments (Dev 8)
- [ ] Messaging/Calls (Dev 9)
- [ ] Web (Dev 10)
- [ ] Cross-domain / Shared

## 📝 Description
<!-- Clearly describe WHAT this PR does and WHY -->



## 🔗 Related Issues
<!-- Link any related issues using #issue-number -->
Closes #

## 🧪 How Has This Been Tested?
<!-- Describe your testing approach -->
- [ ] Tested on Android device/emulator
- [ ] Tested on iOS device/simulator
- [ ] Tested on Web (if applicable)
- [ ] Unit tests added/updated
- [ ] Manual testing completed

**Test Configuration:**
- Device/Emulator: 
- OS Version: 
- App Version: 

## 📸 Screenshots/Videos
<!-- If UI changes, add screenshots or screen recordings -->
| Before | After |
|--------|-------|
|        |       |

## ✅ Pre-Submission Checklist
<!-- Complete ALL items before requesting review -->

### Code Quality
- [ ] I have performed a self-review of my code
- [ ] My code follows the project's style guidelines
- [ ] I have run `npm run typecheck` - **PASSED**
- [ ] I have run `npm run lint` - **PASSED**
- [ ] I have run `npm run check:console` - **No console.log statements**
- [ ] I have run `npm run check:file-sizes` - **All files within limits**

### Documentation
- [ ] I have commented my code where necessary (especially complex logic)
- [ ] I have updated relevant documentation
- [ ] My PR description clearly explains WHAT and WHY

### Security (if applicable)
- [ ] No secrets/API keys in the code
- [ ] User input is properly validated
- [ ] RLS policies are respected
- [ ] No service role key exposed client-side

### Database (if applicable)
- [ ] Migration created using `supabase migration new`
- [ ] SQL linted with `npm run lint:sql`
- [ ] RLS policies added for new tables
- [ ] No direct SQL execution in Supabase dashboard

### Feature Flag (if new feature)
- [ ] Feature flag added to `config/featureFlags.ts`
- [ ] Feature flag set to `enabled: false` initially
- [ ] Feature can be toggled without code changes

## 🚀 Deployment Notes
<!-- Any special instructions for deployment? -->
- [ ] Requires OTA update only
- [ ] Requires native build
- [ ] Requires database migration
- [ ] Requires environment variable changes
- [ ] No special deployment needed

## 📊 Impact Assessment
<!-- How does this change affect the app? -->

### Performance Impact
- [ ] No performance impact
- [ ] Minor performance improvement
- [ ] Minor performance regression (justified because: ___)
- [ ] Significant performance change (details below)

### Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes (migration path documented below)

## 💬 Additional Notes
<!-- Anything else reviewers should know? -->



---

## 👀 Reviewer Notes
<!-- For reviewers - fill this section during review -->

### Review Checklist
- [ ] Code logic is correct
- [ ] Error handling is appropriate
- [ ] No security concerns
- [ ] Performance is acceptable
- [ ] Tests are adequate
- [ ] Documentation is sufficient

### Feedback
<!-- Reviewer comments here -->
