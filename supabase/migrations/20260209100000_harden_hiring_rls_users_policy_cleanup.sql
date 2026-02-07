-- =============================================================================
-- Harden Hiring Hub RLS policy cleanup
--
-- Why this follow-up migration:
-- - Some environments still contain legacy candidate/job-application policies
--   that reference auth.users/public.users directly.
-- - Those policies can still be evaluated for principal queries and cause:
--     "permission denied for table users"
-- - This migration removes those legacy policies by expression and then
--   re-applies safe helper-function-based policies.
-- =============================================================================

-- Keep schema compatible for ownership checks.
ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Remove any policy on these tables that directly references users tables.
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('candidate_profiles', 'job_applications')
      AND (
        coalesce(qual, '') ILIKE '%auth.users%'
        OR coalesce(with_check, '') ILIKE '%auth.users%'
        OR coalesce(qual, '') ILIKE '%public.users%'
        OR coalesce(with_check, '') ILIKE '%public.users%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      v_policy.policyname,
      v_policy.tablename
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_candidate_profile_owner(
  p_user_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'auth'
AS $$
  SELECT
    (p_user_id IS NOT NULL AND p_user_id = auth.uid())
    OR (
      p_email IS NOT NULL
      AND lower(p_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_candidate_profile_owner(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_candidate_owner(
  p_candidate_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidate_profiles cp
    WHERE cp.id = p_candidate_profile_id
      AND public.is_candidate_profile_owner(cp.user_id, cp.email)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_candidate_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_principal_view_candidate_profile(
  p_candidate_profile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF NOT public.is_preschool_admin() THEN
    RETURN false;
  END IF;

  v_school_id := public.get_current_user_preschool_id();
  IF v_school_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.job_applications ja
    JOIN public.job_postings jp ON jp.id = ja.job_posting_id
    WHERE ja.candidate_profile_id = p_candidate_profile_id
      AND jp.preschool_id = v_school_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_principal_view_candidate_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "candidates_view_own_profile" ON public.candidate_profiles;
CREATE POLICY "candidates_view_own_profile"
ON public.candidate_profiles
FOR SELECT
TO authenticated
USING (
  public.is_candidate_profile_owner(user_id, email)
);

DROP POLICY IF EXISTS "candidates_update_own_profile" ON public.candidate_profiles;
CREATE POLICY "candidates_update_own_profile"
ON public.candidate_profiles
FOR UPDATE
TO authenticated
USING (
  public.is_candidate_profile_owner(user_id, email)
)
WITH CHECK (
  public.is_candidate_profile_owner(user_id, email)
);

DROP POLICY IF EXISTS "principals_view_candidate_profiles_for_school_applications" ON public.candidate_profiles;
CREATE POLICY "principals_view_candidate_profiles_for_school_applications"
ON public.candidate_profiles
FOR SELECT
TO authenticated
USING (
  public.can_principal_view_candidate_profile(id)
);

DROP POLICY IF EXISTS "candidates_view_own_applications" ON public.job_applications;
CREATE POLICY "candidates_view_own_applications"
ON public.job_applications
FOR SELECT
TO authenticated
USING (
  public.is_candidate_owner(candidate_profile_id)
);
