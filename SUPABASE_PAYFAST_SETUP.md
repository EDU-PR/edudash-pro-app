# Supabase Edge Function Setup for PayFast

## Overview

PayFast payment credentials are now stored securely in **Supabase Edge Function secrets** instead of Vercel environment variables. This provides better security and centralized management.

## Architecture

```
Browser → Next.js API (/api/payfast/create-payment) 
        → Supabase Edge Function (payfast-create-payment)
        → PayFast Payment Gateway
```

## Step 1: Set Supabase Secrets

Run these commands from your project root:

### For Sandbox Testing

```bash
supabase secrets set PAYFAST_MODE=sandbox
supabase secrets set PAYFAST_MERCHANT_ID=10041710
supabase secrets set PAYFAST_MERCHANT_KEY=REDACTED
supabase secrets set PAYFAST_PASSPHRASE=REDACTED
supabase secrets set BASE_URL=https://edudashpro.org.za
```

### For Production

```bash
supabase secrets set PAYFAST_MODE=production
supabase secrets set PAYFAST_MERCHANT_ID=your_production_merchant_id
supabase secrets set PAYFAST_MERCHANT_KEY=REDACTED
supabase secrets set PAYFAST_PASSPHRASE=REDACTED
supabase secrets set BASE_URL=https://edudashpro.org.za
```

## Step 2: Deploy Edge Function

```bash
cd /workspaces/edudash-pro
supabase functions deploy payfast-create-payment
```

## Step 3: Verify Secrets

```bash
supabase secrets list
```

You should see:
```
PAYFAST_MODE
PAYFAST_MERCHANT_ID
PAYFAST_MERCHANT_KEY
PAYFAST_PASSPHRASE
BASE_URL
SUPABASE_URL (auto-set)
SUPABASE_ANON_KEY (auto-set)
```

## Step 4: Update Vercel Environment Variables

You can now **delete** all PayFast-related variables from Vercel:

❌ Delete from Vercel:
- `PAYFAST_MODE`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`

✅ Keep in Vercel:
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Step 5: Redeploy Vercel

After removing PayFast env vars from Vercel, redeploy:
1. Go to Vercel dashboard
2. Click "Deployments"
3. Click "..." → "Redeploy"

## Step 6: Test

Test the payment flow:

```bash
curl -X POST https://edudashpro.org.za/api/payfast/create-payment \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid",
    "tier": "parent_plus",
    "amount": 199,
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }'
```

Expected response:
```json
{
  "success": true,
  "payment_url": "https://sandbox.payfast.co.za/eng/process?...",
  "payment_id": "SUB_PARENT_PLUS_...",
  "mode": "sandbox"
}
```

## Security Benefits

### Before (Vercel Environment Variables)
- ❌ Credentials stored in Vercel
- ❌ Visible to anyone with Vercel access
- ❌ Requires Vercel redeploy to update
- ❌ Separate config for each deployment environment

### After (Supabase Secrets)
- ✅ Credentials stored in Supabase (encrypted at rest)
- ✅ Access controlled by Supabase RBAC
- ✅ Update secrets without redeploying
- ✅ Centralized configuration
- ✅ Automatic secret rotation support
- ✅ Better audit logging

## Troubleshooting

### Edge Function Returns "Payment system not configured"
**Cause**: Missing `PAYFAST_MERCHANT_ID` or `PAYFAST_MERCHANT_KEY` secrets  
**Solution**: Run `supabase secrets set` commands above

### Edge Function Returns "Invalid authentication"
**Cause**: Next.js API not passing auth header correctly  
**Solution**: Verify Supabase client is authenticated before calling edge function

### Signature mismatch (400 from PayFast)
**Cause**: Wrong passphrase or mode  
**Solution**: 
- Sandbox: Ensure `PAYFAST_PASSPHRASE=REDACTED
- Production: Verify passphrase matches PayFast dashboard

### Cannot call edge function
**Cause**: Edge function not deployed  
**Solution**: Run `supabase functions deploy payfast-create-payment`

## Local Development

For local testing with Supabase local development:

```bash
# Start Supabase locally
supabase start

# Set local secrets
supabase secrets set --env-file .env.local PAYFAST_MODE=sandbox
supabase secrets set --env-file .env.local PAYFAST_MERCHANT_ID=10041710
supabase secrets set --env-file .env.local PAYFAST_MERCHANT_KEY=REDACTED

# Serve functions locally
supabase functions serve payfast-create-payment
```

## Monitoring

Check edge function logs:

```bash
# Real-time logs
supabase functions logs payfast-create-payment --tail

# Recent logs
supabase functions logs payfast-create-payment --limit 100
```

Or view in Supabase Dashboard:
1. Go to Edge Functions
2. Click "payfast-create-payment"
3. View "Logs" tab

## Cost Considerations

Supabase Edge Function pricing:
- Free tier: 500,000 invocations/month
- After free tier: $2 per 1M invocations

For typical usage:
- 1,000 payments/month = 1,000 invocations = FREE
- 10,000 payments/month = 10,000 invocations = FREE

Much cheaper than serverless functions on other platforms!

## References

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
- [PayFast Integration Guide](https://developers.payfast.co.za/docs)
