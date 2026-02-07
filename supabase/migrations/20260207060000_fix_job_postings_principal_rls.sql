-- =============================================================================
-- Fix job_postings RLS: prevent anon/public reads from evaluating principal-only
-- policies that reference private tables (users/profiles).
--
-- Symptom (web):
-- - GET /rest/v1/job_postings ... returns 401 with messages like:
--   - "permission denied for table users"
--   - "infinite recursion detected in policy for relation \"profiles\""
--
-- Root cause:
-- - Legacy job_postings principal policies were created with TO public, so they
--   apply to anon as well. Their USING clauses reference tables that anon
--   cannot read, causing the entire SELECT to error even though a public
--   "active postings" policy exists.
--
-- Fix:
-- - Keep a dedicated public policy for active, non-expired postings (anon + authenticated)
-- - Scope principal/admin manage policies to authenticated only
-- - Use SECURITY DEFINER helper functions to avoid direct table access in RLS expressions
-- =============================================================================

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- Public read for active postings (web apply / teacher sign-up pages)
DROP POLICY IF EXISTS "public_view_active_job_postings" ON public.job_postings;
CREATE POLICY "public_view_active_job_postings"
ON public.job_postings
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  AND (expires_at IS NULL OR expires_at > now())
);

-- Remove legacy principal policies that incorrectly apply to anon/public.
DROP POLICY IF EXISTS "principals_create_job_postings" ON public.job_postings;
DROP POLICY IF EXISTS "principals_update_job_postings" ON public.job_postings;
DROP POLICY IF EXISTS "principals_delete_job_postings" ON public.job_postings;
DROP POLICY IF EXISTS "principals_view_own_school_job_postings" ON public.job_postings;

-- Principal/admin visibility: see all job postings for their school (including drafts/expired).
CREATE POLICY "principals_view_own_school_job_postings"
ON public.job_postings
FOR SELECT
TO authenticated
USING (
  public.is_preschool_admin()
  AND preschool_id = public.get_current_user_preschool_id()
);

-- Principal/admin create: require created_by = auth.uid() for audit correctness.
CREATE POLICY "principals_create_job_postings"
ON public.job_postings
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_preschool_admin()
  AND preschool_id = public.get_current_user_preschool_id()
  AND created_by = auth.uid()
);

-- Principal/admin update: allow edits within their school.
CREATE POLICY "principals_update_job_postings"
ON public.job_postings
FOR UPDATE
TO authenticated
USING (
  public.is_preschool_admin()
  AND preschool_id = public.get_current_user_preschool_id()
)
WITH CHECK (
  public.is_preschool_admin()
  AND preschool_id = public.get_current_user_preschool_id()
);

-- Principal/admin delete: allow deletes within their school.
CREATE POLICY "principals_delete_job_postings"
ON public.job_postings
FOR DELETE
TO authenticated
USING (
  public.is_preschool_admin()
  AND preschool_id = public.get_current_user_preschool_id()
);

