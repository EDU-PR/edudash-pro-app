-- Migration: Update call push notification to use Expo Push with high priority
-- This ensures incoming calls wake the device and display even when app is backgrounded

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_queue_call_push ON active_calls;

-- Drop old function
DROP FUNCTION IF EXISTS queue_call_push_notification();

-- Create new function that sends Expo push notifications for calls
CREATE OR REPLACE FUNCTION queue_call_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  caller_name TEXT;
  callee_role TEXT;
  callee_token TEXT;
  action_url TEXT;
BEGIN
  -- Only queue for new ringing calls
  IF NEW.status != 'ringing' THEN
    RETURN NEW;
  END IF;

  -- Get caller name
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Someone')
  INTO caller_name
  FROM profiles
  WHERE id = NEW.caller_id;

  -- Get callee role for URL
  SELECT role INTO callee_role
  FROM profiles
  WHERE id = NEW.callee_id;

  action_url := CASE 
    WHEN callee_role = 'parent' THEN '/dashboard/parent/messages'
    ELSE '/dashboard/teacher/messages'
  END;

  -- Insert into push_notification_queue with HIGH priority for calls
  -- This will be processed by push-queue-processor Edge Function
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trigger_queue_call_push
AFTER INSERT ON active_calls
FOR EACH ROW
EXECUTE FUNCTION queue_call_push_notification();

-- Add comment
COMMENT ON FUNCTION queue_call_push_notification() IS 
  'Queues high-priority Expo push notifications for incoming call recipients. Uses calls channel with maximum priority to wake device.';
