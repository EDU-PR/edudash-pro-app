-- Add first-class donation event type for Year Planner V2

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT c.conname
  INTO v_constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.school_events'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%event_type%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.school_events DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.school_events
    ADD CONSTRAINT school_events_event_type_check
    CHECK (
      event_type IN (
        'holiday',
        'parent_meeting',
        'field_trip',
        'assembly',
        'sports_day',
        'graduation',
        'fundraiser',
        'donation_drive',
        'workshop',
        'staff_meeting',
        'open_house',
        'other'
      )
    );
END;
$$;
