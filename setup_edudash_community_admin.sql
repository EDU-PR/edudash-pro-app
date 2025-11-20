-- Setup Admin Account for EduDash Pro Community School
-- This creates a dedicated admin user for managing the K-12 community school

-- Step 1: Create the admin user in auth.users
-- Note: This SQL creates the user record. Password must be set via Supabase Dashboard or Auth API.
-- For security, we'll create an invite link instead of setting a password directly.

DO $$
DECLARE
  community_school_id UUID;
  admin_user_id UUID;
  admin_email TEXT := 'admin@edudashpro.org.za';
BEGIN
  -- Get EduDash Pro Community school ID
  SELECT id INTO community_school_id
  FROM schools
  WHERE name = 'EduDash Pro Community'
  LIMIT 1;
  
  IF community_school_id IS NULL THEN
    RAISE EXCEPTION 'EduDash Pro Community school not found!';
  END IF;
  
  RAISE NOTICE 'EduDash Pro Community School ID: %', community_school_id;
  
  -- Check if admin user already exists
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;
  
  IF admin_user_id IS NULL THEN
    -- Generate UUID for new admin user
    admin_user_id := gen_random_uuid();
    
    -- Create profile FIRST to avoid trigger issues
    INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (
      admin_user_id,
      admin_email,
      'EduDash Admin',
      'school_admin',
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Profile created for admin user';
    
    -- Now create admin user
    -- Note: In production, use Supabase Auth API or Dashboard to create users with proper password hashing
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_token,
      phone_change_sent_at,
      email_change_token_current,
      email_change_confirm_status,
      banned_until,
      reauthentication_token,
      reauthentication_sent_at,
      is_sso_user,
      deleted_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_user_id, -- Use pre-generated UUID
      'authenticated',
      'authenticated',
      admin_email,
      crypt('ChangeMe123!@#', gen_salt('bf')), -- Temporary password - MUST BE CHANGED!
      NOW(),
      NOW(),
      '',
      NOW(),
      '',
      NOW(),
      '',
      '',
      NOW(),
      NOW(),
      jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email'],
        'role', 'school_admin'
      ),
      jsonb_build_object(
        'full_name', 'EduDash Admin',
        'school_id', community_school_id,
        'school_name', 'EduDash Pro Community',
        'is_community_admin', true
      ),
      false,
      NOW(),
      NOW(),
      NULL,
      NULL,
      '',
      '',
      NOW(),
      '',
      0,
      NULL,
      '',
      NOW(),
      false,
      NULL
    );
    
    RAISE NOTICE 'Created admin user: % (ID: %)', admin_email, admin_user_id;
  ELSE
    RAISE NOTICE 'Admin user already exists: % (ID: %)', admin_email, admin_user_id;
    
    -- Update profile to ensure role is correct
    UPDATE profiles
    SET role = 'school_admin', updated_at = NOW()
    WHERE id = admin_user_id;
  END IF;
  
  -- Ensure user_ai_tiers entry exists with appropriate tier
  INSERT INTO user_ai_tiers (user_id, tier, assigned_reason, is_active)
  VALUES (admin_user_id, 'free', 'Community admin default tier', true)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Ensure user_ai_usage entry exists
  INSERT INTO user_ai_usage (user_id, current_tier)
  VALUES (admin_user_id, 'free')
  ON CONFLICT (user_id) DO UPDATE
  SET current_tier = 'free';
  
  RAISE NOTICE 'AI tier and usage records created/verified';
  
  -- Link admin to EduDash Pro Community school
  -- This depends on your schema - adjust table name as needed
  -- Example: school_staff, teacher_schools, or similar junction table
  
  RAISE NOTICE 'Admin setup complete!';
  RAISE NOTICE 'Email: %', admin_email;
  RAISE NOTICE 'Temporary Password: ChangeMe123!@# (MUST BE CHANGED ON FIRST LOGIN)';
  RAISE NOTICE 'School ID: %', community_school_id;
  RAISE NOTICE 'User ID: %', admin_user_id;
END $$;

-- Verify the setup
SELECT 
  u.id as user_id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  u.raw_user_meta_data->>'school_name' as school,
  u.raw_app_meta_data->>'role' as role
FROM auth.users u
WHERE u.email = 'admin@edudashpro.org.za';
