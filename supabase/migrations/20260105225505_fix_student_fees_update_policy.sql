-- Fix student_fees RLS policy for fee status updates
-- 
-- Problem: When a principal/teacher/admin approves a POP, the updateFeeStatus function
-- in paymentProcessing.ts tries to update student_fees.status to 'paid', but the current
-- RLS policy only allows principals via organizations.principal_id check.
--
-- This causes fee status to remain 'pending' even after POP approval.
--
-- Solution: Create comprehensive UPDATE policies for:
-- 1. Principals (via organizations.principal_id)
-- 2. Admins/Teachers (via organization_members with admin role)
-- 3. Staff members linked to the preschool

-- =====================================================
-- STUDENT_FEES UPDATE POLICIES
-- =====================================================

-- Drop the old policy that combines all operations
DROP POLICY IF EXISTS "principals_manage_org_fees" ON student_fees;

-- Create separate SELECT policy for staff
CREATE POLICY "staff_view_org_fees" ON student_fees
FOR SELECT
TO authenticated
USING (
  -- Principals via organizations table
  organization_id IN (
    SELECT id FROM organizations WHERE principal_id = auth.uid()
  )
  OR
  -- Principals via preschools table
  organization_id IN (
    SELECT id FROM preschools WHERE principal_id = auth.uid()
  )
  OR
  -- Organization members (admin, teacher, staff)
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
    AND role IN ('admin', 'principal', 'teacher', 'staff', 'finance')
  )
  OR
  -- Teachers via preschool_teachers
  organization_id IN (
    SELECT preschool_id FROM preschool_teachers 
    WHERE teacher_id = auth.uid()
  )
  OR
  -- Direct preschool_id link in profiles
  organization_id IN (
    SELECT preschool_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('principal', 'teacher', 'admin')
    AND preschool_id IS NOT NULL
  )
);

-- Create UPDATE policy for staff to mark fees as paid
CREATE POLICY "staff_update_org_fees" ON student_fees
FOR UPDATE
TO authenticated
USING (
  -- Principals via organizations table
  organization_id IN (
    SELECT id FROM organizations WHERE principal_id = auth.uid()
  )
  OR
  -- Principals via preschools table
  organization_id IN (
    SELECT id FROM preschools WHERE principal_id = auth.uid()
  )
  OR
  -- Organization members with appropriate roles
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
    AND role IN ('admin', 'principal', 'teacher', 'staff', 'finance')
  )
  OR
  -- Teachers via preschool_teachers
  organization_id IN (
    SELECT preschool_id FROM preschool_teachers 
    WHERE teacher_id = auth.uid()
  )
  OR
  -- Direct preschool_id link in profiles
  organization_id IN (
    SELECT preschool_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('principal', 'teacher', 'admin')
    AND preschool_id IS NOT NULL
  )
)
WITH CHECK (
  -- Same conditions for the new row
  organization_id IN (
    SELECT id FROM organizations WHERE principal_id = auth.uid()
  )
  OR
  organization_id IN (
    SELECT id FROM preschools WHERE principal_id = auth.uid()
  )
  OR
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
    AND role IN ('admin', 'principal', 'teacher', 'staff', 'finance')
  )
  OR
  organization_id IN (
    SELECT preschool_id FROM preschool_teachers 
    WHERE teacher_id = auth.uid()
  )
  OR
  organization_id IN (
    SELECT preschool_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('principal', 'teacher', 'admin')
    AND preschool_id IS NOT NULL
  )
);

-- Create INSERT policy for staff
CREATE POLICY "staff_insert_org_fees" ON student_fees
FOR INSERT
TO authenticated
WITH CHECK (
  -- Principals via organizations table
  organization_id IN (
    SELECT id FROM organizations WHERE principal_id = auth.uid()
  )
  OR
  -- Principals via preschools table
  organization_id IN (
    SELECT id FROM preschools WHERE principal_id = auth.uid()
  )
  OR
  -- Organization members with appropriate roles
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
    AND role IN ('admin', 'principal', 'teacher', 'staff', 'finance')
  )
  OR
  -- Direct preschool_id link in profiles
  organization_id IN (
    SELECT preschool_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('principal', 'teacher', 'admin')
    AND preschool_id IS NOT NULL
  )
);

-- Create DELETE policy for staff (principals only)
CREATE POLICY "principals_delete_org_fees" ON student_fees
FOR DELETE
TO authenticated
USING (
  -- Principals via organizations table
  organization_id IN (
    SELECT id FROM organizations WHERE principal_id = auth.uid()
  )
  OR
  -- Principals via preschools table
  organization_id IN (
    SELECT id FROM preschools WHERE principal_id = auth.uid()
  )
  OR
  -- Organization members with admin/principal role
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
    AND role IN ('admin', 'principal')
  )
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Add indexes to optimize the policy queries
CREATE INDEX IF NOT EXISTS idx_org_members_user_status_role 
  ON organization_members(user_id, status, role) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_preschool_teachers_teacher_id 
  ON preschool_teachers(teacher_id);

CREATE INDEX IF NOT EXISTS idx_profiles_preschool_role 
  ON profiles(id, preschool_id, role) 
  WHERE preschool_id IS NOT NULL;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "staff_view_org_fees" ON student_fees IS 
'Allows principals, teachers, and staff to view fees for their organization.
Checks multiple sources: organizations.principal_id, preschools.principal_id, 
organization_members, preschool_teachers, and profiles.';

COMMENT ON POLICY "staff_update_org_fees" ON student_fees IS 
'Allows principals, teachers, and staff to update fee status (e.g., mark as paid).
Critical for POP approval workflow to update student_fees.status to paid.';

COMMENT ON POLICY "staff_insert_org_fees" ON student_fees IS 
'Allows principals, teachers, and staff to create new fee records for students.';

COMMENT ON POLICY "principals_delete_org_fees" ON student_fees IS 
'Allows only principals and admins to delete fee records (restricted operation).';
