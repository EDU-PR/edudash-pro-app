-- =============================================================================
-- Fix Hiring Hub job_applications principal RLS to avoid public.users dependency
--
-- Symptom:
--   permission denied for table users
-- when principals fetch school applications with joins.
--
-- Root cause:
--   Existing principal policies on public.job_applications reference public.users.
--   In some contexts, policy evaluation attempts to read public.users and fails.
--
-- Fix:
--   Recreate principal SELECT/UPDATE policies using helper functions that do not
--   depend on public.users table access.
-- =============================================================================

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "principals_view_applications" ON public.job_applications;
DROP POLICY IF EXISTS "principals_update_applications" ON public.job_applications;

CREATE POLICY "principals_view_applications"
ON public.job_applications
FOR SELECT
TO authenticated
USING (
  public.is_preschool_admin()
  AND EXISTS (
    SELECT 1
    FROM public.job_postings jp
    WHERE jp.id = job_applications.job_posting_id
      AND jp.preschool_id = public.get_current_user_preschool_id()
  )
);

CREATE POLICY "principals_update_applications"
ON public.job_applications
FOR UPDATE
TO authenticated
USING (
  public.is_preschool_admin()
  AND EXISTS (
    SELECT 1
    FROM public.job_postings jp
    WHERE jp.id = job_applications.job_posting_id
      AND jp.preschool_id = public.get_current_user_preschool_id()
  )
)
WITH CHECK (
  public.is_preschool_admin()
  AND EXISTS (
    SELECT 1
    FROM public.job_postings jp
    WHERE jp.id = job_applications.job_posting_id
      AND jp.preschool_id = public.get_current_user_preschool_id()
  )
);
