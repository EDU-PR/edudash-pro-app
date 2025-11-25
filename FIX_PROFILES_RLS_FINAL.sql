-- Final fix for infinite recursion in profiles RLS policy
-- Uses a SECURITY DEFINER function to cache the current user's preschool_id
-- This breaks the recursion cycle

-- Create helper function that gets cached (STABLE)
CREATE OR REPLACE FUNCTION public.get_user_preschool_id()
RETURNS UUID AS $$
  SELECT preschool_id 
  FROM profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_preschool_id() TO authenticated;

-- Drop old problematic policies
DROP POLICY IF EXISTS profiles_same_preschool_visibility ON profiles;
DROP POLICY IF EXISTS "Principals can view parent profiles for their students" ON profiles;

-- Create new non-recursive policy
CREATE POLICY profiles_preschool_visibility ON profiles
FOR SELECT
USING (
  -- Users can always see their own profile
  id = auth.uid()
  OR
  -- Users can see other profiles in the same preschool (cached lookup, no recursion!)
  preschool_id = public.get_user_preschool_id()
);

SELECT 'SUCCESS: Profiles RLS fixed with helper function - no recursion' AS status;
