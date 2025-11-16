# Vercel Environment Variables - Quick Setup

## Step 1: Remove Old Variables

Go to Vercel → Settings → Environment Variables and **delete**:

- ❌ `NEXT_PUBLIC_PAYFAST_MODE`
- ❌ `NEXT_PUBLIC_PAYFAST_URL`
- ❌ `NEXT_PUBLIC_PAYFAST_MERCHANT_ID`
- ❌ `NEXT_PUBLIC_PAYFAST_MERCHANT_KEY`
- ❌ `NEXT_PUBLIC_PAYFAST_PASSPHRASE`

## Step 2: Add New Variables

Add these **server-side** environment variables (no NEXT_PUBLIC_ prefix):

### For Sandbox Testing

| Variable | Value | Environment |
|----------|-------|-------------|
| `PAYFAST_MODE` | `sandbox` | Production, Preview, Development |
| `PAYFAST_MERCHANT_ID` | `10041710` | Production, Preview, Development |
| `PAYFAST_MERCHANT_KEY` | `fdqf15u93s7qi` | Production, Preview, Development |
| `PAYFAST_PASSPHRASE` | *leave empty* | Production, Preview, Development |

**Important**: For sandbox mode, `PAYFAST_PASSPHRASE` must be empty (no value)!

### For Production (When Ready)

| Variable | Value | Environment |
|----------|-------|-------------|
| `PAYFAST_MODE` | `production` | Production |
| `PAYFAST_MERCHANT_ID` | *your production merchant ID* | Production |
| `PAYFAST_MERCHANT_KEY` | *your production merchant key* | Production |
| `PAYFAST_PASSPHRASE` | *your production passphrase* | Production |

## Step 3: Verify Existing Variables

Make sure these are still set correctly:

| Variable | Example Value |
|----------|---------------|
| `NEXT_PUBLIC_BASE_URL` | `https://edudashpro.org.za` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` |

## Step 4: Redeploy

After saving environment variables:

1. Go to **Deployments** tab
2. Click **...** on latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete

## Step 5: Test

After redeployment:

1. Go to https://edudashpro.org.za
2. Log in as a parent user
3. Try to upgrade subscription
4. Verify payment redirects to PayFast successfully

## Screenshots Reference

Your current Vercel environment variables show:
- ✅ `NEXT_PUBLIC_PAYFAST_MERCHANT_KEY=REDACTED
- ✅ `NEXT_PUBLIC_PAYFAST_PASSPHRASE` (empty, correct for sandbox)
- ✅ `NEXT_PUBLIC_PAYFAST_MERCHANT_ID=10041710` (correct value)
- ✅ `NEXT_PUBLIC_PAYFAST_MODE=sandbox` (correct value)
- ✅ `NEXT_PUBLIC_PAYFAST_URL=https://sandbox.payfast.co.za/...` (correct value)
- ✅ `NEXT_PUBLIC_BASE_URL=https://edudashpro.org.za` (correct value)

**Action Required**: Remove the `NEXT_PUBLIC_` prefix from all PayFast variables!

## Why This Change?

**Security**: Environment variables with `NEXT_PUBLIC_` prefix are embedded in the JavaScript bundle sent to browsers. Anyone can inspect the source code and see your merchant credentials.

**Solution**: Remove the prefix so these variables are only accessible server-side in API routes.

## Expected Result

After migration:
- ✅ Merchant credentials **not visible** in browser
- ✅ Payment signature generated **server-side**
- ✅ No "process is not defined" errors
- ✅ Payment flow works correctly
- ✅ PayFast accepts payments (no signature mismatch)
