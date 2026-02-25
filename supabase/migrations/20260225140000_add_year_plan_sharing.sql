-- Add sharing columns to academic_terms for year plan sharing
-- Allows principals to mark plans as shared with teachers / parents

ALTER TABLE public.academic_terms
  ADD COLUMN IF NOT EXISTS shared_with_teachers BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.academic_terms
  ADD COLUMN IF NOT EXISTS shared_with_parents BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.academic_terms
  ADD COLUMN IF NOT EXISTS parent_visible_notes TEXT;

COMMENT ON COLUMN public.academic_terms.shared_with_teachers
  IS 'Whether the year plan term is visible to teachers';
COMMENT ON COLUMN public.academic_terms.shared_with_parents
  IS 'Whether the year plan term is visible to parents';
COMMENT ON COLUMN public.academic_terms.parent_visible_notes
  IS 'Optional notes from the principal visible only on the parent-facing view';

-- Allow parents to see terms that are shared with them
DROP POLICY IF EXISTS academic_terms_parent_view ON public.academic_terms;
CREATE POLICY academic_terms_parent_view
  ON public.academic_terms
  FOR SELECT
  USING (
    shared_with_parents = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'parent'
        AND COALESCE(p.organization_id, p.preschool_id) = academic_terms.preschool_id
    )
  );
