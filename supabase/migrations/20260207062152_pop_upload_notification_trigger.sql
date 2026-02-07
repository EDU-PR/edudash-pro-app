-- ============================================================================
-- POP Upload Notification Trigger
-- ============================================================================
-- Purpose: Automatically notify principals when a parent uploads proof
-- of payment, using pg_net to call the notifications-dispatcher Edge Function.
-- This ensures notifications fire server-side regardless of client behavior.
-- ============================================================================

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create the trigger function
CREATE OR REPLACE FUNCTION notify_pop_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    edge_url text;
    payload  jsonb;
BEGIN
    -- Only fire for proof_of_payment uploads
    IF NEW.upload_type <> 'proof_of_payment' THEN
        RETURN NEW;
    END IF;

    -- Build the Edge Function URL
    -- Supabase Edge Functions URL pattern: https://<project_ref>.supabase.co/functions/v1/<function_name>
    edge_url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/notifications-dispatcher/trigger';

    -- Build the database trigger payload
    payload := jsonb_build_object(
        'type',  'INSERT',
        'table', 'pop_uploads',
        'record', jsonb_build_object(
            'id',                NEW.id,
            'student_id',        NEW.student_id,
            'uploaded_by',       NEW.uploaded_by,
            'preschool_id',      NEW.preschool_id,
            'upload_type',       NEW.upload_type,
            'payment_amount',    NEW.payment_amount,
            'payment_reference', NEW.payment_reference,
            'file_name',         NEW.file_name,
            'status',            NEW.status,
            'created_at',        NEW.created_at
        )
    );

    -- Fire-and-forget HTTP POST via pg_net (async, does not block the INSERT)
    PERFORM net.http_post(
        url     := edge_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := payload
    );

    RAISE NOTICE '[POP Trigger] Notification fired for pop_upload %', NEW.id;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never block the INSERT if the notification fails
    RAISE WARNING '[POP Trigger] Failed to fire notification for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger on the pop_uploads table
DROP TRIGGER IF EXISTS trg_pop_upload_notify ON pop_uploads;

CREATE TRIGGER trg_pop_upload_notify
    AFTER INSERT ON pop_uploads
    FOR EACH ROW
    EXECUTE FUNCTION notify_pop_uploaded();