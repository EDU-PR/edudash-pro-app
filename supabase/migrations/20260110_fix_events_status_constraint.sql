-- ============================================================================
-- Fix events.status column to support pending, proposed, draft statuses
-- Date: 2026-01-10
-- Description: Add CHECK constraint to events.status column to prevent 400 errors
-- ============================================================================

-- First, drop any existing constraint on status if it exists
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname LIKE '%events_status%' 
    AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
  END IF;
END $$;

-- Add CHECK constraint to support common event statuses
-- This includes both the membership event statuses (pending, proposed, draft)
-- and standard event statuses (scheduled, ongoing, completed, cancelled, published)
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
);

-- Add index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_events_status 
ON public.events(status) 
WHERE status IS NOT NULL;

-- Add index on organization_id and status for membership queries
CREATE INDEX IF NOT EXISTS idx_events_organization_status 
ON public.events(organization_id, status) 
WHERE organization_id IS NOT NULL AND status IS NOT NULL;

-- Comment on the constraint
COMMENT ON CONSTRAINT events_status_check ON public.events IS 
'Ensures status values are valid: pending, proposed, draft (for membership events), scheduled, ongoing, completed, cancelled (for calendar events), or published/unpublished (for published events)';
