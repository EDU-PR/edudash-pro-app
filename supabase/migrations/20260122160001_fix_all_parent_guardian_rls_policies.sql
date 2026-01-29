-- Migration: Fix ALL RLS policies that incorrectly use parent_id/guardian_id = auth.uid()
-- Adds helper functions and guards policy creation based on table/column existence.

DO $sql$
DECLARE
  has_students boolean := to_regclass('public.students') IS NOT NULL;
  has_profiles boolean := to_regclass('public.profiles') IS NOT NULL;
  has_classes boolean := to_regclass('public.classes') IS NOT NULL;
  has_user_can_view_classes boolean := to_regprocedure('public.user_can_view_classes(uuid, uuid)') IS NOT NULL;

  has_classes_preschool_id boolean := false;
  has_classes_teacher_id boolean := false;

  helpers_ready boolean := false;
BEGIN
  IF has_students THEN
    ALTER TABLE public.students
      ADD COLUMN IF NOT EXISTS parent_id uuid,
      ADD COLUMN IF NOT EXISTS guardian_id uuid,
      ADD COLUMN IF NOT EXISTS class_id uuid,
      ADD COLUMN IF NOT EXISTS preschool_id uuid;
  END IF;

  IF has_profiles THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS auth_user_id uuid,
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS preschool_id uuid,
      ADD COLUMN IF NOT EXISTS role text;
  END IF;

  IF has_classes THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'preschool_id'
    ) INTO has_classes_preschool_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'teacher_id'
    ) INTO has_classes_teacher_id;
  END IF;

  helpers_ready := has_students AND has_profiles;

  -- Helper functions
  IF helpers_ready THEN
    CREATE OR REPLACE FUNCTION public.is_parent_of_student(p_student_id UUID)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'auth'
    AS $$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
        WHERE s.id = p_student_id
          AND p.auth_user_id = auth.uid()
      );
    END;
    $$;

    CREATE OR REPLACE FUNCTION public.get_my_children_ids()
    RETURNS SETOF UUID
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'auth'
    AS $$
      SELECT s.id FROM public.students s
      JOIN public.profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
      WHERE p.auth_user_id = auth.uid();
    $$;

    CREATE OR REPLACE FUNCTION public.get_my_children_class_ids()
    RETURNS SETOF UUID
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'auth'
    AS $$
      SELECT DISTINCT s.class_id FROM public.students s
      JOIN public.profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
      WHERE p.auth_user_id = auth.uid()
        AND s.class_id IS NOT NULL;
    $$;

    CREATE OR REPLACE FUNCTION public.get_my_children_preschool_ids()
    RETURNS SETOF UUID
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'auth'
    AS $$
      SELECT DISTINCT s.preschool_id FROM public.students s
      JOIN public.profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
      WHERE p.auth_user_id = auth.uid()
        AND s.preschool_id IS NOT NULL;
    $$;

    COMMENT ON FUNCTION public.get_my_children_ids() IS 'Returns student IDs where current user is parent/guardian. Uses auth_user_id for proper auth check.';
    COMMENT ON FUNCTION public.get_my_children_class_ids() IS 'Returns class IDs of students where current user is parent/guardian.';
    COMMENT ON FUNCTION public.get_my_children_preschool_ids() IS 'Returns preschool IDs of students where current user is parent/guardian.';
    COMMENT ON FUNCTION public.is_parent_of_student(UUID) IS 'Check if current authenticated user is parent/guardian of given student.';
  END IF;

  -- Students policies
  IF helpers_ready THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_view_school_students ON public.students';
    EXECUTE 'CREATE POLICY parents_view_school_students ON public.students FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND (students.parent_id = p.id OR students.guardian_id = p.id OR COALESCE(p.organization_id, p.preschool_id) = students.preschool_id)))';

    EXECUTE 'DROP POLICY IF EXISTS students_parent_access ON public.students';
    EXECUTE 'CREATE POLICY students_parent_access ON public.students FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.role = ''parent'' AND (students.parent_id = p.id OR students.guardian_id = p.id OR COALESCE(p.organization_id, p.preschool_id) = students.preschool_id)))';

    EXECUTE 'DROP POLICY IF EXISTS students_parent_update_own_children ON public.students';
    EXECUTE 'CREATE POLICY students_parent_update_own_children ON public.students FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND (students.parent_id = p.id OR students.guardian_id = p.id))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND (students.parent_id = p.id OR students.guardian_id = p.id)))';
  END IF;

  -- Classes policies
  IF helpers_ready AND has_classes AND has_classes_preschool_id AND has_classes_teacher_id THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_view_child_classes ON public.classes';
    IF has_user_can_view_classes THEN
      EXECUTE 'CREATE POLICY parents_view_child_classes ON public.classes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.students s JOIN public.profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id) WHERE p.auth_user_id = auth.uid() AND s.class_id = classes.id) OR public.user_can_view_classes(classes.preschool_id, classes.teacher_id))';
    ELSE
      EXECUTE 'CREATE POLICY parents_view_child_classes ON public.classes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.students s JOIN public.profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id) WHERE p.auth_user_id = auth.uid() AND s.class_id = classes.id))';
    END IF;

    EXECUTE 'DROP POLICY IF EXISTS classes_org_members_select ON public.classes';
    EXECUTE 'CREATE POLICY classes_org_members_select ON public.classes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND COALESCE(p.organization_id, p.preschool_id) = classes.preschool_id))';
  END IF;

  -- Homework assignments
  IF helpers_ready AND to_regclass('public.homework_assignments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS homework_assignments_parent_read_access ON public.homework_assignments';
    EXECUTE 'CREATE POLICY homework_assignments_parent_read_access ON public.homework_assignments FOR SELECT TO authenticated USING (class_id IN (SELECT public.get_my_children_class_ids()) OR preschool_id IN (SELECT public.get_my_children_preschool_ids()))';
  END IF;

  -- Attendance records
  IF helpers_ready AND to_regclass('public.attendance_records') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS attendance_records_parent_access ON public.attendance_records';
    EXECUTE 'CREATE POLICY attendance_records_parent_access ON public.attendance_records FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Invoices
  IF helpers_ready AND to_regclass('public.invoices') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS invoices_parent_access ON public.invoices';
    EXECUTE 'CREATE POLICY invoices_parent_access ON public.invoices FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Video calls
  IF helpers_ready AND to_regclass('public.video_calls') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS video_calls_parent_select ON public.video_calls';
    EXECUTE 'CREATE POLICY video_calls_parent_select ON public.video_calls FOR SELECT TO authenticated USING (class_id IN (SELECT public.get_my_children_class_ids()) OR preschool_id IN (SELECT public.get_my_children_preschool_ids()))';
  END IF;

  -- Emergency contacts
  IF helpers_ready AND to_regclass('public.emergency_contacts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS emergency_contacts_parent_child ON public.emergency_contacts';
    EXECUTE 'CREATE POLICY emergency_contacts_parent_child ON public.emergency_contacts FOR ALL TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Homework submissions
  IF helpers_ready AND to_regclass('public.homework_submissions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS homework_submissions_parent_child ON public.homework_submissions';
    EXECUTE 'CREATE POLICY homework_submissions_parent_child ON public.homework_submissions FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Student enrollments
  IF helpers_ready AND to_regclass('public.student_enrollments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS student_enrollments_parent_child ON public.student_enrollments';
    EXECUTE 'CREATE POLICY student_enrollments_parent_child ON public.student_enrollments FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Activity progress
  IF helpers_ready AND to_regclass('public.activity_progress') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS activity_progress_parent_child ON public.activity_progress';
    EXECUTE 'CREATE POLICY activity_progress_parent_child ON public.activity_progress FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Assignment submissions
  IF helpers_ready AND to_regclass('public.assignment_submissions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS assignment_submissions_parent_child ON public.assignment_submissions';
    EXECUTE 'CREATE POLICY assignment_submissions_parent_child ON public.assignment_submissions FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Student parent relationships
  IF helpers_ready AND to_regclass('public.student_parent_relationships') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Parents can view their relationships" ON public.student_parent_relationships';
    EXECUTE 'CREATE POLICY parents_view_their_relationships ON public.student_parent_relationships FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Attendance
  IF helpers_ready AND to_regclass('public.attendance') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS attendance_parent_child ON public.attendance';
    EXECUTE 'CREATE POLICY attendance_parent_child ON public.attendance FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Student fees
  IF helpers_ready AND to_regclass('public.student_fees') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS student_fees_parent_child ON public.student_fees';
    EXECUTE 'CREATE POLICY student_fees_parent_child ON public.student_fees FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Activity attempts
  IF helpers_ready AND to_regclass('public.activity_attempts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS activity_attempts_parent_child ON public.activity_attempts';
    EXECUTE 'CREATE POLICY activity_attempts_parent_child ON public.activity_attempts FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';

    EXECUTE 'DROP POLICY IF EXISTS activity_attempts_update ON public.activity_attempts';
    EXECUTE 'CREATE POLICY activity_attempts_update ON public.activity_attempts FOR UPDATE TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Parent child links
  IF helpers_ready AND to_regclass('public.parent_child_links') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS parent_child_links_access ON public.parent_child_links';
    EXECUTE 'CREATE POLICY parent_child_links_access ON public.parent_child_links FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND (parent_child_links.parent_id = p.id OR parent_child_links.child_id IN (SELECT public.get_my_children_ids()))))';
  END IF;

  -- Class assignments
  IF helpers_ready AND to_regclass('public.class_assignments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS class_assignments_parent_child ON public.class_assignments';
    EXECUTE 'CREATE POLICY class_assignments_parent_child ON public.class_assignments FOR SELECT TO authenticated USING (class_id IN (SELECT public.get_my_children_class_ids()))';
  END IF;

  -- Gradebook entries
  IF helpers_ready AND to_regclass('public.gradebook_entries') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Parents can view their children''s gradebook entries" ON public.gradebook_entries';
    EXECUTE 'CREATE POLICY parents_view_children_gradebook_entries ON public.gradebook_entries FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Course grades
  IF helpers_ready AND to_regclass('public.course_grades') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Parents can view their children''s course grades" ON public.course_grades';
    EXECUTE 'CREATE POLICY parents_view_children_course_grades ON public.course_grades FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Student progress
  IF helpers_ready AND to_regclass('public.student_progress') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Parents can view their children''s progress" ON public.student_progress';
    EXECUTE 'CREATE POLICY parents_view_children_progress ON public.student_progress FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- School fee structures
  IF helpers_ready AND to_regclass('public.school_fee_structures') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Parents can view fee structures for their children''s school" ON public.school_fee_structures';
    EXECUTE 'CREATE POLICY parents_view_fee_structures ON public.school_fee_structures FOR SELECT TO authenticated USING (preschool_id IN (SELECT public.get_my_children_preschool_ids()))';
  END IF;

  -- Student fee assignments
  IF helpers_ready AND to_regclass('public.student_fee_assignments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Parents can view their children''s fees" ON public.student_fee_assignments';
    EXECUTE 'CREATE POLICY parents_view_children_fees ON public.student_fee_assignments FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Fee payments
  IF helpers_ready AND to_regclass('public.fee_payments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Parents can view their payments" ON public.fee_payments';
    EXECUTE 'CREATE POLICY parents_view_their_payments ON public.fee_payments FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Scheduled lessons
  IF helpers_ready AND to_regclass('public.scheduled_lessons') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS scheduled_lessons_parent_select ON public.scheduled_lessons';
    EXECUTE 'CREATE POLICY scheduled_lessons_parent_select ON public.scheduled_lessons FOR SELECT TO authenticated USING (class_id IN (SELECT public.get_my_children_class_ids()))';
  END IF;

  -- Child registration requests
  IF helpers_ready AND to_regclass('public.child_registration_requests') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS child_registration_requests_parent_update ON public.child_registration_requests';
    EXECUTE 'CREATE POLICY child_registration_requests_parent_update ON public.child_registration_requests FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND child_registration_requests.parent_id = p.id))';

    EXECUTE 'DROP POLICY IF EXISTS child_registration_requests_parent_view ON public.child_registration_requests';
    EXECUTE 'CREATE POLICY child_registration_requests_parent_view ON public.child_registration_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND child_registration_requests.parent_id = p.id))';
  END IF;

  -- Student achievements
  IF helpers_ready AND to_regclass('public.student_achievements') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS achievements_select ON public.student_achievements';
    EXECUTE 'CREATE POLICY achievements_select ON public.student_achievements FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Student streaks
  IF helpers_ready AND to_regclass('public.student_streaks') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS streaks_select ON public.student_streaks';
    EXECUTE 'CREATE POLICY streaks_select ON public.student_streaks FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Interactive activities
  IF helpers_ready AND to_regclass('public.interactive_activities') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS interactive_activities_select ON public.interactive_activities';
    EXECUTE 'CREATE POLICY interactive_activities_select ON public.interactive_activities FOR SELECT TO authenticated USING (preschool_id IN (SELECT public.get_my_children_preschool_ids()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND COALESCE(p.organization_id, p.preschool_id) = interactive_activities.preschool_id))';

    EXECUTE 'DROP POLICY IF EXISTS parents_view_interactive_activities ON public.interactive_activities';
    EXECUTE 'CREATE POLICY parents_view_interactive_activities ON public.interactive_activities FOR SELECT TO authenticated USING (preschool_id IN (SELECT public.get_my_children_preschool_ids()))';
  END IF;

  -- Student activity feed
  IF helpers_ready AND to_regclass('public.student_activity_feed') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS activity_feed_select ON public.student_activity_feed';
    EXECUTE 'CREATE POLICY activity_feed_select ON public.student_activity_feed FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Teacher student notes
  IF helpers_ready AND to_regclass('public.teacher_student_notes') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_acknowledge_notes ON public.teacher_student_notes';
    EXECUTE 'CREATE POLICY parents_acknowledge_notes ON public.teacher_student_notes FOR UPDATE TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';

    EXECUTE 'DROP POLICY IF EXISTS parents_view_child_notes ON public.teacher_student_notes';
    EXECUTE 'CREATE POLICY parents_view_child_notes ON public.teacher_student_notes FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Weekly learning reports
  IF helpers_ready AND to_regclass('public.weekly_learning_reports') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS weekly_reports_parent_select ON public.weekly_learning_reports';
    EXECUTE 'CREATE POLICY weekly_reports_parent_select ON public.weekly_learning_reports FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Activity reactions
  IF helpers_ready AND to_regclass('public.activity_reactions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS activity_reactions_parent_select ON public.activity_reactions';
    EXECUTE 'CREATE POLICY activity_reactions_parent_select ON public.activity_reactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.student_activity_feed saf WHERE saf.id = activity_reactions.activity_id AND saf.student_id IN (SELECT public.get_my_children_ids())))';
  END IF;

  -- Activity comments
  IF helpers_ready AND to_regclass('public.activity_comments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS activity_comments_parent_select ON public.activity_comments';
    EXECUTE 'CREATE POLICY activity_comments_parent_select ON public.activity_comments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.student_activity_feed saf WHERE saf.id = activity_comments.activity_id AND saf.student_id IN (SELECT public.get_my_children_ids())))';
  END IF;

  -- Lesson assignments
  IF helpers_ready AND to_regclass('public.lesson_assignments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_view_child_assignments ON public.lesson_assignments';
    EXECUTE 'CREATE POLICY parents_view_child_assignments ON public.lesson_assignments FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Lesson completions
  IF helpers_ready AND to_regclass('public.lesson_completions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_view_child_completions ON public.lesson_completions';
    EXECUTE 'CREATE POLICY parents_view_child_completions ON public.lesson_completions FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- Student progress summary
  IF helpers_ready AND to_regclass('public.student_progress_summary') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_view_child_progress_summary ON public.student_progress_summary';
    EXECUTE 'CREATE POLICY parents_view_child_progress_summary ON public.student_progress_summary FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;

  -- STEM progress
  IF helpers_ready AND to_regclass('public.stem_progress') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_view_child_stem_progress ON public.stem_progress';
    EXECUTE 'CREATE POLICY parents_view_child_stem_progress ON public.stem_progress FOR SELECT TO authenticated USING (student_id IN (SELECT public.get_my_children_ids()))';
  END IF;
END $sql$;
