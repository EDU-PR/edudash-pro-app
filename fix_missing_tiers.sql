-- Fix missing user_ai_tiers records
-- This ensures all users have a tier assigned (default: free)

-- First, ensure all users have profiles (required for foreign key)
INSERT INTO profiles (id, email, role)
SELECT 
  u.id,
  u.email,
  'parent' as role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Insert free tier for users who don't have any tier
INSERT INTO user_ai_tiers (user_id, tier, assigned_reason, is_active)
SELECT 
  u.id as user_id,
  'free' as tier,
  'Auto-assigned default tier' as assigned_reason,
  true as is_active
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_ai_tiers uat 
  WHERE uat.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Also ensure user_ai_usage table has records for all users
INSERT INTO user_ai_usage (user_id, current_tier)
SELECT 
  u.id as user_id,
  'free' as current_tier
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_ai_usage uau 
  WHERE uau.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Create a function to automatically assign free tier to new users
CREATE OR REPLACE FUNCTION public.assign_default_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into user_ai_tiers
  INSERT INTO public.user_ai_tiers (user_id, tier, assigned_reason, is_active)
  VALUES (NEW.id, 'free', 'Auto-assigned on signup', true)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Insert into user_ai_usage
  INSERT INTO public.user_ai_usage (user_id, current_tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_assign_tier ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_tier
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_tier();

-- Verify the fix
SELECT COUNT(*) as users_without_tier 
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_ai_tiers uat WHERE uat.user_id = u.id
);

-- Should return 0 if successful
