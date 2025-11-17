# Security Audit - PayFast Credentials

## Issue: Credential Exposure in Client Bundle

### What Was Wrong
PayFast merchant credentials were exposed in the browser JavaScript bundle through `NEXT_PUBLIC_` environment variables.

### Impact
- Merchant ID and Key visible in browser DevTools
- Anyone could initiate payments on behalf of the merchant
- Potential for fraud and unauthorized transactions

### Fix Applied
1. Removed all `NEXT_PUBLIC_PAYFAST_*` environment variables
2. Removed client-side credential references from `web/src/lib/payfast.ts`
3. All payment initiation now goes through secure Edge Functions
4. Credentials stored only in Supabase Edge Function secrets

### Verification Steps

**1. Check Build Output**
```bash
npm run build
grep -r "PAYFAST_MERCHANT" .next/static/
# Should return: no results
```

**2. Check Environment Variables**
```bash
cat .env.local
# Should NOT contain NEXT_PUBLIC_PAYFAST_MERCHANT_*
```

**3. Check Browser Bundle**
```
1. Open browser DevTools
2. Go to Sources tab
3. Search for "PAYFAST_MERCHANT" or "10000100"
4. Should find: no results
```

### Recommended Actions

1. **Rotate PayFast credentials immediately** (since old ones may have been exposed)
2. **Review PayFast transaction logs** for unauthorized payments
3. **Update Supabase Edge Function secrets** with new credentials
4. **Test payment flow** in sandbox before production

### Prevention

- Never use `NEXT_PUBLIC_` prefix for secrets
- Use server-side API routes or Edge Functions for sensitive operations
- Regular security audits of client bundles
