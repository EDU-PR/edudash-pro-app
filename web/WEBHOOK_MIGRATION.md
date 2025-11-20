# PayFast Webhook Migration Guide

## Important: Webhook URL Changed

The PayFast webhook URL has been updated for security and consistency.

### Old URL (DEPRECATED - DO NOT USE)
```
https://edudashpro.org.za/api/payfast/webhook
```

### New URL (USE THIS)
```
https://[your-supabase-project].supabase.co/functions/v1/payfast-webhook
```

## How to Update

1. Log in to PayFast Merchant Dashboard
2. Go to Settings → Integration
3. Update ITN (Instant Transaction Notification) URL to new Edge Function URL
4. Test with sandbox payment to verify

## Why This Change?

- **Security**: Edge Function validates PayFast IP addresses
- **Consistency**: Single webhook handler prevents race conditions
- **Reliability**: Better error handling and logging
- **Database Integrity**: Updates all tables atomically (subscriptions, preschools, organizations)

## Verification

After updating, process a test payment and check logs:
```bash
supabase functions logs payfast-webhook --tail
```

You should see:
```
PayFast ITN IP validation: { clientIp: '41.74.179.194', mode: 'sandbox', validated: true }
PayFast ITN processed successfully: { m_payment_id: 'SUB_...', status: 'completed' }
```
