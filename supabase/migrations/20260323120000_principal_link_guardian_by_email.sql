-- Principal: link a second parent/guardian to a student by email.
-- Caller must be principal/admin for the student's school.
-- Resolves profile by email, sets students.guardian_id, and links relationship.

CREATE OR REPLACE FUNCTION public.principal_link_guardian_by_email(
  p_student_id UUID,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_guardian_id UUID;
  v_caller_can_manage BOOLEAN;
BEGIN
  -- Get student and school
  SELECT id, preschool_id, parent_id, guardian_id
  INTO v_student
  FROM public.students
  WHERE id = p_student_id;

  IF v_student.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Student not found.');
  END IF;

  -- Caller must be principal/admin for this school
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (COALESCE(p.preschool_id, p.organization_id) = v_student.preschool_id)
      AND p.role IN ('principal', 'admin', 'principal_admin', 'super_admin')
  ) INTO v_caller_can_manage;

  IF NOT v_caller_can_manage THEN
    RETURN jsonb_build_object('error', 'You do not have permission to manage this student.');
  END IF;

  -- Resolve guardian profile by email (profiles.email)
  SELECT id INTO v_guardian_id
  FROM public.profiles
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_guardian_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No account found with this email. The person must sign up first.');
  END IF;

  IF v_guardian_id = v_student.parent_id THEN
    RETURN jsonb_build_object('error', 'This person is already the primary parent.');
  END IF;

  IF v_guardian_id = v_student.guardian_id THEN
    RETURN jsonb_build_object('error', 'This person is already linked as second parent/guardian.');
  END IF;

  -- Ensure relationship row exists (multi-parent support)
  INSERT INTO public.student_parent_relationships (
    student_id,
    parent_id,
    relationship_type,
    is_primary
  )
  SELECT p_student_id, v_guardian_id, 'guardian', false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.student_parent_relationships
    WHERE student_id = p_student_id AND parent_id = v_guardian_id
  );

  -- Set guardian_id on student
  UPDATE public.students
  SET guardian_id = v_guardian_id
  WHERE id = p_student_id;

  -- Link profile to school if RPC exists
  BEGIN
    PERFORM public.link_profile_to_school(
      v_guardian_id,
      v_student.preschool_id,
      'parent'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Non-blocking
  END;

  RETURN jsonb_build_object('success', true, 'guardian_id', v_guardian_id);
END;
$$;

COMMENT ON FUNCTION public.principal_link_guardian_by_email(UUID, TEXT) IS
  'Principal/admin links a second parent/guardian to a student by their account email.';
