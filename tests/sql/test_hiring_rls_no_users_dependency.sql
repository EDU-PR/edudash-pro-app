-- Regression test: hiring-related policies must not depend on auth.users/public.users.
-- This protects school application queries from policy recursion and permission failures.

WITH flagged AS (
  SELECT
    schemaname,
    tablename,
    policyname,
    COALESCE(qual, '') AS qual,
    COALESCE(with_check, '') AS with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('candidate_profiles', 'job_applications')
    AND (
      COALESCE(qual, '') ~* '(auth|public)\\.users'
      OR COALESCE(with_check, '') ~* '(auth|public)\\.users'
    )
)
SELECT * FROM flagged;

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('candidate_profiles', 'job_applications')
    AND (
      COALESCE(qual, '') ~* '(auth|public)\\.users'
      OR COALESCE(with_check, '') ~* '(auth|public)\\.users'
    );

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'RLS regression: found % forbidden auth.users/public.users references in hiring policies',
      bad_count;
  END IF;
END
$$;
