BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS stationery_list_items_list_item_name_key
  ON public.stationery_list_items(list_id, item_name);

CREATE OR REPLACE FUNCTION public.seed_stationery_defaults_for_school_year(
  p_school_id uuid,
  p_academic_year integer,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_3 uuid;
  v_list_46 uuid;
BEGIN
  INSERT INTO public.stationery_lists (
    school_id,
    academic_year,
    age_group_label,
    age_min,
    age_max,
    sort_order,
    created_by,
    updated_by,
    is_visible,
    is_published
  ) VALUES (
    p_school_id,
    p_academic_year,
    '3 years',
    3,
    3,
    10,
    p_actor,
    p_actor,
    true,
    true
  )
  ON CONFLICT (school_id, academic_year, age_group_label)
  DO UPDATE SET
    updated_by = COALESCE(EXCLUDED.updated_by, public.stationery_lists.updated_by),
    updated_at = now(),
    is_visible = true,
    is_published = true
  RETURNING id INTO v_list_3;

  INSERT INTO public.stationery_lists (
    school_id,
    academic_year,
    age_group_label,
    age_min,
    age_max,
    sort_order,
    created_by,
    updated_by,
    is_visible,
    is_published
  ) VALUES (
    p_school_id,
    p_academic_year,
    '4-6 years',
    4,
    6,
    20,
    p_actor,
    p_actor,
    true,
    true
  )
  ON CONFLICT (school_id, academic_year, age_group_label)
  DO UPDATE SET
    updated_by = COALESCE(EXCLUDED.updated_by, public.stationery_lists.updated_by),
    updated_at = now(),
    is_visible = true,
    is_published = true
  RETURNING id INTO v_list_46;

  -- 3 years defaults
  INSERT INTO public.stationery_list_items (list_id, item_name, required_quantity, unit_label, sort_order, is_visible, notes)
  VALUES
    (v_list_3, 'Triangle Pencil', 1, 'pc', 10, true, NULL),
    (v_list_3, 'Metal double-hole pencil sharpener (big and small)', 1, 'pc', 20, true, NULL),
    (v_list_3, 'Water colour set', 1, 'set', 30, true, 'Replace as needed'),
    (v_list_3, 'Colouring book (100 pages)', 1, 'book', 40, true, NULL),
    (v_list_3, 'Monami wax crayons', 1, 'pack', 50, true, NULL),
    (v_list_3, 'Large glue stick', 1, 'pc', 60, true, 'Replace as needed'),
    (v_list_3, 'Exercise book A4 hardcover', 1, 'book', 70, true, NULL),
    (v_list_3, 'Play clay set (not dough)', 1, 'set', 80, true, NULL),
    (v_list_3, 'Chair bag (denim)', 1, 'pc', 90, true, NULL),
    (v_list_3, 'Flip file (thick, 72 pockets)', 1, 'pc', 100, true, NULL),
    (v_list_3, 'One ream of copy paper', 1, 'ream', 110, true, NULL),
    (v_list_3, 'Bright board paper', 1, 'pack', 120, true, NULL),
    (v_list_3, 'Blanket', 1, 'pc', 130, true, NULL),
    (v_list_3, 'Wipes', 1, 'pack', 140, true, NULL),
    (v_list_3, 'Toilet rolls (2-ply)', 10, 'rolls', 150, true, 'Pack of 10 or 12 accepted'),
    (v_list_3, 'Dettol soaps', 6, 'bars', 160, true, NULL),
    (v_list_3, 'Vaseline', 1, 'pc', 170, true, NULL)
  ON CONFLICT (list_id, item_name)
  DO UPDATE SET
    required_quantity = EXCLUDED.required_quantity,
    unit_label = EXCLUDED.unit_label,
    sort_order = EXCLUDED.sort_order,
    is_visible = EXCLUDED.is_visible,
    notes = EXCLUDED.notes,
    updated_at = now();

  -- 4-6 years defaults
  INSERT INTO public.stationery_list_items (list_id, item_name, required_quantity, unit_label, sort_order, is_visible, notes)
  VALUES
    (v_list_46, 'Triangle Pencil', 1, 'pc', 10, true, NULL),
    (v_list_46, 'Metal double-hole pencil sharpener (big and small)', 1, 'pc', 20, true, NULL),
    (v_list_46, 'Eraser', 1, 'pc', 30, true, 'Replace regularly'),
    (v_list_46, 'ABC Blocks', 1, 'set', 40, true, NULL),
    (v_list_46, 'Water colour set', 1, 'set', 50, true, 'Replace regularly'),
    (v_list_46, '20-piece wooden puzzle in box', 1, 'set', 60, true, NULL),
    (v_list_46, 'Colouring book (100 pages)', 1, 'book', 70, true, NULL),
    (v_list_46, 'Small ruler (15 cm)', 1, 'pc', 80, true, NULL),
    (v_list_46, 'Large glue stick', 1, 'pc', 90, true, 'Replace regularly'),
    (v_list_46, 'Exercise book A4 hardcover', 1, 'book', 100, true, NULL),
    (v_list_46, 'Play clay set (not dough)', 1, 'set', 110, true, NULL),
    (v_list_46, 'Chair bag (denim)', 1, 'pc', 120, true, NULL),
    (v_list_46, 'Blunt-point scissors', 1, 'pc', 130, true, NULL),
    (v_list_46, 'Flip file (thick XL, 72 pockets)', 1, 'pc', 140, true, NULL),
    (v_list_46, 'One ream of copy paper', 1, 'ream', 150, true, NULL),
    (v_list_46, 'Blanket', 1, 'pc', 160, true, NULL),
    (v_list_46, 'Wipes', 1, 'pack', 170, true, NULL),
    (v_list_46, 'Toilet rolls (2-ply)', 10, 'rolls', 180, true, 'Pack of 10 or 12 accepted'),
    (v_list_46, 'Dettol soaps', 1, 'pack', 190, true, NULL),
    (v_list_46, 'Monami wax crayons', 1, 'pack', 200, true, NULL),
    (v_list_46, 'Vaseline', 1, 'pc', 210, true, NULL)
  ON CONFLICT (list_id, item_name)
  DO UPDATE SET
    required_quantity = EXCLUDED.required_quantity,
    unit_label = EXCLUDED.unit_label,
    sort_order = EXCLUDED.sort_order,
    is_visible = EXCLUDED.is_visible,
    notes = EXCLUDED.notes,
    updated_at = now();

  RETURN jsonb_build_object(
    'mode', 'seeded-defaults',
    'schoolId', p_school_id,
    'academicYear', p_academic_year,
    'listCount', 2
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clone_stationery_lists_from_year(
  p_school_id uuid,
  p_from_year integer,
  p_to_year integer,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_new_list_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.stationery_lists
    WHERE school_id = p_school_id
      AND academic_year = p_from_year
    ORDER BY sort_order, age_group_label
  LOOP
    INSERT INTO public.stationery_lists (
      school_id,
      academic_year,
      age_group_label,
      age_min,
      age_max,
      is_visible,
      is_published,
      sort_order,
      created_by,
      updated_by
    ) VALUES (
      p_school_id,
      p_to_year,
      v_row.age_group_label,
      v_row.age_min,
      v_row.age_max,
      v_row.is_visible,
      v_row.is_published,
      v_row.sort_order,
      p_actor,
      p_actor
    )
    ON CONFLICT (school_id, academic_year, age_group_label)
    DO UPDATE SET
      age_min = EXCLUDED.age_min,
      age_max = EXCLUDED.age_max,
      is_visible = EXCLUDED.is_visible,
      is_published = EXCLUDED.is_published,
      sort_order = EXCLUDED.sort_order,
      updated_by = COALESCE(EXCLUDED.updated_by, public.stationery_lists.updated_by),
      updated_at = now()
    RETURNING id INTO v_new_list_id;

    INSERT INTO public.stationery_list_items (
      list_id,
      item_name,
      required_quantity,
      unit_label,
      sort_order,
      is_visible,
      notes
    )
    SELECT
      v_new_list_id,
      i.item_name,
      i.required_quantity,
      i.unit_label,
      i.sort_order,
      i.is_visible,
      i.notes
    FROM public.stationery_list_items i
    WHERE i.list_id = v_row.id
    ON CONFLICT (list_id, item_name)
    DO UPDATE SET
      required_quantity = EXCLUDED.required_quantity,
      unit_label = EXCLUDED.unit_label,
      sort_order = EXCLUDED.sort_order,
      is_visible = EXCLUDED.is_visible,
      notes = EXCLUDED.notes,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'mode', 'cloned-previous-year',
    'schoolId', p_school_id,
    'fromYear', p_from_year,
    'toYear', p_to_year,
    'listCount', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_stationery_year_templates(
  p_school_id uuid,
  p_academic_year integer DEFAULT public.stationery_current_academic_year(),
  p_actor uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_previous_year integer;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'school_id is required';
  END IF;

  IF NOT public.stationery_is_school_staff(p_school_id)
     AND NOT public.stationery_parent_has_school_access(p_school_id)
  THEN
    RAISE EXCEPTION 'Not authorized to initialize stationery templates for this school';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.stationery_lists l
    WHERE l.school_id = p_school_id
      AND l.academic_year = p_academic_year
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object(
      'mode', 'already-exists',
      'schoolId', p_school_id,
      'academicYear', p_academic_year
    );
  END IF;

  SELECT MAX(l.academic_year)
  INTO v_previous_year
  FROM public.stationery_lists l
  WHERE l.school_id = p_school_id
    AND l.academic_year < p_academic_year;

  IF v_previous_year IS NOT NULL THEN
    RETURN public.clone_stationery_lists_from_year(
      p_school_id,
      v_previous_year,
      p_academic_year,
      p_actor
    );
  END IF;

  RETURN public.seed_stationery_defaults_for_school_year(
    p_school_id,
    p_academic_year,
    p_actor
  );
END;
$$;

-- Bootstrap current year defaults for existing schools.
DO $$
DECLARE
  v_school record;
  v_year integer := public.stationery_current_academic_year();
BEGIN
  FOR v_school IN (
    SELECT id FROM public.preschools
    UNION
    SELECT id FROM public.organizations
  ) LOOP
    PERFORM public.seed_stationery_defaults_for_school_year(v_school.id, v_year, NULL);
  END LOOP;
END
$$;

COMMIT;
