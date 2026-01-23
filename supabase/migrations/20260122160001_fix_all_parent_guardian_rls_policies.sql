-- Migration: Fix ALL RLS policies that incorrectly use parent_id/guardian_id = auth.uid()
-- 
-- PROBLEM: Many policies check parent_id = auth.uid() or guardian_id = auth.uid()
-- But parent_id and guardian_id columns contain profile.id values (UUIDs), not auth.users UUIDs.
-- The auth.uid() function returns the auth.users UUID, which maps to profiles.auth_user_id,
-- NOT to profiles.id
--
-- SOLUTION: 
-- 1. Created helper functions that properly join to profiles table
-- 2. Replaced all buggy policies with ones using these helper functions
--
-- Helper functions created:
-- - is_parent_of_student(student_id UUID) - Check if current user is parent of specific student
-- - get_my_children_ids() - Returns all student IDs for current parent
-- - get_my_children_class_ids() - Returns all class IDs of current parent's children
-- - get_my_children_preschool_ids() - Returns all preschool IDs of current parent's children

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if current user is parent/guardian of a specific student
CREATE OR REPLACE FUNCTION public.is_parent_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM students s
        JOIN profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
        WHERE s.id = p_student_id
        AND p.auth_user_id = auth.uid()
    );
END;
$$;

-- Get all student IDs for current parent
CREATE OR REPLACE FUNCTION public.get_my_children_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
    SELECT s.id FROM students s
    JOIN profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
    WHERE p.auth_user_id = auth.uid();
$$;

-- Get all class IDs of current parent's children
CREATE OR REPLACE FUNCTION public.get_my_children_class_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
    SELECT DISTINCT s.class_id FROM students s
    JOIN profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
    WHERE p.auth_user_id = auth.uid()
    AND s.class_id IS NOT NULL;
$$;

-- Get all preschool IDs of current parent's children
CREATE OR REPLACE FUNCTION public.get_my_children_preschool_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
    SELECT DISTINCT s.preschool_id FROM students s
    JOIN profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
    WHERE p.auth_user_id = auth.uid()
    AND s.preschool_id IS NOT NULL;
$$;

-- ============================================================================
-- STUDENTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS parents_view_school_students ON students;
CREATE POLICY parents_view_school_students ON students
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND (
            students.parent_id = p.id 
            OR students.guardian_id = p.id
            OR COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
        )
    )
);

DROP POLICY IF EXISTS students_parent_access ON students;
CREATE POLICY students_parent_access ON students
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND p.role = 'parent'
        AND (
            students.parent_id = p.id 
            OR students.guardian_id = p.id
            OR COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
        )
    )
);

DROP POLICY IF EXISTS students_parent_update_own_children ON students;
CREATE POLICY students_parent_update_own_children ON students
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND (students.parent_id = p.id OR students.guardian_id = p.id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND (students.parent_id = p.id OR students.guardian_id = p.id)
    )
);

-- ============================================================================
-- CLASSES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS parents_view_child_classes ON classes;
CREATE POLICY parents_view_child_classes ON classes
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM students s
        JOIN profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
        WHERE p.auth_user_id = auth.uid()
        AND s.class_id = classes.id
    )
    OR user_can_view_classes(preschool_id, teacher_id)
);

DROP POLICY IF EXISTS classes_org_members_select ON classes;
CREATE POLICY classes_org_members_select ON classes
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND COALESCE(p.organization_id, p.preschool_id) = classes.preschool_id
    )
);

-- ============================================================================
-- ALL OTHER TABLES - Using helper functions
-- ============================================================================

-- homework_assignments
DROP POLICY IF EXISTS homework_assignments_parent_read_access ON homework_assignments;
CREATE POLICY homework_assignments_parent_read_access ON homework_assignments
FOR SELECT TO authenticated
USING (
    class_id IN (SELECT get_my_children_class_ids())
    OR preschool_id IN (SELECT get_my_children_preschool_ids())
);

-- attendance_records
DROP POLICY IF EXISTS attendance_records_parent_access ON attendance_records;
CREATE POLICY attendance_records_parent_access ON attendance_records
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- invoices
DROP POLICY IF EXISTS invoices_parent_access ON invoices;
CREATE POLICY invoices_parent_access ON invoices
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- video_calls
DROP POLICY IF EXISTS video_calls_parent_select ON video_calls;
CREATE POLICY video_calls_parent_select ON video_calls
FOR SELECT TO authenticated
USING (
    class_id IN (SELECT get_my_children_class_ids())
    OR preschool_id IN (SELECT get_my_children_preschool_ids())
);

-- emergency_contacts
DROP POLICY IF EXISTS emergency_contacts_parent_child ON emergency_contacts;
CREATE POLICY emergency_contacts_parent_child ON emergency_contacts
FOR ALL TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- homework_submissions
DROP POLICY IF EXISTS homework_submissions_parent_child ON homework_submissions;
CREATE POLICY homework_submissions_parent_child ON homework_submissions
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- student_enrollments
DROP POLICY IF EXISTS student_enrollments_parent_child ON student_enrollments;
CREATE POLICY student_enrollments_parent_child ON student_enrollments
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- activity_progress
DROP POLICY IF EXISTS activity_progress_parent_child ON activity_progress;
CREATE POLICY activity_progress_parent_child ON activity_progress
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- assignment_submissions
DROP POLICY IF EXISTS assignment_submissions_parent_child ON assignment_submissions;
CREATE POLICY assignment_submissions_parent_child ON assignment_submissions
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- student_parent_relationships
DROP POLICY IF EXISTS "Parents can view their relationships" ON student_parent_relationships;
CREATE POLICY parents_view_their_relationships ON student_parent_relationships
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- attendance
DROP POLICY IF EXISTS attendance_parent_child ON attendance;
CREATE POLICY attendance_parent_child ON attendance
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- student_fees
DROP POLICY IF EXISTS student_fees_parent_child ON student_fees;
CREATE POLICY student_fees_parent_child ON student_fees
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- activity_attempts
DROP POLICY IF EXISTS activity_attempts_parent_child ON activity_attempts;
CREATE POLICY activity_attempts_parent_child ON activity_attempts
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

DROP POLICY IF EXISTS activity_attempts_update ON activity_attempts;
CREATE POLICY activity_attempts_update ON activity_attempts
FOR UPDATE TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- parent_child_links
DROP POLICY IF EXISTS parent_child_links_access ON parent_child_links;
CREATE POLICY parent_child_links_access ON parent_child_links
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND (parent_child_links.parent_id = p.id OR parent_child_links.child_id IN (SELECT get_my_children_ids()))
    )
);

-- class_assignments
DROP POLICY IF EXISTS class_assignments_parent_child ON class_assignments;
CREATE POLICY class_assignments_parent_child ON class_assignments
FOR SELECT TO authenticated
USING (class_id IN (SELECT get_my_children_class_ids()));

-- gradebook_entries
DROP POLICY IF EXISTS "Parents can view their children's gradebook entries" ON gradebook_entries;
CREATE POLICY parents_view_children_gradebook_entries ON gradebook_entries
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- course_grades
DROP POLICY IF EXISTS "Parents can view their children's course grades" ON course_grades;
CREATE POLICY parents_view_children_course_grades ON course_grades
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- student_progress
DROP POLICY IF EXISTS "Parents can view their children's progress" ON student_progress;
CREATE POLICY parents_view_children_progress ON student_progress
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- school_fee_structures
DROP POLICY IF EXISTS "Parents can view fee structures for their children's school" ON school_fee_structures;
CREATE POLICY parents_view_fee_structures ON school_fee_structures
FOR SELECT TO authenticated
USING (preschool_id IN (SELECT get_my_children_preschool_ids()));

-- student_fee_assignments
DROP POLICY IF EXISTS "Parents can view their children's fees" ON student_fee_assignments;
CREATE POLICY parents_view_children_fees ON student_fee_assignments
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- fee_payments
DROP POLICY IF EXISTS "Parents can view their payments" ON fee_payments;
CREATE POLICY parents_view_their_payments ON fee_payments
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- scheduled_lessons
DROP POLICY IF EXISTS scheduled_lessons_parent_select ON scheduled_lessons;
CREATE POLICY scheduled_lessons_parent_select ON scheduled_lessons
FOR SELECT TO authenticated
USING (class_id IN (SELECT get_my_children_class_ids()));

-- child_registration_requests
DROP POLICY IF EXISTS child_registration_requests_parent_update ON child_registration_requests;
CREATE POLICY child_registration_requests_parent_update ON child_registration_requests
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND child_registration_requests.parent_id = p.id
    )
);

DROP POLICY IF EXISTS child_registration_requests_parent_view ON child_registration_requests;
CREATE POLICY child_registration_requests_parent_view ON child_registration_requests
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND child_registration_requests.parent_id = p.id
    )
);

-- student_achievements
DROP POLICY IF EXISTS achievements_select ON student_achievements;
CREATE POLICY achievements_select ON student_achievements
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- student_streaks
DROP POLICY IF EXISTS streaks_select ON student_streaks;
CREATE POLICY streaks_select ON student_streaks
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- interactive_activities
DROP POLICY IF EXISTS interactive_activities_select ON interactive_activities;
CREATE POLICY interactive_activities_select ON interactive_activities
FOR SELECT TO authenticated
USING (preschool_id IN (SELECT get_my_children_preschool_ids())
   OR EXISTS (
       SELECT 1 FROM profiles p
       WHERE p.auth_user_id = auth.uid()
       AND COALESCE(p.organization_id, p.preschool_id) = interactive_activities.preschool_id
   ));

DROP POLICY IF EXISTS parents_view_interactive_activities ON interactive_activities;
CREATE POLICY parents_view_interactive_activities ON interactive_activities
FOR SELECT TO authenticated
USING (preschool_id IN (SELECT get_my_children_preschool_ids()));

-- student_activity_feed
DROP POLICY IF EXISTS activity_feed_select ON student_activity_feed;
CREATE POLICY activity_feed_select ON student_activity_feed
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- teacher_student_notes
DROP POLICY IF EXISTS parents_acknowledge_notes ON teacher_student_notes;
CREATE POLICY parents_acknowledge_notes ON teacher_student_notes
FOR UPDATE TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

DROP POLICY IF EXISTS parents_view_child_notes ON teacher_student_notes;
CREATE POLICY parents_view_child_notes ON teacher_student_notes
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- weekly_learning_reports
DROP POLICY IF EXISTS weekly_reports_parent_select ON weekly_learning_reports;
CREATE POLICY weekly_reports_parent_select ON weekly_learning_reports
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- activity_reactions
DROP POLICY IF EXISTS activity_reactions_parent_select ON activity_reactions;
CREATE POLICY activity_reactions_parent_select ON activity_reactions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM student_activity_feed saf
        WHERE saf.id = activity_reactions.activity_id
        AND saf.student_id IN (SELECT get_my_children_ids())
    )
);

-- activity_comments
DROP POLICY IF EXISTS activity_comments_parent_select ON activity_comments;
CREATE POLICY activity_comments_parent_select ON activity_comments
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM student_activity_feed saf
        WHERE saf.id = activity_comments.activity_id
        AND saf.student_id IN (SELECT get_my_children_ids())
    )
);

-- lesson_assignments
DROP POLICY IF EXISTS parents_view_child_assignments ON lesson_assignments;
CREATE POLICY parents_view_child_assignments ON lesson_assignments
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- lesson_completions
DROP POLICY IF EXISTS parents_view_child_completions ON lesson_completions;
CREATE POLICY parents_view_child_completions ON lesson_completions
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- student_progress_summary
DROP POLICY IF EXISTS parents_view_child_progress_summary ON student_progress_summary;
CREATE POLICY parents_view_child_progress_summary ON student_progress_summary
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- stem_progress
DROP POLICY IF EXISTS parents_view_child_stem_progress ON stem_progress;
CREATE POLICY parents_view_child_stem_progress ON stem_progress
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION get_my_children_ids() IS 'Returns student IDs where current user is parent/guardian. Uses auth_user_id for proper auth check.';
COMMENT ON FUNCTION get_my_children_class_ids() IS 'Returns class IDs of students where current user is parent/guardian.';
COMMENT ON FUNCTION get_my_children_preschool_ids() IS 'Returns preschool IDs of students where current user is parent/guardian.';
COMMENT ON FUNCTION is_parent_of_student(UUID) IS 'Check if current authenticated user is parent/guardian of given student.';
