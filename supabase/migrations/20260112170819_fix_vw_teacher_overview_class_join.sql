-- Fix vw_teacher_overview to correctly join classes with teachers
-- Issue: The view was joining classes.teacher_id with public.users.id,
--        but classes.teacher_id actually stores auth.users.id
-- Fix: Join directly with teachers.user_id (which stores auth.users.id)

DO $$
DECLARE
  has_teachers boolean;
  has_classes boolean;
  has_students boolean;
  has_teacher_user_id boolean;
  has_teacher_active boolean;
  has_class_teacher_id boolean;
  has_class_active boolean;
  has_class_preschool_id boolean;
  has_student_class_id boolean;
  has_student_active boolean;
  has_student_preschool_id boolean;
BEGIN
  has_teachers := to_regclass('public.teachers') IS NOT NULL;
  has_classes := to_regclass('public.classes') IS NOT NULL;
  has_students := to_regclass('public.students') IS NOT NULL;

  IF NOT has_teachers OR NOT has_classes OR NOT has_students THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teachers' AND column_name = 'user_id'
  ) INTO has_teacher_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teachers' AND column_name = 'is_active'
  ) INTO has_teacher_active;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'teacher_id'
  ) INTO has_class_teacher_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'active'
  ) INTO has_class_active;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'preschool_id'
  ) INTO has_class_preschool_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'class_id'
  ) INTO has_student_class_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'is_active'
  ) INTO has_student_active;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'preschool_id'
  ) INTO has_student_preschool_id;

  IF NOT has_teacher_user_id OR NOT has_teacher_active OR NOT has_class_teacher_id THEN
    RETURN;
  END IF;

  IF NOT has_class_active OR NOT has_class_preschool_id OR NOT has_student_class_id
     OR NOT has_student_active OR NOT has_student_preschool_id THEN
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE VIEW vw_teacher_overview AS
    SELECT 
        t.id AS teacher_id,
        t.user_id AS teacher_auth_user_id,
        t.user_id AS public_user_id,
        t.email,
        t.preschool_id,
        COALESCE(COUNT(DISTINCT c.id), 0)::integer AS class_count,
        COALESCE(COUNT(s.id), 0)::integer AS student_count,
        COALESCE(string_agg(DISTINCT c.name, ', ' ORDER BY c.name), '')::text AS classes_text
    FROM teachers t
    LEFT JOIN classes c ON c.teacher_id = t.user_id 
        AND c.active = true 
        AND c.preschool_id = t.preschool_id
    LEFT JOIN students s ON s.class_id = c.id 
        AND s.is_active = true 
        AND s.preschool_id = t.preschool_id
    WHERE t.is_active = true 
        AND t.preschool_id = current_preschool_id()
    GROUP BY t.id, t.user_id, t.email, t.preschool_id;
  $ddl$;

  EXECUTE $ddl$
    COMMENT ON VIEW vw_teacher_overview IS 
    'Teacher overview with class and student counts. Uses RLS via current_preschool_id(). 
    Fixed on 2026-01-12: Changed join from public.users to teachers.user_id for correct class matching.';
  $ddl$;
END $$;
