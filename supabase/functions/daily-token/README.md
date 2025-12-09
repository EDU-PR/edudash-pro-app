# Daily.co Token Edge Function - Deployment Guide

Quick reference for deploying the `daily-token` Supabase Edge Function.

## 🚀 Deployment Steps

### 1. Deploy the Function
```bash
# From project root
cd /home/king/Desktop/edudashpro

# Deploy to Supabase
supabase functions deploy daily-token
```

### 2. Set the DAILY_API_KEY Secret

**Option A: Via Supabase CLI**
```bash
supabase secrets set DAILY_API_KEY=<your-daily-api-key>
```

**Option B: Via Supabase Dashboard**
1. Navigate to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/edge-functions
2. Click **"Secrets"** tab
3. Add new secret:
   - Name: `DAILY_API_KEY`
   - Value: Your Daily.co API key from https://dashboard.daily.co

### 3. Verify Deployment

**Check function exists:**
```bash
supabase functions list
```

**Test locally (optional):**
```bash
# Start local Supabase
supabase start

# Serve function locally
supabase functions serve daily-token

# In another terminal, test with curl:
curl -i --location --request POST 'http://localhost:54321/functions/v1/daily-token' \
  --header 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY_OR_USER_JWT' \
  --header 'Content-Type: application/json' \
  --data '{"roomName":"test-room","userName":"Test User","isOwner":true}'
```

**Test production:**
```bash
# Get a user JWT token (from your app's auth)
export USER_TOKEN="<actual-user-jwt-token>"

curl -i --location --request POST 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/daily-token' \
  --header "Authorization: Bearer $USER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"roomName":"test-room-123","userName":"Test User","isOwner":true}'

# Expected response:
# {"token":"<daily-meeting-token>"}
```

---

## 🔍 Monitoring

### View Logs
```bash
# Real-time logs
supabase functions logs daily-token --follow

# Last 100 log entries
supabase functions logs daily-token --limit 100
```

### Common Issues

**Issue: "DAILY_API_KEY not configured"**
```bash
# Solution: Set the secret
supabase secrets set DAILY_API_KEY=<your-key>
```

**Issue: "Not authenticated" (401 error)**
```bash
# Solution: Ensure valid user JWT token in Authorization header
# The token must be from a logged-in user in your Supabase project
```

**Issue: "Failed to create meeting token" (from Daily.co)**
```bash
# Solution: Verify your Daily.co API key is correct
# Check Daily.co dashboard: https://dashboard.daily.co/developers
```

---

## 📋 Function Details

**Endpoint:** `https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/daily-token`

**Method:** `POST`

**Headers:**
- `Authorization: Bearer <user-jwt-token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "roomName": "voice-1234567890",
  "userName": "John Doe",
  "isOwner": true
}
```

**Response (Success):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Error):**
```json
{
  "error": "Not authenticated"
}
```

---

## 🔄 Update Procedure

When you need to update the function:

```bash
# 1. Edit the function
vim supabase/functions/daily-token/index.ts

# 2. Redeploy
supabase functions deploy daily-token

# 3. Verify logs
supabase functions logs daily-token --follow

# 4. Test in production
curl -i --location --request POST 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/daily-token' \
  --header "Authorization: Bearer $USER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"roomName":"test-update-123","userName":"Test","isOwner":true}'
```

---

**Related Documentation:**
- Main Build Checklist: `docs/deployment/eas-build-checklist.md`
- Supabase Functions Docs: https://supabase.com/docs/guides/functions
- Daily.co API Docs: https://docs.daily.co/reference/rest-api/meeting-tokens
