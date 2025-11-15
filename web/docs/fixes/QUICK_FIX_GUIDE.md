# 🎯 Quick Fix Guide - Get Your User Working Now!

## Problem Summary

After Google Sign-In, your user was created successfully but has **NO** `preschool_id`, causing:
- ❌ Can't fetch children
- ❌ No school banner shows
- ❌ Dashboard features don't work

**Plus:** AI Proxy is returning 503 errors

---

## ⚡ Quick Fix (Do This Now!)

### Step 1: Link Your User to a School

**Go to Supabase SQL Editor:**
https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql/new

**Run this SQL:**
```sql
-- Create a test school and link your user to it
DO $$
DECLARE
  new_school_id UUID;
  user_id UUID;
BEGIN
  -- Get your user ID
  SELECT id INTO user_id 
  FROM profiles 
  WHERE email = 'davecon12martin@outlook.com';
  
  -- Check if school exists
  SELECT id INTO new_school_id 
  FROM preschools 
  WHERE name = 'Test School';
  
  -- If no school, create one
  IF new_school_id IS NULL THEN
    INSERT INTO preschools (
      name, 
      address, 
      contact_email, 
      contact_phone, 
      subscription_tier
    )
    VALUES (
      'Test School',
      '123 Test St, Johannesburg',
      'admin@testschool.co.za',
      '+27123456789',
      'free'
    )
    RETURNING id INTO new_school_id;
  END IF;
  
  -- Link user to school
  UPDATE profiles 
  SET preschool_id = new_school_id
  WHERE id = user_id;
  
  RAISE NOTICE 'User linked to school: %', new_school_id;
END $$;

-- Verify it worked
SELECT 
  email,
  first_name,
  last_name,
  role,
  preschool_id,
  (SELECT name FROM preschools WHERE id = profiles.preschool_id) as school_name
FROM profiles 
WHERE email = 'davecon12martin@outlook.com';
```

**Expected Result:**
```
email: davecon12martin@outlook.com
first_name: Dave
last_name: Martin
role: parent
preschool_id: <some-uuid>
school_name: Test School
```

### Step 2: Refresh Your Browser

1. Go back to your app: http://localhost:3000/dashboard
2. Hard refresh: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)
3. Check console - warnings should be GONE!

### Step 3: Fix AI Proxy 503 Error

**Check Supabase Function:**
1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/functions
2. Look for `ai-proxy` function
3. Click on it → View logs

**Common Issues:**

**A. Function Doesn't Exist:**
```bash
cd /home/king/Desktop/edudashpro
supabase functions deploy ai-proxy
```

**B. Missing Anthropic API Key:**
1. Go to: Project Settings → Edge Functions → Secrets
2. Add secret: `ANTHROPIC_API_KEY` = your key
3. Redeploy function

**C. Function Has Errors:**
- Check logs in Supabase dashboard
- Look for error messages
- Common: timeout, missing env vars, code errors

---

## ✅ Verification Steps

### After Running SQL:

**1. Check Database:**
```sql
SELECT 
  p.email,
  p.first_name,
  p.preschool_id,
  ps.name as school_name
FROM profiles p
LEFT JOIN preschools ps ON ps.id = p.preschool_id
WHERE p.email = 'davecon12martin@outlook.com';
```

Should show:
- ✅ `preschool_id` is NOT null
- ✅ `school_name` shows "Test School"

**2. Check Browser Console:**

Before fix:
```
❌ ⚠️ User has no preschool_id
❌ ⚠️ Profile found but NO preschool_id
```

After fix:
```
✅ No warnings about preschool_id
✅ Organization banner should appear
✅ Children data should load (if any children exist)
```

**3. Check Dashboard:**

Before:
- ❌ No school name/banner
- ❌ "User needs to be linked to a school"

After:
- ✅ School banner shows "Test School"
- ✅ Dashboard loads properly
- ✅ Features work

---

## 🔍 If AI Proxy Still Fails

### Check Function Exists:
```bash
cd /home/king/Desktop/edudashpro
supabase functions list
```

Should show:
```
ai-proxy
```

### Check Function Logs:
```bash
supabase functions logs ai-proxy
```

Look for errors like:
- "ANTHROPIC_API_KEY is not set"
- "fetch failed"
- "timeout"

### Deploy/Redeploy Function:
```bash
supabase functions deploy ai-proxy --no-verify-jwt
```

### Set Anthropic API Key:
```bash
supabase secrets set ANTHROPIC_API_KEY=REDACTED
```

Or via dashboard:
1. Project Settings → Edge Functions
2. Secrets tab
3. Add `ANTHROPIC_API_KEY`

---

## 🏗️ Long-Term Fix (Do Later)

The proper solution is to build an **onboarding flow** for new users:

1. **Sign in with Google** → User created
2. **Onboarding wizard appears:**
   - "What's your role?"
   - Parent → Enter school code
   - Teacher → Enter invite code
   - Principal → Create school
3. **User linked to school** → Dashboard loads

This is documented in `USER_ONBOARDING_ANALYSIS.md` - we can build this later.

---

## Summary

**Immediate Actions:**
1. ✅ Run SQL to link user to school
2. ✅ Refresh browser - warnings gone!
3. ✅ Check/fix AI proxy function

**Long-term:**
- Build onboarding flow for new users
- Document in USER_ONBOARDING_ANALYSIS.md

**Status:** You should be fully working after the SQL fix! 🎉

Try the exam builder again - it should work once the AI proxy is fixed!
