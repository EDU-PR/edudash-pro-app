-- Fix RLS for student_fees so staff access works with auth_user_id
-- Date: 2026-01-27

DROP POLICY IF EXISTS student_fees_staff_org ON student_fees;

CREATE POLICY student_fees_staff_org ON student_fees
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles staff
    JOIN students student ON student.id = student_fees.student_id
    WHERE (staff.auth_user_id = auth.uid() OR staff.id = auth.uid())
      AND staff.role = ANY (ARRAY['teacher'::text, 'admin'::text, 'principal'::text, 'principal_admin'::text, 'superadmin'::text, 'super_admin'::text])
      AND (
        staff.role IN ('superadmin'::text, 'super_admin'::text)
        OR COALESCE(staff.organization_id, staff.preschool_id) = COALESCE(student.organization_id, student.preschool_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles staff
    JOIN students student ON student.id = student_fees.student_id
    WHERE (staff.auth_user_id = auth.uid() OR staff.id = auth.uid())
      AND staff.role = ANY (ARRAY['teacher'::text, 'admin'::text, 'principal'::text, 'principal_admin'::text, 'superadmin'::text, 'super_admin'::text])
      AND (
        staff.role IN ('superadmin'::text, 'super_admin'::text)
        OR COALESCE(staff.organization_id, staff.preschool_id) = COALESCE(student.organization_id, student.preschool_id)
      )
  )
);
