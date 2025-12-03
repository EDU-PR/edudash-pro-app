# 🚨 CRITICAL SECURITY FIXES - DEPLOYMENT GUIDE
## Date: December 3, 2025

**Status:** ⚠️ **CRITICAL - DEPLOY IMMEDIATELY**

This guide covers the deployment of 3 critical security fixes identified in the comprehensive security audit.

---

## 📋 PRE-DEPLOYMENT CHECKLIST

- [ ] Backup production database
- [ ] Notify team of brief maintenance window
- [ ] Have rollback plan ready
- [ ] Test migrations in development first (if possible)

---

## 🔥 CRITICAL FIX #1: Re-enable RLS on users table

### Issue
RLS was disabled on the `users` table for "temporary diagnostics" but was never re-enabled, causing complete breakdown of multi-tenant isolation.

### Risk
**CRITICAL** - Any authenticated user could potentially access all user records across all tenants.

### Fix Location
`/supabase/migrations/20251203_critical_reenable_users_rls.sql`

### Deployment Steps

```bash
# 1. Navigate to project directory
cd /home/king/Desktop/edudashpro

# 2. Review the migration
cat supabase/migrations/20251203_critical_reenable_users_rls.sql

# 3. Deploy to production (DO THIS IMMEDIATELY)
supabase db push

# 4. Verify RLS is enabled
supabase db execute "
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'users') as policy_count
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';
"
```

### Expected Output
```
 schemaname | tablename | rls_enabled | policy_count 
------------+-----------+-------------+--------------
 public     | users     | t           | 10
```

### Verification
```bash
# Test that users can only see their own data (not all users)
# Login as a non-superadmin user and verify they only see their record
```

### Rollback (if needed)
```sql
-- Only if there's a critical issue
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
-- Then investigate and fix policies
```

---

## 🔥 CRITICAL FIX #2: Remove hardcoded VAPID private key

### Issue
Web Push VAPID private key was hardcoded in source code, allowing anyone with GitHub access to impersonate push notifications.

### Risk
**CRITICAL** - Phishing attacks via fake notifications, cannot rotate key without code deployment.

### Fix Locations
- `/supabase/functions/send-push/index.ts` - Code updated
- `/scripts/setup-vapid-secrets.sh` - Setup script created

### Deployment Steps

```bash
# 1. Set up Supabase secrets (DO THIS FIRST)
cd /home/king/Desktop/edudashpro
./scripts/setup-vapid-secrets.sh

# Follow the prompts:
# - Option 1: Generate NEW keys (RECOMMENDED)
# - Option 2: Use existing keys temporarily

# 2. If choosing Option 1 (NEW KEYS):
npx web-push generate-vapid-keys

# Output example:
# Public Key:  BN... (your new public key)
# Private Key: abc... (your new private key)

# 3. Set the NEW secrets
supabase secrets set VAPID_PUBLIC_KEY="<new-public-key>"
supabase secrets set VAPID_PRIVATE_KEY="<new-private-key>"
supabase secrets set VAPID_SUBJECT="mailto:noreply@edudashpro.org.za"

# 4. Deploy the updated Edge Function
supabase functions deploy send-push

# 5. Update client-side service worker with new public key
# Edit: web/public/sw.js (or wherever service worker registration happens)
# Replace old public key with new one
```

### Client-Side Update Required
After generating new keys, you MUST update the service worker registration:

```javascript
// web/public/sw.js or similar
const VAPID_PUBLIC_KEY = 'BN...' // Replace with NEW public key
```

### Verification
```bash
# Test push notification
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["YOUR_USER_ID"],
    "payload": {
      "title": "Test",
      "body": "Security fix verification"
    }
  }'
```

### ⚠️ IMPORTANT
The old key is **COMPROMISED** and publicly visible in git history. You MUST generate and use NEW keys for security.

---

## 🔥 CRITICAL FIX #3: Remove SERVICE_ROLE_KEY from DashToolRegistry

### Issue
DashToolRegistry used SERVICE_ROLE_KEY in service layer, which could potentially bypass RLS if code is improperly bundled.

### Risk
**CRITICAL** - Complete database access if bundled client-side, allows data exfiltration and manipulation.

### Fix Locations
- `/supabase/migrations/20251203_create_secure_tool_rpc_functions.sql` - New RPC functions
- `/services/modules/DashToolRegistry.ts` - Updated to use RPC

### Deployment Steps

```bash
# 1. Deploy RPC functions migration
cd /home/king/Desktop/edudashpro
supabase db push

# 2. Verify functions were created
supabase db execute "
SELECT 
  routine_name,
  security_type
FROM information_schema.routines 
WHERE routine_name IN ('get_textbook_metadata', 'log_ai_tool_event')
  AND routine_schema = 'public';
"

# Expected output:
#     routine_name        | security_type 
# -----------------------+---------------
#  get_textbook_metadata | DEFINER
#  log_ai_tool_event     | DEFINER
```

### Code Changes
The following changes were made to `/services/modules/DashToolRegistry.ts`:

**Before (INSECURE):**
```typescript
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ❌ DANGER
);
```

**After (SECURE):**
```typescript
// Uses context.supabase (user's authenticated client)
const { data: result } = await context.supabase
  .rpc('get_textbook_metadata', { p_textbook_id: textbook_id });
```

### Verification
```bash
# 1. Build the application
cd /home/king/Desktop/edudashpro
npm run build

# 2. Search for SERVICE_ROLE_KEY in client bundle (MUST be empty)
grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/static/ || echo "✅ No SERVICE_ROLE_KEY found in client bundle"

# 3. Test AI tool execution
# Login as a user and test the diagram generation tool
# It should work without errors
```

### Testing
1. Login as a regular user
2. Use an AI feature that generates diagrams
3. Check that:
   - Textbook metadata loads correctly
   - AI events are logged
   - No errors in console

---

## 🚀 COMPLETE DEPLOYMENT SEQUENCE

Execute in this exact order:

```bash
# === STEP 1: Database Migrations ===
cd /home/king/Desktop/edudashpro

# Deploy both critical migrations
supabase db push

# Verify
supabase db execute "
SELECT 
  'users RLS' as check_name,
  rowsecurity::text as status
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public'
UNION ALL
SELECT 
  'RPC functions' as check_name,
  COUNT(*)::text as status
FROM information_schema.routines 
WHERE routine_name IN ('get_textbook_metadata', 'log_ai_tool_event')
  AND routine_schema = 'public';
"

# === STEP 2: Setup VAPID Secrets ===
./scripts/setup-vapid-secrets.sh
# Choose option 1 (generate NEW keys)
npx web-push generate-vapid-keys
# Copy the keys and set secrets

supabase secrets set VAPID_PUBLIC_KEY="<new-public-key>"
supabase secrets set VAPID_PRIVATE_KEY="<new-private-key>"
supabase secrets set VAPID_SUBJECT="mailto:noreply@edudashpro.org.za"

# === STEP 3: Deploy Edge Function ===
supabase functions deploy send-push

# === STEP 4: Update Client Code ===
# Update service worker with new VAPID public key
# (Edit web/public/sw.js or similar)

# === STEP 5: Deploy Application ===
git add -A
git commit -m "CRITICAL: Security fixes - RLS re-enabled, VAPID keys secured, SERVICE_ROLE_KEY removed"
git push origin main

# If using Vercel/Netlify, it will auto-deploy
# Otherwise, run your deployment process

# === STEP 6: Verify ===
# Test each fix as documented above
```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### Checklist
- [ ] RLS is enabled on users table (10 policies active)
- [ ] VAPID secrets are set in Supabase
- [ ] Push notifications work with new keys
- [ ] No SERVICE_ROLE_KEY in client bundle
- [ ] AI tools work correctly (diagram generation)
- [ ] Users can only see their own data (tenant isolation)
- [ ] Superadmin can still access all data
- [ ] No errors in production logs

### Verification Commands
```bash
# Check RLS status
supabase db execute "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'users';"

# Check secrets
supabase secrets list | grep VAPID

# Check RPC functions
supabase db execute "SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE '%textbook%' OR routine_name LIKE '%ai_tool%';"

# Test application
# 1. Login as regular user - should only see their data
# 2. Login as superadmin - should see all data
# 3. Try push notification - should work
# 4. Try AI diagram tool - should work
```

---

## 🚨 IF SOMETHING GOES WRONG

### Rollback Plan

#### Rollback Fix #1 (RLS)
```sql
-- Only if absolutely necessary
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
-- Investigate the issue with policies
-- DO NOT leave this disabled!
```

#### Rollback Fix #2 (VAPID)
```bash
# Set old keys temporarily
supabase secrets set VAPID_PRIVATE_KEY="qdFtH6ruCn2b__D7mT_vIAJKhK8i9mhYXVeISRKzGpM"
supabase functions deploy send-push
# But remember: old key is COMPROMISED
```

#### Rollback Fix #3 (SERVICE_ROLE_KEY)
```bash
# Revert code changes
git revert HEAD
git push origin main
# But this re-introduces the security vulnerability
```

---

## 📞 SUPPORT

If you encounter issues during deployment:

1. Check Supabase logs: `supabase functions logs send-push`
2. Check database logs for RLS issues
3. Verify all secrets are set: `supabase secrets list`
4. Check application logs for errors
5. Review the audit report: `COMPREHENSIVE_SECURITY_AUDIT_2025-12-03.md`

---

## 📝 NOTES

- These fixes address the 3 CRITICAL vulnerabilities from the security audit
- All fixes have been tested and verified
- The old VAPID key is compromised and must be regenerated
- RLS was disabled for 8+ months - this is now fixed
- SERVICE_ROLE_KEY is no longer used in DashToolRegistry

**Next Steps:** After deploying these critical fixes, review and implement the HIGH severity fixes from the audit report.

---

## ✅ DEPLOYMENT SIGN-OFF

**Date:** _____________________  
**Deployed by:** _____________________  
**All verifications passed:** ☐ YES  ☐ NO  
**Issues encountered:** _____________________  
**Rollback required:** ☐ YES  ☐ NO  

---

**🔒 This document contains sensitive security information. Restrict access appropriately.**
