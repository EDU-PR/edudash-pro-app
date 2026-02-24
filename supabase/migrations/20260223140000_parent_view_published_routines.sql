-- Migration: Allow parents to view published weekly programs and their blocks
-- Root cause: RLS policies only allowed school staff (teacher/principal/admin).
-- Parents with role='parent' received 0 rows silently due to no matching policy.

-- ── weekly_programs ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS parents_view_published_weekly_programs ON weekly_programs;
CREATE POLICY parents_view_published_weekly_programs
  ON weekly_programs
  FOR SELECT
  USING (
    status = 'published'
    AND (
      -- Parent's own profile is linked to this school
      EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'parent'
          AND COALESCE(p.organization_id, p.preschool_id) = weekly_programs.preschool_id
      )
      OR
      -- Parent has a child enrolled at this school (belt-and-suspenders)
      EXISTS (
        SELECT 1
        FROM students s
        WHERE (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
          AND s.is_active = true
          AND s.preschool_id = weekly_programs.preschool_id
      )
    )
  );

-- Allow students to view published routines for their own school
DROP POLICY IF EXISTS students_view_published_weekly_programs ON weekly_programs;
CREATE POLICY students_view_published_weekly_programs
  ON weekly_programs
  FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'student'
        AND COALESCE(p.organization_id, p.preschool_id) = weekly_programs.preschool_id
    )
  );

-- ── daily_program_blocks ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS parents_view_published_daily_program_blocks ON daily_program_blocks;
CREATE POLICY parents_view_published_daily_program_blocks
  ON daily_program_blocks
  FOR SELECT
  USING (
    -- Block belongs to a published program that the parent's child attends
    EXISTS (
      SELECT 1
      FROM weekly_programs wp
      WHERE wp.id = daily_program_blocks.weekly_program_id
        AND wp.status = 'published'
        AND (
          EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'parent'
              AND COALESCE(p.organization_id, p.preschool_id) = wp.preschool_id
          )
          OR
          EXISTS (
            SELECT 1
            FROM students s
            WHERE (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
              AND s.is_active = true
              AND s.preschool_id = wp.preschool_id
          )
        )
    )
  );

DROP POLICY IF EXISTS students_view_published_daily_program_blocks ON daily_program_blocks;
CREATE POLICY students_view_published_daily_program_blocks
  ON daily_program_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM weekly_programs wp
      JOIN profiles p ON p.id = auth.uid()
      WHERE wp.id = daily_program_blocks.weekly_program_id
        AND wp.status = 'published'
        AND p.role = 'student'
        AND COALESCE(p.organization_id, p.preschool_id) = wp.preschool_id
    )
  );
