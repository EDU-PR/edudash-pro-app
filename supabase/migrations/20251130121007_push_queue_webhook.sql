-- Migration: Create database webhook to process push notification queue
-- Date: 2024-11-30
-- Description: Triggers the push-queue-processor Edge Function when new items are added to the queue

-- Note: Supabase Database Webhooks are configured via the Dashboard or API, not SQL
-- This migration creates a pg_net extension-based approach as an alternative

-- Enable pg_net extension for making HTTP requests from within PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to call the push-queue-processor Edge Function
CREATE OR REPLACE FUNCTION process_push_queue_item()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/push-queue-processor';
  request_body JSONB;
BEGIN
  -- Build the request body with the new record
  request_body := jsonb_build_object(
    'type', 'INSERT',
    'record', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.body,
      'icon', NEW.icon,
      'badge', NEW.badge,
      'tag', NEW.tag,
      'data', NEW.data,
      'require_interaction', NEW.require_interaction
    )
  );

  -- Use pg_net to make async HTTP request (non-blocking)
  -- No auth header needed since function is deployed with --no-verify-jwt
  PERFORM net.http_post(
    url := edge_function_url,
    body := request_body::TEXT,
    headers := '{"Content-Type": "application/json"}'::JSONB
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Failed to trigger push processor: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_process_push_queue ON push_notification_queue;

-- Create trigger to process queue items immediately
CREATE TRIGGER trigger_process_push_queue
AFTER INSERT ON push_notification_queue
FOR EACH ROW
EXECUTE FUNCTION process_push_queue_item();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, service_role;

-- Add comment
COMMENT ON FUNCTION process_push_queue_item() IS 
  'Triggers the push-queue-processor Edge Function when a new notification is queued. Uses pg_net for async HTTP calls.';
