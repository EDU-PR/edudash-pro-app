-- Fix Mbali assignment and teacher subscription tier display
-- Date: 2026-01-10

DO $$
DECLARE
  has_students boolean;
  has_profiles boolean;
  has_class_id boolean;
  has_subscription_tier boolean;
BEGIN
  has_students := to_regclass('public.students') IS NOT NULL;
  has_profiles := to_regclass('public.profiles') IS NOT NULL;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'class_id'
  ) INTO has_class_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'subscription_tier'
  ) INTO has_subscription_tier;

  IF has_students AND has_class_id THEN
    EXECUTE $ddl$
      UPDATE students
      SET class_id = 'ac257aa6-bb6a-47b6-9fce-d3c724b120b9'
      WHERE id = '074692f3-f5a3-4fea-977a-b726828e5067'
        AND first_name = 'Mbali'
        AND last_name = 'Skosana'
    $ddl$;
  END IF;

  IF has_profiles AND has_subscription_tier THEN
    EXECUTE $ddl$
      UPDATE profiles
      SET subscription_tier = 'school_premium'
      WHERE id = 'a1fd12d2-5f09-4a23-822d-f3071bfc544b'
        AND email = 'katso@youngeagles.org.za'
    $ddl$;
  END IF;

  IF has_students THEN
    EXECUTE $ddl$
      COMMENT ON TABLE students IS 'Students table - class_id links to classes table'
    $ddl$;
  END IF;

  IF has_profiles AND has_subscription_tier THEN
    EXECUTE $ddl$
      COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier - for teachers, should match school subscription (e.g., school_premium, school_starter)'
    $ddl$;
  END IF;
END $$;
