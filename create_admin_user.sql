-- Create Super Admin user
-- Email: admin@edudashpro.org.za
-- Password: admin-123

-- First, we need to insert into auth.users (requires service role access)
-- This script should be run with proper admin privileges

DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@edudashpro.org.za';
  
  IF admin_user_id IS NULL THEN
    -- Insert into auth.users (this is typically done via Supabase Auth API)
    -- For now, we'll just create the profile entry
    RAISE NOTICE 'User needs to be created via Supabase Auth API or Dashboard';
    RAISE NOTICE 'Email: admin@edudashpro.org.za';
    RAISE NOTICE 'Password: admin-123';
    RAISE NOTICE 'After signup, run this to upgrade to super_admin:';
    RAISE NOTICE 'UPDATE profiles SET role = ''super_admin'' WHERE email = ''admin@edudashpro.org.za'';';
  ELSE
    -- User exists, update their role to super_admin
    UPDATE profiles 
    SET 
      role = 'super_admin',
      full_name = 'EduDash Pro Admin',
      updated_at = NOW()
    WHERE id = admin_user_id;
    
    RAISE NOTICE 'Updated user % to super_admin role', admin_user_id;
  END IF;
END $$;
