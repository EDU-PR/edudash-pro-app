-- Regression guard for support ticket escalation flow.
-- Fails fast when required support_tickets shape/policies are missing.

DO $$
DECLARE
  missing_columns text[];
  has_insert_policy boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
  ) THEN
    RAISE EXCEPTION 'support_tickets table is missing';
  END IF;

  SELECT array_agg(required_column)
  INTO missing_columns
  FROM (
    SELECT unnest(ARRAY[
      'id',
      'user_id',
      'preschool_id',
      'subject',
      'description',
      'status',
      'priority',
      'created_at'
    ]) AS required_column
  ) required
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
      AND column_name = required.required_column
  );

  IF missing_columns IS NOT NULL AND array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION 'support_tickets is missing required columns: %', array_to_string(missing_columns, ', ');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND cmd IN ('INSERT', 'ALL')
  )
  INTO has_insert_policy;

  IF NOT has_insert_policy THEN
    RAISE EXCEPTION 'support_tickets INSERT/ALL policy is missing';
  END IF;
END;
$$;

SELECT 'ok' AS support_ticket_flow_check;
