# Tier Name Alignment Summary

## Overview
Updated all database tier names to match user-facing product names for consistency across the platform.

## Tier Name Changes

### Parent Tiers
| Old Name | New Name | Product Name | Monthly Price |
|----------|----------|--------------|---------------|
| `basic` | `parent_starter` | Parent Starter | R99.00 |
| `premium` | `parent_plus` | Parent Plus | R199.00 |

### Teacher Tiers
| Old Name | New Name | Product Name | Monthly Price |
|----------|----------|--------------|---------------|
| `teacher_basic` | `teacher_starter` | Teacher Starter | R149.00 |
| _(new)_ | `teacher_pro` | Teacher Pro | R299.00 |

### School Tiers
| Old Name | New Name | Product Name | Monthly Price |
|----------|----------|--------------|---------------|
| `starter` | `school_starter` | School Starter | R299.00 |
| `premium` | `school_premium` | School Premium | R499.00 |
| `pro` | `school_pro` | School Pro | R899.00 |
| `enterprise` | `school_enterprise` | School Enterprise | R1999.00 |

### System Tiers (Unchanged)
| Tier Name | Purpose |
|-----------|---------|
| `free` | Default free tier for all new users |
| `trial` | 7-day trial tier with elevated limits |

## Promotional Pricing (Dec 31, 2025 Deadline)

### Parents - 50% OFF for 6 months
- **Parent Starter**: R99 → **R49.50/month** for 6 months
- **Parent Plus**: R199 → **R99.50/month** for 6 months

### Teachers - 40% OFF for 6 months
- **Teacher Starter**: R149 → **R89.40/month** for 6 months
- **Teacher Pro**: R299 → **R179.40/month** for 6 months

### Schools - 3 Months FREE + 25% OFF for 9 months
- **School Starter**: R299/month → FREE for 3 months, then **R224.25/month** for 9 months
- **School Premium**: R499/month → FREE for 3 months, then **R374.25/month** for 9 months
- **School Pro**: R899/month → FREE for 3 months, then **R674.25/month** for 9 months
- **School Enterprise**: R1999/month → FREE for 3 months, then **R1499.25/month** for 9 months

## Database Changes

### Tables Updated
1. ✅ `ai_usage_tiers` - Tier definitions and pricing
2. ✅ `user_ai_tiers` - User tier assignments
3. ✅ `user_ai_usage` - Current usage tracking
4. ✅ `subscription_plans` - Subscription plan tiers
5. ✅ `promotional_campaigns` - Promo tier filters
6. ✅ `user_promotional_subscriptions` - User promo tracking

### Migrations Created
1. **20251116_tier_name_alignment.sql** - Core tier renaming migration
2. **20251116_promotional_pricing_system.sql** - Promotional campaign system (updated with new tier names)

## Code Changes

### TypeScript Files Updated
1. ✅ `web/src/lib/payfast.ts` - Payment integration
2. ✅ `web/src/lib/promotional-pricing.ts` - Promotional pricing helpers
3. ✅ `web/src/app/pricing/page.tsx` - Pricing page (promo banner updated to 6 months)
4. ✅ `web/src/app/dashboard/parent/subscription/page.tsx` - Subscription management

### Type Definitions
```typescript
// Parent tiers
type ParentTier = 'parent_starter' | 'parent_plus';

// Teacher tiers
type TeacherTier = 'teacher_starter' | 'teacher_pro';

// School tiers
type SchoolTier = 'school_starter' | 'school_premium' | 'school_pro' | 'school_enterprise';

// All tiers
type AllTiers = 'free' | 'trial' | ParentTier | TeacherTier | SchoolTier;
```

## Migration Instructions

### 1. Run Database Migrations
```bash
# In Supabase SQL Editor or via CLI
# Run in this order:
\i supabase/migrations/20251116_tier_name_alignment.sql
\i supabase/migrations/20251116_promotional_pricing_system.sql
```

### 2. Verify Migration
```sql
-- Check tier structure
SELECT tier_name, monthly_price_zar, exams_per_month 
FROM ai_usage_tiers 
WHERE is_active = true 
ORDER BY monthly_price_zar;

-- Check user distribution
SELECT tier::text, count(*) as user_count 
FROM user_ai_tiers 
GROUP BY tier 
ORDER BY user_count DESC;

-- Check promotional campaigns
SELECT code, name, tier_filter, discount_value, end_date 
FROM promotional_campaigns 
WHERE is_active = true;
```

### 3. Update Any Custom Queries
Replace old tier names in any custom SQL queries:
- `basic` → `parent_starter`
- `premium` → `parent_plus`
- `teacher_basic` → `teacher_starter`
- `starter` → `school_starter`
- `pro` → `school_pro`
- `enterprise` → `school_enterprise`

## Testing Checklist

- [ ] Run tier alignment migration
- [ ] Run promotional pricing migration
- [ ] Verify all users have updated tier names
- [ ] Test promotional price calculation for parents
- [ ] Test promotional price calculation for teachers
- [ ] Test promotional price calculation for schools
- [ ] Test PayFast payment flow with new tier names
- [ ] Verify pricing page displays correct amounts
- [ ] Check subscription dashboard shows promo details
- [ ] Test tier upgrade/downgrade with new names

## Benefits

1. **Consistency**: Database tier names now match UI labels exactly
2. **Clarity**: `parent_starter` is clearer than `basic` (which could mean anything)
3. **Scalability**: Easy to add new tiers per user type (e.g., `teacher_enterprise`)
4. **Marketing**: Tier names reinforce product positioning
5. **Maintainability**: Less confusion when debugging tier-related issues

## Next Steps

1. Deploy migrations to staging environment
2. Test all payment flows
3. Verify promo pricing calculations
4. Deploy to production before Dec 31, 2025 promo deadline
5. Monitor user signups and tier distribution
6. Track promotional campaign usage

