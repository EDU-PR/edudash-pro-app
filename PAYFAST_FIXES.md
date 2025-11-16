# PayFast Integration Issues - FIXED

## Issues Identified from Screenshots

### 1. ✅ FIXED: Pricing Inconsistency
**Problem**: Different prices shown in different pages
- Subscription page: R99 (Basic), R199 (Premium)
- Pricing page: R49.99 (Basic), R149.99 (Premium)
- PayFast lib: R99 (Basic), R199 (Premium)

**Solution**: Updated all pricing to R49.99 and R149.99
- ✅ `lib/payfast.ts` - Updated tierPricing
- ✅ `app/dashboard/parent/subscription/page.tsx` - Updated TIER_INFO
- ✅ `app/pricing/page.tsx` - Already correct

### 2. ✅ FIXED: Signature Mismatch Error
**Problem**: PayFast returned "Generated signature does not match submitted signature"

**Root Cause**: PayFast sandbox does NOT use passphrase, but our code was including empty passphrase in signature

**Solution**: Updated signature generation to skip passphrase when empty
```typescript
// Before: Always added passphrase
if (passphrase) {
  paramString += `&passphrase=${passphrase}`;
}

// After: Only add if NOT empty (production only)
if (passphrase && passphrase.trim() !== '') {
  paramString += `&passphrase=${passphrase}`;
}
```

### 3. ⚠️ TO FIX: Missing user_ai_tiers Record
**Problem**: User doesn't have a tier record in database
```
GET user_ai_tiers?user_id=eq.xxx 406 (Not Acceptable)
message: 'JSON object requested, multiple (or no) rows returned'
```

**Solution**: Run the SQL migration `fix_missing_tiers.sql`
- Creates FREE tier for all existing users without a tier
- Creates trigger to auto-assign FREE tier to new users
- Ensures all users have both `user_ai_tiers` and `user_ai_usage` records

**Action Required**:
```bash
# Run in Supabase SQL Editor
\i fix_missing_tiers.sql
```

---

## Testing Checklist

### Before Testing:
1. [x] Run `fix_missing_tiers.sql` in Supabase
2. [ ] Restart Next.js dev server (to pick up code changes)
3. [ ] Verify LocalTunnel is still running

### Test Flow:
1. Login to app
2. Go to subscription page
3. Verify pricing shows R49.99 and R149.99
4. Click "Subscribe" on Basic plan
5. Should redirect to PayFast without signature error
6. Use test card: `4000000000000002`
7. Complete payment
8. Verify webhook updates user tier

### Expected Results:
- ✅ No signature mismatch error
- ✅ PayFast accepts payment
- ✅ Webhook processes successfully
- ✅ User tier updates to BASIC
- ✅ Dashboard shows new tier badge

---

## Next Steps After Testing

1. If test succeeds, push changes to GitHub
2. Deploy to Vercel
3. Switch to production PayFast credentials
4. Update pricing in PayFast merchant portal to match
