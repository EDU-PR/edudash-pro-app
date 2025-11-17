# PayFast Security Migration Guide

## Overview

We've migrated PayFast payment integration from **client-side** to **server-side** for enhanced security. This prevents exposure of merchant credentials and ensures payment data cannot be tampered with.

## What Changed?

### Before (❌ Insecure)
```typescript
// Client-side code had access to merchant credentials
const merchantId = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID;
const merchantKey = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY;
const passphrase = process.env.NEXT_PUBLIC_PAYFAST_PASSPHRASE;

// Generated signature in browser (visible to users)
const signature = generatePayFastSignature(data, passphrase);

// Redirected to PayFast with all credentials visible in URL
window.location.href = paymentUrl;
```

### After (✅ Secure)
```typescript
// Client calls secure API endpoint
const response = await fetch('/api/payfast/create-payment', {
  method: 'POST',
  body: JSON.stringify({ user_id, tier, amount, email }),
});

// Server generates signature and returns payment URL
const { payment_url } = await response.json();
window.location.href = payment_url;
```

## Security Benefits

1. **Merchant credentials never exposed** - Browser JavaScript cannot see sensitive data
2. **Signature generation on server** - Prevents tampering with payment amounts
3. **User ID validation** - Server verifies user authentication before creating payment
4. **Follows PayFast best practices** - Recommended architecture by PayFast
5. **Environment variables are truly secret** - No NEXT_PUBLIC_ prefix means they're not baked into JS bundle

## Migration Steps

### 1. Update Vercel Environment Variables

**Remove these variables (old client-side approach):**
- ❌ `NEXT_PUBLIC_PAYFAST_MODE`
- ❌ `NEXT_PUBLIC_PAYFAST_URL`
- ❌ `NEXT_PUBLIC_PAYFAST_MERCHANT_ID`
- ❌ `NEXT_PUBLIC_PAYFAST_MERCHANT_KEY`
- ❌ `NEXT_PUBLIC_PAYFAST_PASSPHRASE`

**Add these variables (new server-side approach):**
```bash
PAYFAST_MODE=sandbox
PAYFAST_MERCHANT_ID=10041710
PAYFAST_MERCHANT_KEY=REDACTED
PAYFAST_PASSPHRASE=
```

### 2. Update Supabase Edge Function Secrets (if using)

If you're also handling PayFast in Supabase Edge Functions:

```bash
supabase secrets set PAYFAST_MODE=sandbox
supabase secrets set PAYFAST_MERCHANT_ID=10041710
supabase secrets set PAYFAST_MERCHANT_KEY=REDACTED
supabase secrets set PAYFAST_PASSPHRASE=
```

### 3. Redeploy Vercel

After updating environment variables, you **must redeploy** for changes to take effect:

1. Go to Vercel dashboard
2. Navigate to your project
3. Click "Deployments" tab
4. Click "..." menu on latest deployment
5. Click "Redeploy"

**OR** trigger automatic redeployment by pushing to GitHub (already done with commit 459405b).

### 4. Verify Configuration

After deployment, test the payment flow:

1. Log in as a parent user
2. Navigate to pricing or subscription page
3. Click "Upgrade" button
4. Check browser console for:
   - ✅ `[PayFast API] Payment created: { paymentId, tier, amount, mode: 'sandbox' }`
   - ✅ No "process is not defined" errors
   - ✅ Clean redirect to PayFast

## Environment Variables Reference

### For Development (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=REDACTED

# PayFast (Server-side only)
PAYFAST_MODE=sandbox
PAYFAST_MERCHANT_ID=10041710
PAYFAST_MERCHANT_KEY=REDACTED
PAYFAST_PASSPHRASE=

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### For Production (Vercel)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=REDACTED

# Base URL
NEXT_PUBLIC_BASE_URL=https://edudashpro.org.za
```

**IMPORTANT:** PayFast credentials are NO LONGER stored in Vercel.
They are stored in Supabase Edge Function secrets:

```bash
# Configure in Supabase Dashboard → Edge Functions → Secrets
supabase secrets set PAYFAST_MODE=production
supabase secrets set PAYFAST_MERCHANT_ID=your_production_merchant_id
supabase secrets set PAYFAST_MERCHANT_KEY=REDACTED
supabase secrets set PAYFAST_PASSPHRASE=REDACTED
```

## PayFast Sandbox vs Production

### Sandbox Mode
- **Mode**: `PAYFAST_MODE=sandbox`
- **URL**: Automatically uses `https://sandbox.payfast.co.za/eng/process`
- **Passphrase**: Leave **empty** (PayFast sandbox doesn't use passphrase for signatures!)
- **Test Credentials**: 
  - Merchant ID: `10000100` (default) or your sandbox merchant ID
  - Merchant Key: `46f0cd694581a` (default) or your sandbox merchant key

### Production Mode
- **Mode**: `PAYFAST_MODE=production`
- **URL**: Automatically uses `https://www.payfast.co.za/eng/process`
- **Passphrase**: **Required** (set in PayFast account settings)
- **Credentials**: Get from your PayFast production account

## API Endpoint Reference

### POST /api/payfast/create-payment

**Request Body:**
```json
{
  "user_id": "uuid",
  "tier": "parent_starter" | "parent_plus" | "school_starter" | "school_premium" | "school_pro",
  "amount": 199.00,
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "itemName": "Parent Plus",
  "itemDescription": "Monthly subscription",
  "subscriptionType": "1",
  "frequency": "3",
  "cycles": "0"
}
```

**Response (Success):**
```json
{
  "success": true,
  "payment_url": "https://sandbox.payfast.co.za/eng/process?...",
  "payment_id": "SUB_PARENT_PLUS_a04eec28_1763263077196",
  "mode": "sandbox"
}
```

**Response (Error):**
```json
{
  "error": "Missing required fields"
}
```

## Testing Checklist

After migration, verify:

- [ ] Environment variables updated in Vercel (no NEXT_PUBLIC_ prefix)
- [ ] Vercel redeployed with new environment variables
- [ ] Payment flow works from UpgradeModal component
- [ ] Payment flow works from pricing page
- [ ] Payment flow works from /dashboard/parent/upgrade page
- [ ] No "process is not defined" errors in browser console
- [ ] Merchant credentials NOT visible in browser JavaScript
- [ ] PayFast accepts payment (no signature mismatch 400 errors)
- [ ] Webhook receives payment notification
- [ ] User tier updates correctly after successful payment

## Troubleshooting

### "Payment system not configured" error
**Cause**: Missing `PAYFAST_MERCHANT_ID` or `PAYFAST_MERCHANT_KEY` environment variables  
**Solution**: Add environment variables in Vercel and redeploy

### Signature mismatch (400 Bad Request)
**Cause**: Incorrect passphrase or wrong mode (sandbox vs production)  
**Solution**: 
- For sandbox: Ensure `PAYFAST_PASSPHRASE` is empty
- For production: Verify passphrase matches your PayFast account settings

### Webhook not receiving notifications
**Cause**: PayFast cannot reach your webhook URL  
**Solution**: 
- Verify `NEXT_PUBLIC_BASE_URL` is set correctly
- Ensure webhook URL is publicly accessible (not localhost)
- Check Vercel function logs for incoming requests

## Rollback Plan

If you need to rollback to client-side payments (not recommended):

1. Restore previous environment variables with `NEXT_PUBLIC_` prefix
2. Revert to commit `7fd6f9a` (before migration)
3. Redeploy

```bash
git revert 459405b
git push origin main
```

## Support

If you encounter issues after migration:
- Check Vercel deployment logs
- Review browser console errors
- Verify environment variables are set correctly
- Ensure Vercel has been redeployed after env var changes

## References

- [PayFast Integration Guide](https://developers.payfast.co.za/docs#step_1_form_post_to_payfast)
- [PayFast Signature Generation](https://developers.payfast.co.za/docs#signature)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
