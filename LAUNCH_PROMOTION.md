# 🔥 LAUNCH PROMOTION ACTIVATED!

## Promotional Pricing (Limited Time)

### Special Offer Details
- **Duration**: Now until December 31, 2025
- **Discount**: 50% OFF Forever (locked-in pricing)
- **Target**: Parent plans only

### Pricing Structure

#### Parent Starter
- **Original Price**: R99.00/month
- **Promotional Price**: R49.99/month ✨
- **Savings**: R49.01/month (50% OFF)
- **Features**: 30 Homework Helper/month, AI lesson support, Progress tracking

#### Parent Plus
- **Original Price**: R199.00/month
- **Promotional Price**: R149.99/month ✨
- **Savings**: R49.01/month (50% OFF)
- **Features**: 100 Homework Helper/month, Priority processing, Up to 3 children, Advanced insights

### Marketing Copy

**Main Banner:**
> 🔥 LAUNCH SPECIAL: 50% OFF FOREVER!
> Lock in these prices for life • Offer ends December 31, 2025

**Value Proposition:**
- These promotional prices are **locked in for life**
- No price increases for early adopters
- After Dec 31, 2025, prices return to R99 and R199

### Implementation

✅ **Pricing Page** (`/pricing`)
- Red gradient promo banner at top
- "50% OFF" badge on promotional plans
- Original price shown with strikethrough
- Savings amount highlighted in green
- Fire and lightning emojis for visual impact

✅ **Subscription Page** (`/dashboard/parent/subscription`)
- Promo alert banner for free/trial users
- Direct call-to-action to view special pricing
- Urgency messaging with end date

✅ **PayFast Integration**
- Updated tier pricing in `lib/payfast.ts` to R49.99 and R149.99
- Webhook configured to handle promotional tiers correctly

### Conversion Psychology Elements

1. **Scarcity**: "Offer ends December 31, 2025"
2. **Urgency**: Fire and clock emojis, limited time messaging
3. **Value**: "Lock in for life" - grandfathering promise
4. **Social Proof**: "MOST POPULAR" badge on Parent Starter
5. **Loss Aversion**: Showing savings amount (R49.01/mo)
6. **Visual Hierarchy**: Red gradient banner stands out immediately

### After Promotion Ends

On January 1, 2026:
1. Remove `originalPrice` fields from plan definitions
2. Update prices back to R99.00 and R199.00
3. Remove promo banners
4. Existing subscribers keep their R49.99/R149.99 pricing forever

### A/B Testing Recommendations

Consider testing:
- Different end dates (urgency vs. comfort)
- "First 100 customers" instead of date-based
- Different discount percentages (40% vs 50%)
- Countdown timer for last 48 hours

---

**Status**: ✅ LIVE - Promotional pricing active across all pages
