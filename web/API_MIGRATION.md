# API Route Migration Guide

## PayFast API Routes Removed

The following Next.js API routes have been removed and migrated to Supabase Edge Functions:

### Removed Routes

| Old Route | New Edge Function | Status |
|-----------|------------------|---------|
| `/api/payfast/create-payment` | `payfast-create-payment` | ✅ Migrated |
| `/api/payfast/webhook` | `payfast-webhook` | ✅ Exists (kept for compatibility) |

### Migration Steps

1. **Update client code** to use Supabase client instead of fetch
2. **Remove API route imports** from your components
3. **Test payment flow** in sandbox environment
4. **Monitor logs** for any remaining API route calls

### Example Migration

**Before:**
```typescript
const response = await fetch('/api/payfast/create-payment', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    user_id: userId,
    tier: tier,
    amount: 299,
    email: userEmail,
    itemName: 'Premium Subscription'
  })
});
const data = await response.json();
```

**After:**
```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

const { data, error } = await supabase.functions.invoke('payfast-create-payment', {
  body: {
    user_id: userId,
    tier: tier,
    amount: 299,
    email: userEmail,
    itemName: 'Premium Subscription'
  }
});

if (error) throw error;
```

### Key Differences

1. **No manual headers** - Supabase client automatically adds authentication
2. **Error handling** - Use the `error` object instead of checking `response.ok`
3. **Cleaner code** - Less boilerplate, more readable
4. **Type safety** - Better TypeScript support with Supabase SDK

### Migrated Files

The following files have been updated to use the Edge Function:

- ✅ `web/src/components/modals/UpgradeModal.tsx`
- ✅ `web/src/app/dashboard/parent/upgrade/page.tsx`
- ✅ `web/src/app/pricing/page.tsx`

### Verification

Check for any remaining API route calls:
```bash
# Search for old API route usage
grep -r "fetch('/api/payfast" web/src/
grep -r 'fetch("/api/payfast' web/src/

# Should return: no results
```

### Benefits

1. **Security**: PayFast credentials stored in Supabase Edge Function secrets only
2. **Consistency**: All payment operations use the same infrastructure
3. **Simplicity**: No need to manage PayFast credentials in Vercel
4. **Global deployment**: Edge Functions run close to users worldwide
5. **Better error handling**: Standardized error responses

### Testing

After migration, verify:

1. Payment creation from UpgradeModal works
2. Payment creation from pricing page works
3. Payment creation from upgrade page works
4. No console errors related to authentication
5. PayFast sandbox accepts payments correctly
6. Payment URLs are generated properly

### Rollback

If issues occur, the Edge Function can be temporarily disabled and the old API route can be restored from Git history. However, this is not recommended as it reintroduces security concerns.

### Support

For issues or questions:
- Check Edge Function logs in Supabase Dashboard
- Review browser console for client-side errors
- Verify Supabase Edge Function secrets are set correctly

### Environment Variables

Edge Function requires these secrets (set in Supabase):
```bash
PAYFAST_MODE=sandbox
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_passphrase
```

No PayFast credentials needed in Vercel environment variables.
