-- Parent-generated temporary lesson assignment (7-day expiry).

CREATE OR REPLACE FUNCTION public.create_parent_temp_lesson(
  p_child_id UUID,
  p_domain TEXT,
  p_activity_id TEXT,
  p_difficulty TEXT DEFAULT 'medium',
  p_reason TEXT DEFAULT NULL,
  p_snapshot JSONB DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_activity_type TEXT DEFAULT 'quiz',
  p_duration_minutes INTEGER DEFAULT 15
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile RECORD;
  v_student RECORD;
  v_tier TEXT;
  v_expires_at TIMESTAMPTZ := now() + INTERVAL '7 days';
  v_active_temp_count INTEGER := 0;
  v_interactive_id UUID;
  v_assignment_id UUID;
  v_subject TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'Child ID is required';
  END IF;

  IF p_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot payload is required';
  END IF;

  SELECT id, role, subscription_tier, preschool_id, organization_id
  INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF COALESCE(v_profile.role, '') <> 'parent' THEN
    RAISE EXCEPTION 'Only parents can create temporary lessons';
  END IF;

  v_tier := lower(COALESCE(v_profile.subscription_tier::text, 'free'));
  IF v_tier NOT IN ('parent_plus', 'teacher_pro', 'school_premium', 'school_pro', 'school_enterprise', 'premium', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'Your subscription tier does not allow temporary lessons';
  END IF;

  IF p_child_id NOT IN (SELECT public.get_my_children_ids()) THEN
    RAISE EXCEPTION 'Child not linked to this parent account';
  END IF;

  SELECT s.id, s.first_name, s.last_name, s.class_id, s.preschool_id
  INTO v_student
  FROM public.students s
  WHERE s.id = p_child_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  SELECT COUNT(*)
  INTO v_active_temp_count
  FROM public.lesson_assignments la
  JOIN public.interactive_activities ia
    ON ia.id = la.interactive_activity_id
  WHERE la.student_id = p_child_id
    AND la.status IN ('assigned', 'in_progress')
    AND COALESCE(ia.content->>'source', '') = 'dash_temp_lesson'
    AND COALESCE((ia.content->>'expires_at')::timestamptz, now() + INTERVAL '1 day') > now();

  IF v_active_temp_count >= 5 THEN
    RAISE EXCEPTION 'Active temporary lesson limit reached';
  END IF;

  v_subject := CASE lower(COALESCE(p_domain, ''))
    WHEN 'numeracy' THEN 'mathematics'
    WHEN 'literacy' THEN 'language'
    WHEN 'science' THEN 'science'
    WHEN 'gross_motor' THEN 'physical_education'
    WHEN 'fine_motor' THEN 'life_skills'
    WHEN 'social_emotional' THEN 'life_orientation'
    WHEN 'creative_arts' THEN 'creative_arts'
    ELSE 'life_skills'
  END;

  INSERT INTO public.interactive_activities (
    preschool_id,
    teacher_id,
    created_by,
    activity_type,
    title,
    description,
    instructions,
    content,
    difficulty_level,
    stars_reward,
    subject,
    stem_category,
    is_active,
    is_published,
    is_template
  )
  VALUES (
    v_student.preschool_id,
    NULL,
    v_user_id,
    COALESCE(NULLIF(lower(trim(p_activity_type)), ''), 'quiz'),
    COALESCE(NULLIF(trim(p_title), ''), 'Temporary Lesson • ' || initcap(replace(COALESCE(p_domain, 'general'), '_', ' '))),
    COALESCE(NULLIF(trim(p_reason), ''), 'Suggested by Dash based on recent performance'),
    'Temporary parent-assigned Dash activity',
    jsonb_build_object(
      'source', 'dash_temp_lesson',
      'preset_activity_id', p_activity_id,
      'difficulty', lower(COALESCE(p_difficulty, 'medium')),
      'domain', COALESCE(p_domain, 'cognitive'),
      'suggestion_reason', COALESCE(p_reason, ''),
      'expires_at', v_expires_at,
      'snapshot', p_snapshot
    ),
    CASE lower(COALESCE(p_difficulty, 'medium'))
      WHEN 'easy' THEN 1
      WHEN 'tricky' THEN 3
      ELSE 2
    END,
    3,
    v_subject,
    'none',
    true,
    true,
    false
  )
  RETURNING id INTO v_interactive_id;

  INSERT INTO public.lesson_assignments (
    preschool_id,
    class_id,
    student_id,
    lesson_id,
    interactive_activity_id,
    lesson_type,
    stem_category,
    assigned_by,
    assigned_at,
    due_date,
    status,
    notes,
    priority
  )
  VALUES (
    v_student.preschool_id,
    v_student.class_id,
    p_child_id,
    NULL,
    v_interactive_id,
    'interactive',
    'none',
    v_user_id,
    now(),
    v_expires_at::date,
    'assigned',
    COALESCE(p_reason, 'Temporary parent lesson'),
    'normal'
  )
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_parent_temp_lesson(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_parent_temp_lesson(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, INTEGER) TO authenticated;
