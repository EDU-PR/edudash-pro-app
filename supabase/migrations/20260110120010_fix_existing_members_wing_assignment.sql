-- Fix existing members' wing assignment based on their member_type
-- This ensures all members have the correct wing set based on their member_type

DO $$
DECLARE
  has_wing boolean;
  has_updated_at boolean;
  set_clause text;
BEGIN
  IF to_regclass('public.organization_members') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'wing'
  ) INTO has_wing;

  IF NOT has_wing THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'updated_at'
  ) INTO has_updated_at;

  set_clause := 'wing = %L';
  IF has_updated_at THEN
    set_clause := set_clause || ', updated_at = NOW()';
  END IF;

  -- Update wing for youth wing members
  EXECUTE format(
    'UPDATE organization_members SET ' || set_clause || '
     WHERE organization_id = %L
       AND member_type LIKE %L
       AND (wing IS NULL OR wing != %L)',
    'youth',
    '63b6139a-e21f-447c-b322-376fb0828992',
    'youth_%',
    'youth'
  );

  -- Update wing for women''s wing members
  EXECUTE format(
    'UPDATE organization_members SET ' || set_clause || '
     WHERE organization_id = %L
       AND member_type LIKE %L
       AND (wing IS NULL OR wing != %L)',
    'women',
    '63b6139a-e21f-447c-b322-376fb0828992',
    'women_%',
    'women'
  );

  -- Update wing for veterans wing members
  EXECUTE format(
    'UPDATE organization_members SET ' || set_clause || '
     WHERE organization_id = %L
       AND member_type LIKE %L
       AND (wing IS NULL OR wing != %L)',
    'veterans',
    '63b6139a-e21f-447c-b322-376fb0828992',
    'veterans_%',
    'veterans'
  );

  -- Set wing to ''main'' for generic member types
  EXECUTE format(
    'UPDATE organization_members SET ' || set_clause || '
     WHERE organization_id = %L
       AND (
         member_type IN (''learner'', ''facilitator'', ''mentor'', ''volunteer'', ''staff'', ''admin'', ''executive'', ''regional_manager'', ''president'', ''deputy_president'', ''secretary_general'', ''treasurer'', ''ceo'', ''national_admin'', ''national_coordinator'', ''board_member'')
         OR (member_type IS NOT NULL AND member_type NOT LIKE ''youth_%'' AND member_type NOT LIKE ''women_%'' AND member_type NOT LIKE ''veterans_%'')
       )
       AND (wing IS NULL OR wing != %L)',
    'main',
    '63b6139a-e21f-447c-b322-376fb0828992',
    'main'
  );
END $$;
