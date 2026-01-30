BEGIN;

CREATE OR REPLACE FUNCTION public.record_birthday_donation(
  org_id uuid,
  donation_day date,
  donation_amount numeric,
  donation_method text DEFAULT NULL,
  donation_note text DEFAULT NULL,
  recorded_by_user uuid DEFAULT NULL,
  p_payer_student_id uuid DEFAULT NULL,
  p_birthday_student_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_celebration_mode boolean DEFAULT false
)
RETURNS public.birthday_donation_days
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  birthday_count integer := 0;
  target_recorded_by uuid := COALESCE(recorded_by_user, auth.uid());
  day_row public.birthday_donation_days;
  birthday_dob date;
  birthday_this_year date;
  week_start date;
  week_end date;
  celebration_friday date;
BEGIN
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Organization is required';
  END IF;

  IF donation_day IS NULL THEN
    RAISE EXCEPTION 'Donation date is required';
  END IF;

  IF donation_amount IS NULL OR donation_amount <= 0 THEN
    RAISE EXCEPTION 'Donation amount must be greater than zero';
  END IF;

  IF p_celebration_mode AND EXTRACT(DOW FROM donation_day) <> 5 THEN
    RAISE EXCEPTION 'Celebration date must be a Friday';
  END IF;

  IF (p_payer_student_id IS NULL AND p_birthday_student_id IS NOT NULL)
     OR (p_payer_student_id IS NOT NULL AND p_birthday_student_id IS NULL) THEN
    RAISE EXCEPTION 'Payer student and birthday student must be provided together';
  END IF;

  IF p_payer_student_id IS NOT NULL THEN
    PERFORM 1
    FROM public.students
    WHERE id = p_payer_student_id
      AND (organization_id = org_id OR preschool_id = org_id)
      AND COALESCE(is_active, true) IS TRUE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payer student not found for organization';
    END IF;
  END IF;

  IF p_birthday_student_id IS NOT NULL THEN
    SELECT date_of_birth
    INTO birthday_dob
    FROM public.students
    WHERE id = p_birthday_student_id
      AND (organization_id = org_id OR preschool_id = org_id)
      AND COALESCE(is_active, true) IS TRUE;

    IF birthday_dob IS NULL THEN
      RAISE EXCEPTION 'Birthday date missing for selected student';
    END IF;

    birthday_this_year := make_date(EXTRACT(YEAR FROM donation_day)::int,
      EXTRACT(MONTH FROM birthday_dob)::int,
      EXTRACT(DAY FROM birthday_dob)::int);
    week_start := date_trunc('week', birthday_this_year)::date;
    week_end := week_start + 6;
    celebration_friday := week_start + 4;

    IF donation_day <> birthday_this_year THEN
      IF NOT p_celebration_mode OR donation_day <> celebration_friday THEN
        RAISE EXCEPTION 'Selected birthday does not match donation date';
      END IF;
    END IF;
  END IF;

  IF p_class_id IS NOT NULL THEN
    PERFORM 1
    FROM public.classes
    WHERE id = p_class_id
      AND (organization_id = org_id OR preschool_id = org_id);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Class not found for organization';
    END IF;
  END IF;

  IF p_celebration_mode THEN
    week_start := date_trunc('week', donation_day)::date;
    week_end := week_start + 6;
    SELECT COUNT(*)::int INTO birthday_count
    FROM public.students
    WHERE (organization_id = org_id OR preschool_id = org_id)
      AND COALESCE(is_active, true) IS TRUE
      AND date_of_birth IS NOT NULL
      AND make_date(EXTRACT(YEAR FROM donation_day)::int,
        EXTRACT(MONTH FROM date_of_birth)::int,
        EXTRACT(DAY FROM date_of_birth)::int)
        BETWEEN week_start AND week_end;
  ELSE
    SELECT COUNT(*)::int INTO birthday_count
    FROM public.students
    WHERE (organization_id = org_id OR preschool_id = org_id)
      AND COALESCE(is_active, true) IS TRUE
      AND date_of_birth IS NOT NULL
      AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM donation_day)
      AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM donation_day);
  END IF;

  IF birthday_count < 1 AND p_birthday_student_id IS NOT NULL THEN
    birthday_count := 1;
  END IF;

  IF birthday_count < 1 THEN
    RAISE EXCEPTION 'No birthdays found for this date';
  END IF;

  IF p_payer_student_id IS NOT NULL AND p_birthday_student_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.birthday_donations
      WHERE organization_id = org_id
        AND donation_date = donation_day
        AND public.birthday_donations.payer_student_id = p_payer_student_id
        AND public.birthday_donations.birthday_student_id = p_birthday_student_id
    ) THEN
      SELECT * INTO day_row
      FROM public.birthday_donation_days
      WHERE organization_id = org_id
        AND donation_date = donation_day;

      RETURN day_row;
    END IF;
  END IF;

  INSERT INTO public.birthday_donations (
    organization_id,
    donation_date,
    amount,
    payment_method,
    note,
    recorded_by,
    payer_student_id,
    birthday_student_id,
    class_id
  ) VALUES (
    org_id,
    donation_day,
    donation_amount,
    donation_method,
    donation_note,
    target_recorded_by,
    p_payer_student_id,
    p_birthday_student_id,
    p_class_id
  );

  INSERT INTO public.birthday_donation_days (
    organization_id,
    donation_date,
    birthday_count,
    expected_amount,
    total_received,
    created_by,
    updated_by
  ) VALUES (
    org_id,
    donation_day,
    birthday_count,
    birthday_count * 25,
    donation_amount,
    target_recorded_by,
    target_recorded_by
  )
  ON CONFLICT (organization_id, donation_date)
  DO UPDATE SET
    birthday_count = EXCLUDED.birthday_count,
    expected_amount = EXCLUDED.expected_amount,
    total_received = birthday_donation_days.total_received + EXCLUDED.total_received,
    updated_by = target_recorded_by,
    updated_at = now();

  SELECT * INTO day_row
  FROM public.birthday_donation_days
  WHERE organization_id = org_id
    AND donation_date = donation_day;

  RETURN day_row;
END;
$$;

COMMIT;
