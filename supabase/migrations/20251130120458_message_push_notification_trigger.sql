-- Migration: Create table to queue push notifications for async processing
-- Date: 2024-11-30
-- Description: Uses a queue table + realtime to trigger push notifications
-- This approach is non-blocking and works reliably with Supabase

-- Create a queue table for pending push notifications
CREATE TABLE IF NOT EXISTS push_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT DEFAULT '/icon-192.png',
  badge TEXT DEFAULT '/icon-192.png',
  tag TEXT,
  data JSONB DEFAULT '{}',
  require_interaction BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_push_queue_status_created 
ON push_notification_queue(status, created_at) 
WHERE status = 'pending';

-- Enable RLS
ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY push_queue_service_role ON push_notification_queue
FOR ALL USING (auth.role() = 'service_role');

-- Enable realtime for the queue table (so Edge Functions can subscribe)
ALTER PUBLICATION supabase_realtime ADD TABLE push_notification_queue;

-- Function to queue push notification when a message is sent
CREATE OR REPLACE FUNCTION queue_message_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient_record RECORD;
  sender_name TEXT;
  message_preview TEXT;
  recipient_role TEXT;
  action_url TEXT;
BEGIN
  -- Get sender name
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Someone')
  INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Create message preview (truncate if too long)
  message_preview := CASE 
    WHEN LENGTH(NEW.content) > 50 THEN LEFT(NEW.content, 47) || '...'
    ELSE NEW.content
  END;

  -- Queue notification for each recipient (except sender)
  FOR recipient_record IN
    SELECT mp.user_id, p.role
    FROM message_participants mp
    JOIN profiles p ON p.id = mp.user_id
    WHERE mp.thread_id = NEW.thread_id
      AND mp.user_id != NEW.sender_id
  LOOP
    -- Determine action URL based on recipient role
    action_url := CASE 
      WHEN recipient_record.role = 'parent' THEN '/dashboard/parent/messages?thread=' || NEW.thread_id
      ELSE '/dashboard/teacher/messages?thread=' || NEW.thread_id
    END;

    -- Insert into queue
    INSERT INTO push_notification_queue (
      user_id,
      title,
      body,
      tag,
      data,
      require_interaction
    ) VALUES (
      recipient_record.user_id,
      'New message from ' || COALESCE(sender_name, 'Someone'),
      message_preview,
      'message-' || NEW.thread_id,
      jsonb_build_object(
        'type', 'message',
        'url', action_url,
        'thread_id', NEW.thread_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'sender_name', sender_name
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_queue_message_push ON messages;
DROP TRIGGER IF EXISTS trigger_send_message_push ON messages;

-- Create trigger to queue push notification on new message
CREATE TRIGGER trigger_queue_message_push
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION queue_message_push_notification();

-- Function to queue push notification for incoming calls
CREATE OR REPLACE FUNCTION queue_call_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  caller_name TEXT;
  callee_role TEXT;
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

  -- Insert into queue with high priority (call notifications)
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
      'type', 'call',
      'url', action_url,
      'call_id', NEW.call_id,
      'caller_id', NEW.caller_id,
      'caller_name', caller_name,
      'call_type', NEW.call_type,
      'meeting_url', NEW.meeting_url
    ),
    true -- Require interaction for calls
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing call trigger if it exists  
DROP TRIGGER IF EXISTS trigger_queue_call_push ON active_calls;

-- Create trigger to queue push notification for incoming calls
CREATE TRIGGER trigger_queue_call_push
AFTER INSERT ON active_calls
FOR EACH ROW
EXECUTE FUNCTION queue_call_push_notification();

-- Add comments
COMMENT ON TABLE push_notification_queue IS 
  'Queue table for pending web push notifications. Processed by Edge Function listening via realtime.';

COMMENT ON FUNCTION queue_message_push_notification() IS 
  'Queues web push notifications for message recipients. Non-blocking.';

COMMENT ON FUNCTION queue_call_push_notification() IS 
  'Queues web push notifications for incoming call recipients. Non-blocking.';
