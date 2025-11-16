# ✅ PayFast Testing - Ready to Go!

## 🎉 Setup Complete

### Running Services:
- ✅ Next.js Dev Server: `http://localhost:3000`
- ✅ LocalTunnel: `https://hot-ducks-bathe.loca.lt`
- ✅ PayFast Sandbox Configured (no passphrase required)

---

## 🧪 Testing Steps

### 1. Login
- Go to: `http://localhost:3000/sign-in`
- Login with your test account

### 2. Navigate to Subscription Page
- URL: `http://localhost:3000/dashboard/parent/subscription`
- Or click "Upgrade Plan" button from dashboard

### 3. Select a Plan
- Choose **Basic (R99/month)** or **Premium (R199/month)**
- Click "Subscribe" button

### 4. PayFast Sandbox
You'll be redirected to PayFast sandbox payment page.

**Use these test card numbers:**
- ✅ **Success**: `4000000000000002`
- ❌ **Declined**: `4000000000000010`
- 💰 **Insufficient Funds**: `4000000000000036`

**Other details:**
- CVV: `123` (any 3 digits)
- Expiry: `12/25` (any future date)
- Name: Any name

### 5. Complete Payment
- Click "Pay Now"
- PayFast will redirect you back to your app
- PayFast will send webhook to `https://hot-ducks-bathe.loca.lt/api/payfast/webhook`

### 6. Verify Success

**Watch the Next.js terminal for:**
```
[PayFast Webhook] Payment notification received
[PayFast Webhook] Payment completed for user: xxx
[PayFast Webhook] Successfully updated user tier to: BASIC (or PREMIUM)
```

**Check your app:**
- Dashboard should show new tier badge
- QuotaCard should display updated limits
- AI features should have increased quotas

**Check Supabase Dashboard:**
1. **subscriptions** table - New payment record
2. **user_ai_tiers** table - Updated tier (BASIC/PREMIUM)
3. **user_ai_usage** table - Updated limits

---

## 🐛 Troubleshooting

### Webhook not received?
1. Check LocalTunnel is running: `https://hot-ducks-bathe.loca.lt`
2. Open in browser - you'll need to click "Click to Continue" first time
3. Verify `NEXT_PUBLIC_BASE_URL` in `.env.local` matches LocalTunnel URL
4. Check Next.js terminal for errors

### Payment not updating tier?
1. Check Next.js terminal for webhook processing logs
2. Verify PayFast signature validation passed
3. Check Supabase logs in dashboard

### LocalTunnel URL changed?
1. Get new URL from terminal running `lt --port 3000`
2. Update `NEXT_PUBLIC_BASE_URL` in `.env.local`
3. **Important**: Restart Next.js dev server!

---

## 📝 Current Configuration

**Environment Variables:**
- PayFast URL: `https://sandbox.payfast.co.za/eng/process`
- Merchant ID: `10000100`
- Merchant Key: `46f0cd694581a`
- Passphrase: (empty - not used in sandbox)
- Webhook URL: `https://hot-ducks-bathe.loca.lt/api/payfast/webhook`

**Test Plans:**
- Basic: R99/month (50 exams, 50 explanations, 100 chats/day)
- Premium: R199/month (Unlimited)

---

## ⚠️ Important Note

**LocalTunnel First-Time Access:**
When PayFast tries to access your webhook URL, LocalTunnel may show a password page. To avoid this:

1. Open `https://hot-ducks-bathe.loca.lt` in your browser
2. Click "Click to Continue"
3. This whitelists PayFast's IP for webhooks

---

## 🚀 Ready to Test!

Everything is set up. Go to `http://localhost:3000` and start testing!
