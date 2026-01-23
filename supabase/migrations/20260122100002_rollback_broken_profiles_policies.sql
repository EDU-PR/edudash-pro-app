-- Rollback migration: Remove broken profiles RLS policies that caused infinite recursion
-- These policies were added in a previous session but caused 500 errors across the app
-- because they referenced the profiles table in their own USING clause, creating infinite loops

-- Drop the broken policies (already dropped via psql, but documenting for migration history)
DROP POLICY IF EXISTS "profiles_staff_view_school_parents" ON profiles;
DROP POLICY IF EXISTS "profiles_parents_view_school_parents" ON profiles;

-- Note: The correct approach for staff viewing parents would be to use a security definer function
-- or to structure the query differently to avoid self-referencing the profiles table in RLS policies

COMMENT ON TABLE profiles IS 'User profiles - WARNING: Do not add RLS policies that self-reference this table in their USING clause as it causes infinite recursion';
