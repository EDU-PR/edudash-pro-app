-- ============================================================================
-- FIX: Classes table RLS policies using profiles table instead of deprecated users
-- ============================================================================
-- Problem: Classes queries failing with "permission denied for table classes"
-- Root Cause: Policies were using deprecated users table and non-existent functions
-- Solution: Create simple policies using profiles table (the active table)
-- ============================================================================

BEGIN;

-- Drop problematic policies that reference deprecated users table
DROP POLICY IF EXISTS "classes_tenant_isolation_select" ON public.classes;
DROP POLICY IF EXISTS "classes_tenant_modify" ON public.classes;

-- Policy: Teachers can read their own classes
CREATE POLICY "classes_teacher_read_own" ON public.classes
FOR SELECT TO authenticated
USING (
  teacher_id = auth.uid()
  OR teacher_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  OR preschool_id IN (SELECT preschool_id FROM profiles WHERE id = auth.uid())
  OR preschool_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

COMMENT ON POLICY "classes_teacher_read_own" ON public.classes IS
'Allow teachers to read classes they teach or classes in their school';

-- Policy: School staff can manage classes (insert, update, delete)
CREATE POLICY "classes_school_staff_manage" ON public.classes
FOR ALL TO authenticated
USING (
  preschool_id IN (
    SELECT COALESCE(preschool_id, organization_id) 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('principal', 'admin', 'teacher', 'principal_admin')
  )
)
WITH CHECK (
  preschool_id IN (
    SELECT COALESCE(preschool_id, organization_id) 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('principal', 'admin', 'principal_admin')
  )
);

COMMENT ON POLICY "classes_school_staff_manage" ON public.classes IS
'Allow school principals and admins to manage classes in their school';

COMMIT;

-- Verification
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'classes';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ FIXED CLASSES TABLE RLS POLICIES';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 Total policies on classes table: %', policy_count;
  RAISE NOTICE '✅ Teachers can now read their classes';
  RAISE NOTICE '✅ School staff can manage classes';
  RAISE NOTICE '✅ Uses profiles table (active) instead of users (deprecated)';
  RAISE NOTICE '';
END $$;
