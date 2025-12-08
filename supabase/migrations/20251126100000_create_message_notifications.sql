-- Migration: Create notifications for new messages
-- This trigger creates a notification for each recipient when a new message is sent
-- Enables instant notification indicators on dashboard and bell icon

-- Function to create notification for message recipients
CREATE OR REPLACE FUNCTION notify_message_recipients()
RETURNS TRIGGER AS $$
DECLARE
  participant RECORD;
  sender_name TEXT;
  thread_type TEXT;
  thread_preschool_id UUID;
  student_name TEXT;
BEGIN
  -- Get sender name
  SELECT 
    COALESCE(first_name || ' ' || last_name, email, 'Someone') INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Get thread info
  SELECT type, preschool_id, student_id INTO thread_type, thread_preschool_id
  FROM message_threads
  WHERE id = NEW.thread_id;

  -- Get student name if thread is about a student
  SELECT first_name || ' ' || last_name INTO student_name
  FROM students
  WHERE id = (SELECT student_id FROM message_threads WHERE id = NEW.thread_id);

  -- Create notification for each participant except sender
  FOR participant IN
    SELECT user_id
    FROM message_participants
    WHERE thread_id = NEW.thread_id
      AND user_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      is_read,
      action_url,
      preschool_id,
      metadata
    ) VALUES (
      participant.user_id,
      'New message from ' || COALESCE(sender_name, 'Unknown'),
      CASE 
        WHEN LENGTH(NEW.content) > 100 THEN LEFT(NEW.content, 97) || '...'
        ELSE NEW.content
      END,
      'message',
      false,
      CASE
        WHEN (SELECT role FROM profiles WHERE id = participant.user_id) = 'parent' 
          THEN '/dashboard/parent/messages'
        WHEN (SELECT role FROM profiles WHERE id = participant.user_id) IN ('teacher', 'principal') 
          THEN '/dashboard/teacher/messages'
        ELSE '/dashboard'
      END,
      thread_preschool_id,
      jsonb_build_object(
        'thread_id', NEW.thread_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'sender_name', sender_name,
        'student_name', student_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_message_recipients ON messages;

-- Create trigger to run on new message insert
CREATE TRIGGER trigger_notify_message_recipients
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_message_recipients();

-- Enable realtime for messages table (if not already enabled)
-- This allows real-time subscriptions to work for instant message delivery
DO $$
BEGIN
  -- Try to enable realtime (will silently fail if already enabled or not supported)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication, that's fine
    NULL;
  WHEN undefined_object THEN
    -- Publication doesn't exist, create it
    CREATE PUBLICATION supabase_realtime FOR TABLE messages;
  END;
END $$;

-- Also enable realtime for notifications table
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  WHEN undefined_object THEN
    -- Publication doesn't exist for notifications, add it
    NULL;
  END;
END $$;

-- Add index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON notifications (user_id, is_read) 
WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications (type) 
WHERE type = 'message';

-- Add comment explaining the trigger
COMMENT ON FUNCTION notify_message_recipients() IS 
  'Creates notification records for message recipients when new messages are sent. Enables instant notification badges on dashboard.';
