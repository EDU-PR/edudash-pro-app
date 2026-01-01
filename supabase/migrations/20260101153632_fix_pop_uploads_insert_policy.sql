-- =============================================
-- Fix POP Uploads RLS Policies
-- Bug: Original pop_uploads_tenant_modify policy only allowed teacher/admin/principal
-- Fix: Add policies allowing parents to upload POP for their children
-- Applied directly to production on 2026-01-01
-- =============================================

-- Drop the restrictive modify policy that blocked parents
DROP POLICY IF EXISTS "pop_uploads_tenant_modify" ON public.pop_uploads;

-- 1. Parents and staff can INSERT POP uploads
CREATE POLICY "pop_uploads_parent_insert"
ON public.pop_uploads FOR INSERT
WITH CHECK (
  -- Must be the uploader
  uploaded_by = auth.uid()
  AND (
    -- Parents can upload for their children
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = pop_uploads.student_id
        AND s.parent_id = auth.uid()
        AND s.is_active = TRUE
    )
    -- OR staff can upload for students in their organization
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'admin', 'principal')
        AND p.organization_id = pop_uploads.preschool_id
    )
  )
);

-- 2. Parents can UPDATE their own pending uploads
CREATE POLICY "pop_uploads_parent_update"
ON public.pop_uploads FOR UPDATE
USING (
  uploaded_by = auth.uid() 
  AND status = 'pending'
)
WITH CHECK (
  uploaded_by = auth.uid()
);

-- 3. Staff can UPDATE any upload in their organization (for review/approval)
CREATE POLICY "pop_uploads_staff_update"
ON public.pop_uploads FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'admin', 'principal')
      AND p.organization_id = preschool_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'admin', 'principal')
      AND p.organization_id = preschool_id
  )
);

-- 4. Staff can DELETE uploads in their organization
CREATE POLICY "pop_uploads_staff_delete"
ON public.pop_uploads FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'admin', 'principal')
      AND p.organization_id = preschool_id
  )
);
