-- Update Mbali's age to 5 years and fix lesson visibility issues
-- date_of_birth to 2021 to make her 5 years old

DO $$
DECLARE
  has_students boolean;
  has_dob boolean;
  has_updated_at boolean;
BEGIN
  has_students := to_regclass('public.students') IS NOT NULL;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'date_of_birth'
  ) INTO has_dob;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'updated_at'
  ) INTO has_updated_at;

  IF has_students AND has_dob THEN
    EXECUTE $ddl$
      UPDATE public.students
      SET date_of_birth = '2021-01-15',
          updated_at = NOW()
      WHERE id = '074692f3-f5a3-4fea-977a-b726828e5067'
        AND first_name = 'Mbali'
        AND last_name = 'Skosana'
    $ddl$;
  END IF;

  IF has_students AND has_dob THEN
    EXECUTE $ddl$
      COMMENT ON COLUMN students.date_of_birth IS 'Student date of birth - updated for Mbali Skosana to reflect correct age of 5 years'
    $ddl$;
  END IF;
END $$;
