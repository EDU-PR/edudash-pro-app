# EduDashPro Community School

## Overview

**EduDashPro Community School** is a digital-first educational platform designed for independent learners and families not affiliated with a traditional preschool or school organization.

### Focus Areas
- 🤖 **Robotics** - Build and program robots
- 🧠 **Artificial Intelligence** - Understand AI concepts and applications
- 📊 **Data Science** - Learn data analysis and visualization
- 💻 **Frontend Development** - Web and mobile UI/UX
- ⚙️ **Backend Development** - Server-side programming and databases
- 📱 **Digital Literacy** - Digital awareness and online safety

## Business Model

### Free Tier (Ad-Supported)
Community School users on the free tier receive:
- **Limited daily AI features** to manage costs
- **Ad-supported experience** to generate revenue
- Full access to digital learning content

### Revenue Strategy
```
Free Users → View Ads → Ad Revenue → Cover AI API Costs
```

## Free Tier Quotas

Community parents get the following **daily/monthly limits**:

| Feature | Free Tier Limit | Period |
|---------|----------------|---------|
| Exams | 3 | Per Month |
| Explanations | 5 | Per Month |
| Chat Messages | 10 | Per Day |

These limits are designed to:
1. Provide meaningful learning value
2. Keep AI API costs sustainable
3. Encourage upgrades to paid tiers for heavy users

## Ad Integration

### Current Setup
- **Platform**: Google AdMob
- **Environment**: Test IDs (development)
- **Targeting**: Free tier users only
- **Platform**: Android-first (iOS coming soon)

### Ad Types & Frequency
- **Banner Ads**: Shown on free tier screens
- **Interstitial Ads**: Max 3 per day, 2-minute intervals
- **Rewarded Ads**: Max 2 per day (e.g., unlock extra AI requests)

### Rate Limiting
```typescript
RATE_LIMITS = {
  interstitialMinInterval: 2 * 60 * 1000, // 2 minutes
  interstitialMaxPerDay: 3,
  rewardedMaxPerDay: 2,
  initialGracePeriod: 60 * 1000, // 1 minute after app start
}
```

## User Experience

### For Community Parents (Free Tier)
1. **Sign Up** → Auto-join Community School
2. **Add Children** → Access digital curriculum
3. **Daily AI Limits** → 10 chat messages/day
4. **View Ads** → Support free access
5. **Optional Upgrade** → Remove ads, increase limits

### Upgrade Path
```
Free (Ad-Supported)
  ↓
Parent Starter (R299/month)
  ↓  
Parent Plus (R499/month)
```

## Technical Implementation

### Database Flags
Community School users are identified by:
```typescript
profile.preschoolId === null  // No organization affiliation
profile.subscription_tier === 'free'  // Free tier
```

### Quota Enforcement
- Enforced in `/web/src/hooks/useQuotaCheck.ts`
- Checked before AI API calls in Edge Functions
- Daily reset via scheduled jobs

### Ad Display Logic
```typescript
shouldShowAds = tier === 'free' && Platform.OS === 'android'
```

## Messaging Updates

### Before
- "EduDash Pro Community" (generic)
- "Add your children to access personalized learning tools"

### After  
- "EduDashPro Community School" (branded as school)
- "Explore Robotics, AI, Data Science, Frontend & Backend Development"
- "Free tier includes daily AI assistance supported by ads"

## Configuration Files

| File | Purpose |
|------|---------|
| `/lib/ai/capabilities.ts` | Defines free tier AI features |
| `/contexts/AdsContext.tsx` | Manages ad display logic |
| `/lib/adMob.ts` | AdMob integration & test IDs |
| `/hooks/useQuotaCheck.ts` | Enforces usage limits |
| `/components/dashboard/QuotaCard.tsx` | Displays usage to users |

## Future Enhancements

### Phase 1 (Current)
- ✅ Free tier with daily AI limits
- ✅ AdMob integration (test mode)
- ✅ Digital-first branding
- ✅ Android support

### Phase 2 (Next)
- [ ] Production AdMob IDs
- [ ] iOS ad support
- [ ] Rewarded ads for bonus AI requests
- [ ] A/B test ad frequency

### Phase 3 (Future)
- [ ] Sponsorship model (Coding bootcamps, edtech brands)
- [ ] Premium digital courses (paid add-ons)
- [ ] Certification programs
- [ ] Community challenges & competitions

## Monitoring & Analytics

### Key Metrics to Track
1. **Ad Revenue**: Daily/monthly earnings from AdMob
2. **AI Costs**: Daily Claude API costs for free tier
3. **Conversion Rate**: Free → Paid upgrade %
4. **Engagement**: Daily active users, retention
5. **Ad Performance**: CTR, fill rate, eCPM

### Profitability Formula
```
Profit = (Ad Revenue + Subscription Revenue) - (AI Costs + Infrastructure)
```

## Support & Documentation

### User-Facing
- Explain ad-supported model in signup flow
- Show "ad-supported" labels on free tier features
- Provide clear upgrade prompts when limits reached

### Developer References
- See `/docs/features/AI_QUOTAS.md` for quota system
- See `/lib/ai/capabilities.ts` for tier features
- See `WARP.md` for development standards

---

**Last Updated**: November 24, 2025  
**Status**: ✅ Branding Complete, AdMob in Test Mode
