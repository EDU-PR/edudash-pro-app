# Setup Instructions: EduDash Pro Community Admin Account

## Step 1: Create the Admin User Account

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi
2. Navigate to **Authentication** → **Users**
3. Click **"Add User"** (or **"Invite User"**)
4. Fill in the details:
   - **Email**: `admin@edudashpro.org.za`
   - **Password**: Create a strong password (save it securely!)
   - **Auto-confirm user**: ✅ Yes (check this box)
5. Click **"Create User"**
6. **Copy the User ID** that appears - you'll need it for Step 2

## Step 2: Run SQL to Set Up Admin Privileges

Once the user account is created, run this SQL command (replace `YOUR_USER_ID_HERE` with the actual UUID):

```sql
-- Replace YOUR_USER_ID_HERE with the actual user ID from Step 1
DO $$
DECLARE
  v_school_id UUID;
  v_admin_user_id UUID := 'YOUR_USER_ID_HERE'; -- REPLACE THIS
BEGIN
  -- Get EduDash Pro Community school ID
  SELECT id INTO v_school_id
  FROM schools
  WHERE name = 'EduDash Pro Community'
  LIMIT 1;
  
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'EduDash Pro Community school not found';
  END IF;
  
  -- Create/update profile
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    is_active
  ) VALUES (
    v_admin_user_id,
    'admin@edudashpro.org.za',
    'EduDash Pro Community Admin',
    'school_admin',
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;
  
  -- Create/update user_ai_tiers
  INSERT INTO user_ai_tiers (
    user_id,
    tier,
    organization_id
  ) VALUES (
    v_admin_user_id,
    'free',
    v_school_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    tier = EXCLUDED.tier,
    organization_id = EXCLUDED.organization_id;
  
  -- Create/update user_ai_usage
  INSERT INTO user_ai_usage (
    user_id,
    current_tier
  ) VALUES (
    v_admin_user_id,
    'free'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET current_tier = EXCLUDED.current_tier;
  
  RAISE NOTICE '✅ Admin setup complete!';
  RAISE NOTICE 'School ID: %', v_school_id;
END $$;
```

## Step 3: Verify Setup

Run this query to confirm everything is set up correctly:

```sql
SELECT 
  u.id as user_id,
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.role,
  t.tier,
  ug.current_tier,
  s.name as school_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN user_ai_tiers t ON t.user_id = u.id
LEFT JOIN user_ai_usage ug ON ug.user_id = u.id
LEFT JOIN schools s ON s.id = t.organization_id
WHERE u.email = 'admin@edudashpro.org.za';
```

Expected output:
- **email**: `admin@edudashpro.org.za`
- **role**: `school_admin`
- **tier**: `free`
- **current_tier**: `free`
- **school_name**: `EduDash Pro Community`

## Step 4: Login and Test

1. Go to https://edudashpro.org.za
2. Login with:
   - Email: `admin@edudashpro.org.za`
   - Password: (the one you created in Step 1)
3. You should see the school admin dashboard for "EduDash Pro Community"

## Troubleshooting

If you get a "Profile not found" error after login, run the SQL from Step 2 again with the correct User ID.

If the school dropdown doesn't show "EduDash Pro Community", verify the school exists:

```sql
SELECT id, name, email, status FROM schools WHERE name = 'EduDash Pro Community';
```

## Security Notes

- ✅ Change the admin password regularly
- ✅ Enable 2FA for this account (recommended for production)
- ✅ Only grant access to trusted administrators
- ✅ Monitor login activity via Supabase Dashboard
