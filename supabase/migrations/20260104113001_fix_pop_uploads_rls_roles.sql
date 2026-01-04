-- Fix pop_uploads RLS policies: change role from 'public' to 'authenticated'
-- Bug: RLS policies were created with 'public' role instead of 'authenticated'
-- This caused 403 errors for authenticated users trying to INSERT/UPDATE/DELETE
-- Affected user: Suzan Makena (parent) couldn't upload proof of payment

-- ============================================================================
-- FIX INSERT POLICY
-- ============================================================================
DROP POLICY IF EXISTS pop_uploads_parent_insert ON pop_uploads;

CREATE POLICY pop_uploads_parent_insert ON pop_uploads
FOR INSERT TO authenticated
WITH CHECK (
  -- Uploader must be the authenticated user
  (uploaded_by = auth.uid()) 
  AND (
    -- Parent can upload for their own active children
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = pop_uploads.student_id 
        AND s.parent_id = auth.uid() 
        AND s.is_active = true
    )
    OR
    -- Staff can upload for students in their organization
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
        AND p.role IN ('teacher', 'admin', 'principal')
        AND p.organization_id = pop_uploads.preschool_id
    )
  )
);

-- ============================================================================
-- FIX PARENT UPDATE POLICY
-- ============================================================================
DROP POLICY IF EXISTS pop_uploads_parent_update ON pop_uploads;

CREATE POLICY pop_uploads_parent_update ON pop_uploads
FOR UPDATE TO authenticated
USING (
  -- Parent can only update their own pending uploads
  uploaded_by = auth.uid() 
  AND status = 'pending'
)
WITH CHECK (
  uploaded_by = auth.uid() 
  AND status = 'pending'
);

-- ============================================================================
-- FIX STAFF UPDATE POLICY
-- ============================================================================
DROP POLICY IF EXISTS pop_uploads_staff_update ON pop_uploads;

CREATE POLICY pop_uploads_staff_update ON pop_uploads
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
      AND p.role IN ('teacher', 'admin', 'principal')
      AND p.organization_id = pop_uploads.preschool_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
      AND p.role IN ('teacher', 'admin', 'principal')
      AND p.organization_id = pop_uploads.preschool_id
  )
);

-- ============================================================================
-- FIX STAFF DELETE POLICY
-- ============================================================================
DROP POLICY IF EXISTS pop_uploads_staff_delete ON pop_uploads;

CREATE POLICY pop_uploads_staff_delete ON pop_uploads
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'principal')
      AND p.organization_id = pop_uploads.preschool_id
  )
);

-- ============================================================================
-- NOTE: SELECT policy (pop_uploads_tenant_select) already uses 'authenticated'
-- ============================================================================
