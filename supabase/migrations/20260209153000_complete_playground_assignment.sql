-- Complete assigned Dash Playground activity and persist grading in lesson tables.

CREATE OR REPLACE FUNCTION public.complete_playground_assignment(
  p_assignment_id UUID,
  p_score INTEGER,
  p_time_spent_seconds INTEGER DEFAULT NULL,
  p_feedback JSONB DEFAULT '{}'::jsonb,
  p_completed_at TIMESTAMPTZ DEFAULT now(),
  p_difficulty TEXT DEFAULT NULL,
  p_activity_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment public.lesson_assignments%ROWTYPE;
  v_completion_id UUID;
  v_feedback JSONB;
  v_time_spent_minutes INTEGER;
BEGIN
  IF p_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Assignment ID is required';
  END IF;

  SELECT la.*
  INTO v_assignment
  FROM public.lesson_assignments la
  WHERE la.id = p_assignment_id
    AND la.student_id IN (SELECT public.get_my_children_ids())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found or access denied';
  END IF;

  IF p_score IS NULL THEN
    p_score := 0;
  END IF;

  p_score := GREATEST(0, LEAST(100, p_score));

  v_time_spent_minutes := CASE
    WHEN p_time_spent_seconds IS NULL THEN NULL
    ELSE GREATEST(1, CEIL(p_time_spent_seconds::numeric / 60.0)::INTEGER)
  END;

  v_feedback := COALESCE(p_feedback, '{}'::jsonb) || jsonb_build_object(
    'source', 'dash_playground_assignment',
    'difficulty', p_difficulty,
    'activity_meta', COALESCE(p_activity_meta, '{}'::jsonb)
  );

  UPDATE public.lesson_assignments
  SET status = 'completed',
      updated_at = now()
  WHERE id = v_assignment.id
    AND status <> 'cancelled';

  SELECT lc.id
  INTO v_completion_id
  FROM public.lesson_completions lc
  WHERE lc.assignment_id = v_assignment.id
  ORDER BY lc.completed_at DESC NULLS LAST, lc.created_at DESC
  LIMIT 1;

  IF v_completion_id IS NOT NULL THEN
    UPDATE public.lesson_completions
    SET lesson_id = COALESCE(v_assignment.lesson_id, lesson_id),
        student_id = v_assignment.student_id,
        preschool_id = v_assignment.preschool_id,
        completed_at = COALESCE(p_completed_at, now()),
        time_spent_minutes = COALESCE(v_time_spent_minutes, time_spent_minutes),
        score = p_score,
        feedback = v_feedback,
        status = 'completed',
        updated_at = now()
    WHERE id = v_completion_id;
  ELSE
    INSERT INTO public.lesson_completions (
      assignment_id,
      lesson_id,
      student_id,
      preschool_id,
      started_at,
      completed_at,
      time_spent_minutes,
      score,
      feedback,
      status
    )
    VALUES (
      v_assignment.id,
      v_assignment.lesson_id,
      v_assignment.student_id,
      v_assignment.preschool_id,
      NULL,
      COALESCE(p_completed_at, now()),
      v_time_spent_minutes,
      p_score,
      v_feedback,
      'completed'
    )
    RETURNING id INTO v_completion_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment.id,
    'completion_id', v_completion_id,
    'score', p_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_playground_assignment(UUID, INTEGER, INTEGER, JSONB, TIMESTAMPTZ, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_playground_assignment(UUID, INTEGER, INTEGER, JSONB, TIMESTAMPTZ, TEXT, JSONB) TO authenticated;
