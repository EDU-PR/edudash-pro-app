-- =============================================================================
-- Fix Hiring Hub RLS: remove auth.users dependency that blocks principals
--
-- Symptom:
--   Principal "Applications" tab fails to load with:
--   "permission denied for table users"
--
-- Root cause:
--   Candidate-facing RLS policies referenced auth.users and were scoped to
--   TO public, so they were evaluated in principal queries too.
--
-- Fix:
--   1) Replace auth.users-based checks with JWT-based checks.
--   2) Scope candidate-own policies to authenticated role.
--   3) Add helper functions to avoid cross-table permission issues.
--   4) Allow principals to read candidate profiles tied to their school's apps.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: candidate owns candidate_profile row
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Helper: candidate owns an application via candidate_profile_id
-- SECURITY DEFINER prevents policy-time dependency on caller table privileges.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Helper: principal/admin can view candidate profile if linked to their school
-- through at least one job application -> job posting.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- candidate_profiles policies (remove auth.users references)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- job_applications candidate-own policy (remove auth.users dependency)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "candidates_view_own_applications" ON public.job_applications;
CREATE POLICY "candidates_view_own_applications"
ON public.job_applications
FOR SELECT
TO authenticated
USING (
  public.is_candidate_owner(candidate_profile_id)
);
