# PayFast Sandbox Testing Guide

## 🧪 Testing the Complete Payment Flow

### Prerequisites

1. **PayFast Sandbox Account** (Free)
   - Sign up at: https://sandbox.payfast.co.za
   - Get your sandbox credentials:
     - Merchant ID: `10000100` (default sandbox)
     - Merchant Key: `46f0cd694581a` (default sandbox)
     - Passphrase: Create one in your PayFast settings

2. **Environment Variables**
   Create `.env.local` in the `web/` directory:
   ```bash
   # PayFast Sandbox Configuration
   NEXT_PUBLIC_PAYFAST_URL=https://sandbox.payfast.co.za/eng/process
   NEXT_PUBLIC_PAYFAST_MERCHANT_ID=10000100
   NEXT_PUBLIC_PAYFAST_MERCHANT_KEY=REDACTED
   PAYFAST_PASSPHRASE=REDACTED
   
   # Your app URL (for webhooks)
   NEXT_PUBLIC_BASE_URL=https://your-ngrok-url.ngrok.io
   
   # Supabase (required)
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=REDACTED
   ```

---

## 🚀 Step-by-Step Testing

### Step 1: Set Up ngrok (for webhook testing)

PayFast needs to send webhooks to your local server:

```bash
# Install ngrok (if not installed)
npm install -g ngrok

# Start your Next.js dev server
cd web
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update NEXT_PUBLIC_BASE_URL in .env.local with this URL
```

### Step 2: Test Payment Initiation

1. **Login to your app**
   - Go to: `http://localhost:3000/sign-in`
   - Login with your test account

2. **Navigate to subscription page**
   - Go to: `http://localhost:3000/dashboard/parent/subscription`
   - Or click "Upgrade Plan" from the QuotaCard widget

3. **Click "Select Plan"** on any paid tier
   - This should redirect to `/pricing`

4. **Click "Subscribe"** on a plan
   - You'll be redirected to PayFast sandbox

### Step 3: Complete Sandbox Payment

On the PayFast sandbox page:

1. **Test Credit Card Numbers** (use these for testing):
   - **Success**: `4000000000000002`
   - **Declined**: `4000000000000010`
   - **Insufficient Funds**: `4000000000000036`

2. **Test Card Details**:
   - CVV: Any 3 digits (e.g., `123`)
   - Expiry: Any future date (e.g., `12/25`)
   - Name: Any name

3. **Complete Payment**
   - Click "Pay Now"
   - Should redirect back to your app

### Step 4: Verify Webhook

Check the webhook was received:

```bash
# View webhook logs in your terminal running Next.js
# Look for: [PayFast Webhook] Payment notification received

# Or check Supabase directly:
# Go to: Supabase Dashboard > Table Editor > subscriptions
# Look for new entry with your payment
```

### Step 5: Verify Tier Update

1. **Check database**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT user_id, tier, updated_at 
   FROM user_ai_tiers 
   WHERE user_id = 'your-user-id';
   
   SELECT current_tier 
   FROM user_ai_usage 
   WHERE user_id = 'your-user-id';
   ```

2. **Check UI**:
   - Subscription page should show new tier
   - QuotaCard should show updated limits
   - Alert notification should appear (via useTierUpdates hook)

---

## 📊 Expected Flow

```
User clicks "Subscribe" (Parent Starter - R99)
↓
Redirects to: https://sandbox.payfast.co.za/eng/process
↓
User enters test card: 4000000000000002
↓
PayFast processes payment
↓
Redirects to: /dashboard/parent/subscription?payment=success
↓
PayFast sends webhook to: /api/payfast/webhook
↓
Webhook validates signature
↓
Updates user_ai_tiers.tier = 'basic'
↓
Updates user_ai_usage.current_tier = 'basic'
↓
Creates subscription record
↓
Supabase broadcasts tier change
↓
useTierUpdates hook detects change
↓
UI shows: "🎉 Your plan has been upgraded to Parent Starter!"
↓
Dashboard refreshes with new quota limits
```

---

## 🐛 Troubleshooting

### Webhook Not Received

1. **Check ngrok is running**:
   ```bash
   curl https://your-ngrok-url.ngrok.io/api/payfast/webhook
   # Should return 405 Method Not Allowed (POST only)
   ```

2. **Check PayFast passphrase**:
   - Must match exactly in PayFast dashboard and `.env.local`
   - No extra spaces or characters

3. **View webhook logs**:
   ```bash
   # Terminal running Next.js should show:
   [PayFast Webhook] Payment notification received
   [PayFast Webhook] Signature valid
   [PayFast Webhook] Tier updated successfully
   ```

### Signature Validation Failed

- **Cause**: Passphrase mismatch or parameter encoding issue
- **Fix**: 
  1. Double-check passphrase in both places
  2. Ensure no extra whitespace in `.env.local`
  3. Check webhook logs for exact error

### Tier Not Updating

1. **Check database permissions**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM user_ai_tiers WHERE user_id = 'your-user-id';
   ```

2. **Check webhook response**:
   - Should return 200 OK
   - Check `subscriptions` table for new record

3. **Manual tier update** (for testing):
   ```sql
   UPDATE user_ai_tiers 
   SET tier = 'basic' 
   WHERE user_id = 'your-user-id';
   
   UPDATE user_ai_usage 
   SET current_tier = 'basic' 
   WHERE user_id = 'your-user-id';
   ```

---

## ✅ Testing Checklist

- [ ] ngrok tunnel running
- [ ] `.env.local` configured with sandbox credentials
- [ ] Next.js dev server running
- [ ] User logged in
- [ ] Can access subscription page
- [ ] "Select Plan" redirects to pricing
- [ ] "Subscribe" button redirects to PayFast
- [ ] Can complete sandbox payment
- [ ] Redirected back to app after payment
- [ ] Webhook received (check logs)
- [ ] `subscriptions` table updated
- [ ] `user_ai_tiers` table updated
- [ ] `user_ai_usage` table updated
- [ ] Real-time notification appears
- [ ] QuotaCard shows new limits
- [ ] Can use AI features with new quota

---

## 🎯 Next Steps After Sandbox Testing

1. **Production Setup**:
   - Get real PayFast credentials
   - Update environment variables
   - Change URL to `https://www.payfast.co.za/eng/process`

2. **Security Hardening**:
   - Enable IP whitelisting for webhooks
   - Add rate limiting
   - Monitor for duplicate payments

3. **User Experience**:
   - Add loading states during payment
   - Show payment history on subscription page
   - Email receipts after successful payment

---

## 📚 Resources

- [PayFast Sandbox Docs](https://developers.payfast.co.za/docs#sandbox)
- [PayFast Integration Guide](https://developers.payfast.co.za/docs#step_1_initiate_payment)
- [PayFast Webhook Spec](https://developers.payfast.co.za/docs#notify_page)
- [ngrok Documentation](https://ngrok.com/docs)
