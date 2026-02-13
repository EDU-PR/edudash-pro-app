-- AI Year Planner: transactional save RPC
--
-- Persists generated year plan data atomically to:
--   - academic_terms
--   - curriculum_themes
-- Avoids partial saves and fixes schema mismatches (created_by, title).

BEGIN;

CREATE OR REPLACE FUNCTION public.save_ai_year_plan(
  p_preschool_id uuid,
  p_created_by uuid,
  p_plan jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_caller uuid;
  v_academic_year integer;
  v_age_groups text[];
  v_term jsonb;
  v_week jsonb;
  v_term_number integer;
  v_term_id uuid;
  v_term_start date;
  v_week_number integer;
  v_week_start date;
  v_week_end date;
  v_terms_saved integer := 0;
  v_themes_saved integer := 0;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_preschool_id IS NULL THEN
    RAISE EXCEPTION 'p_preschool_id is required' USING ERRCODE = '22023';
  END IF;

  -- Prevent spoofing.
  IF p_created_by IS NOT NULL AND p_created_by <> v_caller THEN
    RAISE EXCEPTION 'p_created_by must match auth.uid()' USING ERRCODE = '42501';
  END IF;

  -- Ensure caller is authorized for the preschool.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_caller
      AND p.role IN ('principal', 'principal_admin', 'admin', 'superadmin')
      AND COALESCE(p.organization_id, p.preschool_id) = p_preschool_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to save year plan for this preschool' USING ERRCODE = '42501';
  END IF;

  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'p_plan must be a JSON object' USING ERRCODE = '22023';
  END IF;

  v_academic_year := NULLIF((p_plan->>'academic_year')::int, 0);
  IF v_academic_year IS NULL THEN
    v_academic_year := EXTRACT(YEAR FROM now())::int;
  END IF;

  SELECT ARRAY(
    SELECT jsonb_array_elements_text(p_plan #> '{config,age_groups}')
  ) INTO v_age_groups;

  IF v_age_groups IS NULL OR array_length(v_age_groups, 1) IS NULL THEN
    v_age_groups := ARRAY['3-6'];
  END IF;

  IF jsonb_typeof(p_plan->'terms') <> 'array' THEN
    RAISE EXCEPTION 'p_plan.terms must be an array' USING ERRCODE = '22023';
  END IF;

  FOR v_term IN SELECT * FROM jsonb_array_elements(p_plan->'terms')
  LOOP
    v_term_number := NULLIF((v_term->>'term_number')::int, 0);
    IF v_term_number IS NULL THEN
      RAISE EXCEPTION 'Each term requires term_number' USING ERRCODE = '22023';
    END IF;

    v_term_start := (v_term->>'start_date')::date;

    INSERT INTO public.academic_terms (
      preschool_id,
      created_by,
      name,
      academic_year,
      term_number,
      start_date,
      end_date,
      description,
      is_active,
      is_published
    ) VALUES (
      p_preschool_id,
      v_caller,
      COALESCE(NULLIF(v_term->>'name', ''), format('Term %s', v_term_number)),
      v_academic_year,
      v_term_number,
      (v_term->>'start_date')::date,
      (v_term->>'end_date')::date,
      NULLIF(v_term->>'description', ''),
      false,
      false
    )
    ON CONFLICT (preschool_id, academic_year, term_number)
    DO UPDATE SET
      name = EXCLUDED.name,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      description = EXCLUDED.description,
      updated_at = now()
    RETURNING id INTO v_term_id;

    v_terms_saved := v_terms_saved + 1;

    -- Make saves idempotent for the same caller: remove previously generated weekly themes
    -- for this term (caller-owned) before inserting.
    DELETE FROM public.curriculum_themes ct
    WHERE ct.preschool_id = p_preschool_id
      AND ct.term_id = v_term_id
      AND ct.created_by = v_caller
      AND ct.week_number IS NOT NULL;

    IF jsonb_typeof(v_term->'weekly_themes') = 'array' THEN
      FOR v_week IN SELECT * FROM jsonb_array_elements(v_term->'weekly_themes')
      LOOP
        v_week_number := NULLIF((v_week->>'week')::int, 0);
        IF v_week_number IS NULL THEN
          CONTINUE;
        END IF;

        -- Approximate week start/end dates within the term.
        v_week_start := v_term_start + ((v_week_number - 1) * 7);
        v_week_end := v_week_start + 6;

        INSERT INTO public.curriculum_themes (
          preschool_id,
          created_by,
          title,
          description,
          term_id,
          week_number,
          start_date,
          end_date,
          learning_objectives,
          key_concepts,
          vocabulary_words,
          suggested_activities,
          materials_needed,
          developmental_domains,
          age_groups,
          is_published,
          is_template
        ) VALUES (
          p_preschool_id,
          v_caller,
          COALESCE(NULLIF(v_week->>'theme', ''), format('Week %s Theme', v_week_number)),
          format(
            'Week %s: %s',
            v_week_number,
            COALESCE(NULLIF(v_week->>'focus_area', ''), 'Focus area TBD')
          ),
          v_term_id,
          v_week_number,
          v_week_start,
          v_week_end,
          COALESCE(v_week->'developmental_goals', '[]'::jsonb),
          '[]'::jsonb,
          '[]'::jsonb,
          COALESCE(v_week->'key_activities', '[]'::jsonb),
          '[]'::jsonb,
          CASE
            WHEN NULLIF(v_week->>'focus_area', '') IS NOT NULL
              THEN jsonb_build_array(v_week->>'focus_area')
            ELSE '[]'::jsonb
          END,
          v_age_groups,
          false,
          false
        );

        v_themes_saved := v_themes_saved + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'academic_year', v_academic_year,
    'terms_saved', v_terms_saved,
    'themes_saved', v_themes_saved
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_ai_year_plan(uuid, uuid, jsonb) TO authenticated;

COMMIT;

