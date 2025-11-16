# PayFast Testing Setup - Quick Start

## ✅ Step 1: Environment Variables (DONE)

PayFast sandbox credentials have been added to `web/.env.local`:
- Merchant ID: `10000100` (PayFast sandbox default)
- Merchant Key: `46f0cd694581a` (PayFast sandbox default)
- Passphrase: **YOU NEED TO SET THIS** ⚠️

### Action Required:
Edit `web/.env.local` and replace `your-passphrase-here` with a secure passphrase (e.g., `test123!@#`)

---

## 🚀 Step 2: Install ngrok (for webhook testing)

PayFast needs to send webhooks to your local server. We need ngrok to expose localhost.

### Option A: Using snap (Recommended for Ubuntu/Linux)
```bash
sudo snap install ngrok
```

### Option B: Download binary
```bash
# Download
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz

# Extract
tar xvzf ngrok-v3-stable-linux-amd64.tgz -C /usr/local/bin

# Verify
ngrok version
```

### Option C: Using npm
```bash
npm install -g ngrok
```

---

## 🧪 Step 3: Start Testing

### 3.1 Start the Next.js dev server
```bash
cd web
npm run dev
```
Server will run at: `http://localhost:3000`

### 3.2 Start ngrok (in a new terminal)
```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### 3.3 Update .env.local with ngrok URL
Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok.io`) and update:
```bash
# In web/.env.local
NEXT_PUBLIC_BASE_URL=https://abc123.ngrok.io
```

**IMPORTANT**: Restart the Next.js dev server after changing this!

---

## 🎯 Step 4: Test the Payment Flow

### 4.1 Login to the app
1. Go to: `http://localhost:3000/sign-in`
2. Login with your test account

### 4.2 Navigate to subscription page
- Direct URL: `http://localhost:3000/dashboard/parent/subscription`
- Or click "Upgrade Plan" from the dashboard

### 4.3 Select a plan and subscribe
- Click "Subscribe" on Basic or Premium plan
- You'll be redirected to PayFast sandbox

### 4.4 Use test card numbers
On PayFast sandbox, use:
- **Success**: `4000000000000002`
- **Declined**: `4000000000000010`
- CVV: `123` (any 3 digits)
- Expiry: `12/25` (any future date)

### 4.5 Complete payment
- Click "Pay Now"
- PayFast will redirect you back to the app
- PayFast will send webhook to your ngrok URL

---

## ✅ Step 5: Verify Success

### Check the webhook was received:
Look in your Next.js terminal for:
```
[PayFast Webhook] Payment notification received
[PayFast Webhook] Payment completed for user: xxx
[PayFast Webhook] User tier updated to: BASIC (or PREMIUM)
```

### Check the database:
Go to Supabase Dashboard:
1. Table Editor → `subscriptions` - Should have new row
2. Table Editor → `user_ai_tiers` - Should show your new tier
3. Table Editor → `user_ai_usage` - Should show updated limits

### Check the app:
1. Refresh your dashboard
2. The QuotaCard should show your new tier
3. AI usage limits should be increased

---

## 🐛 Troubleshooting

### Webhook not received?
- Verify ngrok is running and HTTPS URL is correct
- Check `NEXT_PUBLIC_BASE_URL` in `.env.local`
- Restart Next.js after changing env vars
- Check ngrok web interface at `http://localhost:4040` for requests

### Payment not updating tier?
- Check Next.js terminal for webhook errors
- Verify signature validation is passing
- Check Supabase logs in dashboard

### PayFast signature error?
- Ensure `PAYFAST_PASSPHRASE` matches in PayFast merchant settings
- The passphrase must be the same on PayFast and in `.env.local`

---

## 📝 Next Steps After Testing

Once testing is successful:
1. Create production PayFast account
2. Get production merchant credentials
3. Update env vars for production
4. Change `NEXT_PUBLIC_PAYFAST_URL` to production URL
5. Deploy to Vercel with production credentials

---

**Status**: Ready to test once you:
1. Set the passphrase in `web/.env.local`
2. Install ngrok
3. Start dev server and ngrok
