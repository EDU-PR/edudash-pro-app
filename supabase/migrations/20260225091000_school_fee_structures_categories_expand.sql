-- Expand school_fee_structures fee_category values for preschool/aftercare/K-12 parity.

BEGIN;

DO $$
DECLARE
  v_constraint record;
BEGIN
  IF to_regclass('public.school_fee_structures') IS NULL THEN
    RAISE NOTICE 'Skipping school_fee_structures category expansion: table missing';
    RETURN;
  END IF;

  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.school_fee_structures'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%fee_category%'
  LOOP
    EXECUTE format('ALTER TABLE public.school_fee_structures DROP CONSTRAINT IF EXISTS %I', v_constraint.conname);
  END LOOP;

  ALTER TABLE public.school_fee_structures
    ALTER COLUMN fee_category SET DEFAULT 'tuition';

  UPDATE public.school_fee_structures
  SET fee_category = CASE
    WHEN lower(coalesce(fee_category, '')) ~ '\m(uniform|uniform_tshirt|uniform_shorts|uniform_set)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\muniform\M'
      THEN 'uniform'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(registration|admission|enrolment|enrollment)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(registration|admission|enrolment|enrollment)\M'
      THEN 'registration'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(deposit|holding fee|seat fee)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(deposit|holding fee|seat fee)\M'
      THEN 'deposit'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(aftercare|after\s*care)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(aftercare|after\s*care)\M'
      THEN 'aftercare'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(transport|bus|shuttle)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(transport|bus|shuttle)\M'
      THEN 'transport'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(meal|meals|food|catering|lunch|snack)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(meal|meals|food|catering|lunch|snack)\M'
      THEN 'meals'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(excursion|trip|tour|outing)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(excursion|trip|tour|outing)\M'
      THEN 'excursion'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(fundraiser|raffle|bake\s*sale|walk-a-thon|fun\s*run)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(fundraiser|raffle|bake\s*sale|walk-a-thon|fun\s*run)\M'
      THEN 'fundraiser'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(donation|donation_drive|sponsor|sponsorship|contribution)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(donation|donation\s*drive|sponsor|sponsorship|contribution)\M'
      THEN 'donation_drive'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(book|books|stationery|material|materials|supplies)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(book|books|stationery|material|materials|supplies)\M'
      THEN 'books'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(activity|activities|event|camp|club|extra\s*mural|extramural)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(activity|activities|event|camp|club|extra\s*mural|extramural)\M'
      THEN 'activities'
    WHEN lower(coalesce(fee_category, '')) ~ '\m(tuition|school\s*fee|monthly)\M'
      OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '\m(tuition|school\s*fee|monthly)\M'
      THEN 'tuition'
    WHEN trim(coalesce(fee_category, '')) = '' THEN 'tuition'
    ELSE 'other'
  END;

  ALTER TABLE public.school_fee_structures
    ALTER COLUMN fee_category SET NOT NULL;

  ALTER TABLE public.school_fee_structures
    ADD CONSTRAINT school_fee_structures_fee_category_check
    CHECK (
      fee_category = ANY (
        ARRAY[
          'tuition',
          'registration',
          'deposit',
          'transport',
          'meals',
          'activities',
          'aftercare',
          'excursion',
          'fundraiser',
          'donation_drive',
          'uniform',
          'books',
          'other'
        ]
      )
    );
END
$$;

COMMIT;
