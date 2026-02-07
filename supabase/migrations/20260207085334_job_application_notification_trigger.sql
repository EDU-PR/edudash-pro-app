-- =============================================================================
-- Migration: Job Application Notification Trigger
-- Date: 2026-02-07
-- Purpose: Notify principals via push notification when a new job application
--          is submitted through the public apply form.
-- Pattern: Follows the pop_uploads notification trigger pattern (pg_net → Edge Function)
-- =============================================================================

-- Ensure pg_net extension is available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger function: fires on INSERT into job_applications
-- Sends async HTTP POST to notifications-dispatcher/trigger Edge Function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_job_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    edge_url TEXT;
    payload  JSONB;
BEGIN
    -- Build Edge Function URL
    edge_url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/notifications-dispatcher/trigger';

    -- Build payload matching the DatabaseTriggerPayload interface
    payload := jsonb_build_object(
        'type',   'INSERT',
        'table',  'job_applications',
        'record', jsonb_build_object(
            'id',                    NEW.id,
            'job_posting_id',        NEW.job_posting_id,
            'candidate_profile_id',  NEW.candidate_profile_id,
            'status',                NEW.status,
            'cover_letter',          LEFT(COALESCE(NEW.cover_letter, ''), 200),
            'resume_file_path',      NEW.resume_file_path,
            'created_at',            NEW.created_at
        )
    );

    -- Fire-and-forget async HTTP POST (never blocks the INSERT)
    PERFORM net.http_post(
        url     := edge_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := payload
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never block application submission if notification fails
    RAISE WARNING 'notify_new_job_application failed: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Create trigger on job_applications table
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_job_application_notify ON job_applications;

CREATE TRIGGER trg_job_application_notify
    AFTER INSERT ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_job_application();

-- ─────────────────────────────────────────────────────────────────────────────
-- Grant: Ensure anon can call generate_resume_filename (belt-and-suspenders)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'generate_resume_filename'
          AND pronamespace = 'public'::regnamespace
    ) THEN
        GRANT EXECUTE ON FUNCTION public.generate_resume_filename(TEXT, TEXT) TO anon;
        GRANT EXECUTE ON FUNCTION public.generate_resume_filename(TEXT, TEXT) TO authenticated;
    END IF;
END;
$$;
