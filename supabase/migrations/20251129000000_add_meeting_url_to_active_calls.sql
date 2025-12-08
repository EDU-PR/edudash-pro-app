-- Migration: Add meeting_url to active_calls for Daily.co integration
-- This allows storing the Daily.co room URL in the call record

ALTER TABLE public.active_calls 
ADD COLUMN IF NOT EXISTS meeting_url TEXT;

-- Add index for looking up calls by meeting URL
CREATE INDEX IF NOT EXISTS idx_active_calls_meeting_url 
ON public.active_calls(meeting_url) 
WHERE meeting_url IS NOT NULL;

COMMENT ON COLUMN public.active_calls.meeting_url IS 'Daily.co room URL for this call';
