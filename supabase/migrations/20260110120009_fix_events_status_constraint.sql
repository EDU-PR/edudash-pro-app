-- ============================================================================
-- Fix events.status column to support pending, proposed, draft statuses
-- Date: 2026-01-10
-- Description: Add CHECK constraint to events.status column to prevent 400 errors
-- ============================================================================

DO $$
BEGIN
  -- Skip if events table does not exist (shadow DB compatibility)
  IF to_regclass('public.events') IS NULL THEN
    RETURN;
  END IF;

  -- Drop existing constraint if it exists
  EXECUTE 'ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check';

  -- Add CHECK constraint if missing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_status_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE public.events
      ADD CONSTRAINT events_status_check
      CHECK (
        status IS NULL
        OR status IN (
          'pending',
          'proposed',
          'draft',
          'scheduled',
          'ongoing',
          'completed',
          'cancelled',
          'published',
          'unpublished'
        )
      )
    $ddl$;
  END IF;

  -- Add indexes for better query performance
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status) WHERE status IS NOT NULL';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_preschool_status_filtered ON public.events(preschool_id, status) WHERE preschool_id IS NOT NULL AND status IS NOT NULL';

  -- Comment on the constraint
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_status_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    EXECUTE $ddl$
      COMMENT ON CONSTRAINT events_status_check ON public.events IS
      'Ensures status values are valid: pending, proposed, draft (for membership events), scheduled, ongoing, completed, cancelled (for calendar events), or published/unpublished (for published events)'
    $ddl$;
  END IF;
END $$;
