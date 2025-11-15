# EduDash Pro - Critical Issues & Action Plan
**Date**: November 15, 2025
**Status**: Analysis Complete

## 🔍 System Scan Results

### ✅ Working Well
1. **PWA Update System** - Service worker updates every 30s, auto-reload after 10s
2. **Deployment Notifications** - Push notification subscription working
3. **TypeScript Strict Mode** - Enabled and type errors fixed
4. **Chat Refactoring** - New modular structure with ChatInput, ChatMessages components
5. **Voice Recording** - useVoiceRecording hook implemented

---

## 🚨 CRITICAL ISSUES IDENTIFIED

### 1. **AI Quota System - INCOMPLETE INTEGRATION** ❌

**Problem**: Multiple quota systems exist but not properly connected

**Current State**:
- ✅ Database tables exist: `user_ai_usage`, `ai_usage_tiers`, `ai_usage_logs`
- ✅ SQL functions: `check_ai_usage_limit()`, `increment_ai_usage()`
- ✅ Edge function quota checker: `supabase/functions/ai-proxy/security/quota-checker.ts`
- ❌ **Frontend NOT calling quota check before AI requests**
- ❌ **Quota increments NOT being called after successful requests**
- ❌ **No visual quota display in parent dashboard**

**Files Affected**:
- `web/src/app/dashboard/parent/standalone/page.tsx` - Has TODO for AI usage stats
- `web/src/components/dashboard/exam-prep/ExamPrepWidget.tsx` - No quota check
- `web/src/components/dash-chat/ChatInterface.tsx` - No quota tracking

**Action Required**:
```typescript
// Need to add quota check before AI calls:
const { data: quotaCheck } = await supabase.rpc('check_ai_usage_limit', {
  p_user_id: userId,
  p_request_type: 'chat_message' // or 'exam_generation', 'explanation'
});

if (!quotaCheck.allowed) {
  // Show upgrade modal
  return;
}

// After successful AI response:
await supabase.rpc('increment_ai_usage', {
  p_user_id: userId,
  p_request_type: 'chat_message',
  p_status: 'success'
});
```

---

### 2. **PayFast Integration - PARTIALLY IMPLEMENTED** ⚠️

**Current State**:
- ✅ Webhook endpoint: `/api/payfast/webhook/route.ts` with signature verification
- ✅ Payment creation: `/api/payfast/create-payment/route.ts`
- ✅ Upgrade page: `/dashboard/parent/upgrade/page.tsx`
- ❌ **Updates wrong table**: Updates `user_ai_usage.current_tier` instead of `user_ai_tiers`
- ❌ **No subscription cancellation flow**
- ❌ **Missing environment variables** in `.env.example` (now fixed)
- ⚠️ **Using sandbox URL by default** (correct for testing, needs prod URL for live)

**Issues in Webhook**:
```typescript
// WRONG - updates user_ai_usage table:
await supabaseAdmin
  .from('user_ai_usage')
  .upsert({ user_id, current_tier: tier })

// SHOULD update user_ai_tiers table:
await supabaseAdmin
  .from('user_ai_tiers')
  .upsert({
    user_id,
    tier: tier.toUpperCase(), // 'FREE', 'BASIC', 'PREMIUM'
    assigned_reason: 'PayFast subscription',
    is_active: true
  })
```

**Missing Features**:
- Subscription renewal handling
- Cancellation webhook processing
- Failed payment handling
- Subscription status page

---

### 3. **Tier Badge & Upgrade Flow - NEEDS WORK** ⚠️

**Current State**:
- ✅ `TierBadge` component exists
- ✅ Shows upgrade button
- ❌ **Not connected to actual quota data**
- ❌ **No real-time tier updates after payment**

**Action Required**:
- Connect TierBadge to `user_ai_tiers` table
- Add real-time subscription to detect tier changes
- Show quota remaining in badge tooltip

---

### 4. **Interactive Learning Features - GOOD BUT CAN IMPROVE** ✅➕

**Existing Interactive Features**:
- ✅ Voice input in Dash Chat (useVoiceRecording hook)
- ✅ Image upload for homework help
- ✅ Interactive exam view with checkboxes
- ✅ PDF export for exams and lessons
- ✅ Real-time chat with streaming responses

**Enhancement Opportunities**:
1. **Gamification**:
   - Add XP/points for completed homework
   - Achievement badges for learning milestones
   - Daily streak tracking
   
2. **Interactive Exercises**:
   - Drag-and-drop matching games
   - Fill-in-the-blank with instant feedback
   - Multiple choice with explanations
   - Drawing/annotation tools for math problems
   
3. **Visual Learning**:
   - Animated explanations for complex topics
   - Interactive diagrams (already has Mermaid support!)
   - Video integration for lessons
   
4. **Social Learning**:
   - Peer study groups
   - Parent-child learning sessions
   - Teacher feedback loops

---

## 📋 RECOMMENDED PRIORITIES

### **PHASE 1: Critical Fixes** ✅ COMPLETED

1. ✅ **Fix PayFast Webhook** - Updated to use `user_ai_tiers` table (both uppercase TIER and lowercase tier)
2. ✅ **Implement Quota Checks** - Added useQuotaCheck hook with RPC integration
3. ✅ **Visual Quota Display** - QuotaCard component with progress bars
4. ✅ **Dash Chat Integration** - Quota checks on all chat messages

### **PHASE 2: Complete Upgrade System** ✅ COMPLETED

5. ✅ **Subscription Management Page** - Full page at `/dashboard/parent/subscription`
6. ✅ **Quota Enforcement** - All AI features block when limit reached
   - Exam generation
   - Answer explanations
   - Chat messages
7. ✅ **Upgrade Prompts** - Alert modals with tier-specific messaging
8. ✅ **Real-time Tier Updates** - useTierUpdates hook with Supabase real-time

### **PHASE 3: Enhanced Interactivity** 🎮 (Future)

9. **Gamification System** - XP, badges, streaks
10. **Interactive Exercises** - Drag-drop, fill-in-blank
11. **Progress Visualization** - Charts, graphs, animations
12. **Collaborative Features** - Study groups, shared notes

---

## 📊 Database Schema Status

### Tables Verified:
- ✅ `user_ai_usage` - Tracks monthly/daily usage counters
- ✅ `ai_usage_tiers` - Tier configurations (free, trial, basic, premium, school)
- ✅ `user_ai_tiers` - User tier assignments
- ✅ `ai_request_log` - Request logging and analytics
- ✅ `ai_usage_logs` - Edge function logging
- ✅ `subscriptions` - Payment records (created by webhook)

### RLS Policies:
- ✅ Users can view own usage
- ✅ Anyone can view tier limits
- ✅ Service role has full access

---

## 🧪 Testing Checklist

### PWA & Notifications:
- [x] Service worker updates automatically
- [x] Update banner appears
- [x] Auto-reload after 15s
- [x] Push notification subscription works
- [ ] Deployment notifications received (needs backend trigger)

### Quota System:
- [x] useQuotaCheck hook implemented
- [x] check_ai_usage_limit RPC function
- [x] increment_ai_usage RPC function
- [x] Exam generation quota enforcement
- [x] Explanation quota enforcement
- [x] Chat message quota enforcement
- [x] QuotaCard widget displays usage
- [x] Tier-specific limits enforced

### Subscription System:
- [x] Subscription management page
- [x] Current plan display
- [x] Usage statistics with progress bars
- [x] Payment history table
- [x] Available plans comparison
- [x] Links from settings and quota widget
- [x] Real-time tier update detection

### PayFast Integration:
- [x] Webhook updates user_ai_tiers (uppercase)
- [x] Webhook updates user_ai_usage (lowercase)
- [x] Signature validation
- [x] Subscription records created
- [ ] Live payment testing (requires PayFast credentials)
- [x] Real-time tier change broadcast
- [x] User sees upgraded features immediately

---

## 🎉 COMPLETED IMPLEMENTATIONS

### Phase 1 Deliverables (Commit: fe50030)
- **PayFast Webhook Fix**: Now correctly updates both `user_ai_tiers.tier` and `user_ai_usage.current_tier`
- **useQuotaCheck Hook**: Complete quota management system
  - `checkQuota(requestType)` - Validates against limits
  - `incrementUsage(requestType, status)` - Tracks usage
  - `refreshUsage()` - Reloads current data
- **QuotaCard Component**: Visual usage display
  - Color-coded progress bars (green → orange → red)
  - Shows exams, explanations, chat usage
  - Tier badge and upgrade link
- **Dash Chat Integration**: Full quota enforcement on chat messages

### Phase 2A Deliverables (Commit: 06e5570)
- **Exam Generation Quota**: ExamPrepWidget now checks quota before generation
- **Usage Increment**: Tracks successful exam generations
- **Guest Mode**: Unaffected by quota checks
- **userId Propagation**: Passed through all parent components

### Phase 2B Deliverables (Commit: 9510d2f)
- **Explanation Quota**: ExamInteractiveView checks quota before AI explanations
- **Usage Tracking**: Increments after successful explanations
- **AskAIWidget Updates**: Accepts and passes userId prop
- **Complete Coverage**: All AI features now quota-protected

### Phase 2C Deliverables (Commit: 1cac790)
- **Subscription Page**: `/dashboard/parent/subscription`
  - Current plan card with tier icon, pricing, features
  - Usage stats grid (3 progress bars)
  - Payment history table with status indicators
  - Available plans comparison cards
- **Navigation Integration**:
  - Link in settings page
  - Link in QuotaCard widget
  - Redirects to pricing for upgrades

### Phase 2D Deliverables (Commit: ae0bf1b)
- **useTierUpdates Hook**: Supabase real-time subscriptions
  - Listens to `user_ai_tiers` table changes
  - Auto-refreshes quota data on tier change
  - Shows alert notification on upgrade
  - No page reload needed
- **Integration**: Added to parent dashboard and subscription page

---

## 📂 New Files Created

### Hooks
- `web/src/hooks/useQuotaCheck.ts` - Quota management hook
- `web/src/hooks/useTierUpdates.ts` - Real-time tier change listener

### Components
- `web/src/components/dashboard/QuotaCard.tsx` - Visual usage widget

### Pages
- `web/src/app/dashboard/parent/subscription/page.tsx` - Full subscription management

### Modified Files (Key Changes)
- `web/src/app/api/payfast/webhook/route.ts` - Fixed tier table updates
- `web/src/hooks/useChatLogic.ts` - Added quota checks
- `web/src/components/dashboard/exam-prep/ExamPrepWidget.tsx` - Quota enforcement
- `web/src/components/dashboard/exam-prep/ExamInteractiveView.tsx` - Explanation quotas
- `web/src/components/PWAUpdateChecker.tsx` - Fixed update detection
- `web/public/sw.js` - Enhanced logging

### Quota System:
- [ ] Check quota before AI request
- [ ] Increment counter after success
- [ ] Show remaining quota in UI
- [ ] Block requests when limit reached
- [ ] Upgrade prompt appears when blocked

---

## 🛠️ Quick Wins (Easy Improvements)

1. **Add Quota Widget to Dashboard** (30 min)
   ```tsx
   <QuotaCard 
     used={usage.exams_generated_this_month}
     limit={tierLimits.exams_per_month}
     label="Exams Generated"
   />
   ```

2. **Show Upgrade Modal on Quota Exceeded** (20 min)
   ```tsx
   if (!quotaCheck.allowed) {
     showUpgradeModal({ 
       message: `You've used all ${quotaCheck.limit} exams this month`,
       tier: quotaCheck.current_tier
     });
   }
   ```

3. **Add Success Notification After Payment** (15 min)
   ```tsx
   // On /dashboard/parent/upgrade/success page
   toast.success(`Welcome to ${tier} plan! Your new features are now active.`);
   ```

4. **Interactive Exam Feedback** (45 min)
   - Add confetti animation when exam completed
   - Show score percentage with animated counter
   - Display correct answers vs submitted answers

---

## 📝 Code Examples for Critical Fixes

### Fix 1: PayFast Webhook (Update to user_ai_tiers)
```typescript
// In /web/src/app/api/payfast/webhook/route.ts
if (payment_status === 'COMPLETE') {
  // FIX: Update user_ai_tiers instead of user_ai_usage
  const { error: tierError } = await supabaseAdmin
    .from('user_ai_tiers')
    .upsert({
      user_id,
      tier: tier.toUpperCase(), // 'BASIC', 'PREMIUM', etc.
      assigned_reason: `PayFast payment ${data.pf_payment_id}`,
      is_active: true,
      metadata: { payment_id: data.m_payment_id }
    }, { onConflict: 'user_id' });
}
```

### Fix 2: Add Quota Check Hook
```typescript
// Create /web/src/hooks/useQuotaCheck.ts
export function useQuotaCheck() {
  const checkQuota = async (requestType: 'exam_generation' | 'explanation' | 'chat_message') => {
    const { data, error } = await supabase.rpc('check_ai_usage_limit', {
      p_user_id: userId,
      p_request_type: requestType
    });
    
    return { allowed: data?.allowed, remaining: data?.remaining };
  };
  
  return { checkQuota };
}
```

---

## 🎯 Next Steps

1. **Review this document** and prioritize fixes
2. **Start with Phase 1** (PayFast webhook + quota checks)
3. **Test payment flow** with PayFast sandbox
4. **Deploy fixes** incrementally
5. **Move to Phase 2** after Phase 1 is stable

---

**Total Issues Found**: 4 critical, 3 medium priority
**Estimated Fix Time**: 
- Phase 1: 4-6 hours
- Phase 2: 8-10 hours  
- Phase 3: 20+ hours

**Recommended Start**: Fix PayFast webhook + implement quota checks (highest impact)
