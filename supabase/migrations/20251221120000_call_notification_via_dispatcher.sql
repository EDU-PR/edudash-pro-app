-- Migration: Send call notifications via notifications-dispatcher Edge Function
-- This ensures incoming calls trigger mobile push notifications when app is backgrounded/killed
-- The notifications-dispatcher sends Expo push notifications which work across all app states

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_queue_call_push ON active_calls;

-- Drop old function
DROP FUNCTION IF EXISTS queue_call_push_notification();

-- Create new function that calls notifications-dispatcher for mobile push AND queues web push
CREATE OR REPLACE FUNCTION queue_call_push_notification()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_name TEXT;
  callee_role TEXT;
  action_url TEXT;
  supabase_url TEXT;
  service_role_key TEXT;
  request_id BIGINT;
BEGIN
  -- Only queue for new ringing calls
  IF NEW.status != 'ringing' THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL and service role key from vault (or use hardcoded fallback)
  SELECT decrypted_secret INTO supabase_url 
  FROM vault.decrypted_secrets 
  WHERE name = 'supabase_url';
  
  IF supabase_url IS NULL THEN
    supabase_url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
  END IF;

  SELECT decrypted_secret INTO service_role_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'supabase_service_role_key';
  
  IF service_role_key IS NULL THEN
    -- Skip if no service role key (can't call Edge Function securely)
    RAISE WARNING 'No service_role_key found in vault, skipping notifications-dispatcher call';
  ELSE
    -- Get caller name for notification
    SELECT COALESCE(first_name || ' ' || last_name, email, 'Someone')
    INTO caller_name
    FROM profiles
    WHERE id = NEW.caller_id;

    -- Call notifications-dispatcher Edge Function for mobile push
    -- This sends Expo push notifications which work when app is killed
    SELECT INTO request_id net.http_post(
      url := supabase_url || '/functions/v1/notifications-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'event_type', 'incoming_call',
        'user_ids', ARRAY[NEW.callee_id],
        'call_id', NEW.call_id,
        'caller_id', NEW.caller_id,
        'caller_name', caller_name,
        'call_type', COALESCE(NEW.call_type, 'voice'),
        'meeting_url', NEW.meeting_url,
        'send_immediately', true,
        'include_push', true
      )::jsonb
    );
    
    RAISE LOG 'Sent incoming call notification for call % to user %, request_id: %', 
      NEW.call_id, NEW.callee_id, request_id;
  END IF;

  -- Also queue for web push (PWA support)
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Someone')
  INTO caller_name
  FROM profiles
  WHERE id = NEW.caller_id;

  SELECT role INTO callee_role
  FROM profiles
  WHERE id = NEW.callee_id;

  action_url := CASE 
    WHEN callee_role = 'parent' THEN '/dashboard/parent/messages'
    ELSE '/dashboard/teacher/messages'
  END;

  -- Insert into push_notification_queue for web push
  INSERT INTO push_notification_queue (
    user_id,
    title,
    body,
    tag,
    data,
    require_interaction
  ) VALUES (
    NEW.callee_id,
    'Incoming ' || COALESCE(NEW.call_type, 'voice') || ' call',
    caller_name || ' is calling...',
    'call-' || NEW.call_id,
    jsonb_build_object(
      'type', 'incoming_call',
      'url', action_url,
      'call_id', NEW.call_id,
      'caller_id', NEW.caller_id,
      'caller_name', caller_name,
      'call_type', COALESCE(NEW.call_type, 'voice'),
      'meeting_url', NEW.meeting_url,
      'channelId', 'calls',
      'priority', 'high',
      'sound', 'default',
      'categoryId', 'incoming_call'
    ),
    true -- Require interaction for calls
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_queue_call_push
AFTER INSERT ON active_calls
FOR EACH ROW
EXECUTE FUNCTION queue_call_push_notification();

-- Add comment
COMMENT ON FUNCTION queue_call_push_notification() IS 
  'Triggers notifications-dispatcher Edge Function for mobile push notifications AND queues web push for incoming calls. Mobile push uses Expo notifications which work when app is backgrounded or killed.';
