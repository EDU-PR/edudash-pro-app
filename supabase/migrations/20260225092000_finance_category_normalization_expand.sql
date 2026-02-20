-- Expand finance category normalization to include excursions/fundraisers/donations/aftercare activity categories.

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_fee_category_code(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := lower(trim(coalesce(p_value, '')));
BEGIN
  IF v = '' THEN
    RETURN 'tuition';
  END IF;

  IF v ~ '\m(uniform|uniform_tshirt|uniform_shorts|uniform_set|uniforms)\M' THEN
    RETURN 'uniform';
  ELSIF v ~ '\m(registration|admission|enrolment|enrollment)\M' THEN
    RETURN 'registration';
  ELSIF v ~ '\m(deposit|holding\s*fee|seat\s*fee)\M' THEN
    RETURN 'deposit';
  ELSIF v ~ '\m(aftercare|after\s*care)\M' THEN
    RETURN 'aftercare';
  ELSIF v ~ '\m(transport|bus|shuttle)\M' THEN
    RETURN 'transport';
  ELSIF v ~ '\m(meal|meals|food|catering|lunch|snack)\M' THEN
    RETURN 'meals';
  ELSIF v ~ '\m(excursion|trip|tour|outing)\M' THEN
    RETURN 'excursion';
  ELSIF v ~ '\m(fundraiser|raffle|bake\s*sale|walk-a-thon|fun\s*run)\M' THEN
    RETURN 'fundraiser';
  ELSIF v ~ '\m(donation|donation\s*drive|sponsor|sponsorship|contribution)\M' THEN
    RETURN 'donation_drive';
  ELSIF v ~ '\m(book|books|stationery|material|materials|supplies)\M' THEN
    RETURN 'books';
  ELSIF v ~ '\m(activity|activities|event|camp|club|extra\s*mural|extramural)\M' THEN
    RETURN 'activities';
  ELSIF v ~ '\m(tuition|school\s*fee|monthly|fees)\M' THEN
    RETURN 'tuition';
  ELSIF v IN ('ad_hoc', 'ad-hoc', 'adhoc', 'other') THEN
    RETURN 'other';
  END IF;

  RETURN 'other';
END;
$$;

-- Drop legacy category checks first so normalization can run safely on historical rows.
DO $$
BEGIN
  IF to_regclass('public.student_fees') IS NOT NULL THEN
    ALTER TABLE public.student_fees
      DROP CONSTRAINT IF EXISTS student_fees_category_code_check;
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    ALTER TABLE public.payments
      DROP CONSTRAINT IF EXISTS payments_category_code_check;
  END IF;
END
$$;

-- Refresh existing category codes with expanded normalization logic.
UPDATE public.student_fees sf
SET category_code = public.normalize_fee_category_code(
  coalesce(
    nullif(sf.category_code, ''),
    nullif(fs.fee_type, ''),
    nullif(fs.name, ''),
    nullif(fs.description, ''),
    nullif(to_jsonb(sf)->>'description', ''),
    'tuition'
  )
)
FROM public.fee_structures fs
WHERE sf.fee_structure_id = fs.id;

UPDATE public.payments
SET category_code = public.normalize_fee_category_code(
  coalesce(
    nullif(category_code, ''),
    nullif(metadata->>'fee_category', ''),
    nullif(metadata->>'payment_purpose', ''),
    nullif(description, ''),
    'tuition'
  )
)
WHERE category_code IS NULL
   OR trim(category_code) = ''
   OR category_code IN ('ad_hoc', 'meal', 'other', 'activities', 'excursion', 'fundraiser', 'donation_drive', 'books', 'deposit');

UPDATE public.pop_uploads
SET category_code = public.normalize_fee_category_code(
  coalesce(
    nullif(category_code, ''),
    nullif(description, ''),
    nullif(title, ''),
    nullif(payment_reference, ''),
    'tuition'
  )
)
WHERE upload_type = 'proof_of_payment'
  AND (
    category_code IS NULL
    OR trim(category_code) = ''
    OR category_code IN ('ad_hoc', 'meal', 'other')
  );

DO $$
BEGIN
  IF to_regclass('public.student_fees') IS NOT NULL THEN
    ALTER TABLE public.student_fees
      DROP CONSTRAINT IF EXISTS student_fees_category_code_check;

    ALTER TABLE public.student_fees
      ADD CONSTRAINT student_fees_category_code_check
      CHECK (
        category_code = ANY (
          ARRAY[
            'tuition',
            'registration',
            'deposit',
            'uniform',
            'aftercare',
            'transport',
            'meal',
            'meals',
            'activities',
            'excursion',
            'fundraiser',
            'donation_drive',
            'books',
            'other',
            'ad_hoc'
          ]
        )
      );
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    ALTER TABLE public.payments
      DROP CONSTRAINT IF EXISTS payments_category_code_check;

    ALTER TABLE public.payments
      ADD CONSTRAINT payments_category_code_check
      CHECK (
        category_code = ANY (
          ARRAY[
            'tuition',
            'registration',
            'deposit',
            'uniform',
            'aftercare',
            'transport',
            'meal',
            'meals',
            'activities',
            'excursion',
            'fundraiser',
            'donation_drive',
            'books',
            'other',
            'ad_hoc'
          ]
        )
      );
  END IF;
END
$$;

COMMIT;
