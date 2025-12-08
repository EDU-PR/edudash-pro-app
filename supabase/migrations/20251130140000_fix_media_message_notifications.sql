-- Migration: Fix notification message for media content
-- Transforms __media__ encoded messages to friendly display text

-- Helper function to convert media content to display text
CREATE OR REPLACE FUNCTION get_message_display_text(content TEXT)
RETURNS TEXT AS $$
DECLARE
  media_type TEXT;
  media_name TEXT;
BEGIN
  -- Check if this is a media message
  IF content LIKE '__media__%' THEN
    BEGIN
      -- Extract media type from JSON (after removing __media__ prefix)
      media_type := (SUBSTRING(content FROM 10))::json->>'mediaType';
      media_name := (SUBSTRING(content FROM 10))::json->>'name';
    EXCEPTION WHEN OTHERS THEN
      media_type := 'file';
      media_name := NULL;
    END;
    
    -- Return friendly display text based on media type
    RETURN CASE media_type
      WHEN 'audio' THEN '🎤 Voice message'
      WHEN 'image' THEN '📷 Image'
      WHEN 'file' THEN COALESCE('📎 ' || media_name, '📎 File attachment')
      ELSE '📎 Attachment'
    END;
  ELSE
    -- Regular text - return as-is (caller handles truncation)
    RETURN content;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_message_display_text(TEXT) IS 
  'Converts __media__ encoded message content to friendly display text like "🎤 Voice message"';

-- Update the notification trigger to handle media messages properly
CREATE OR REPLACE FUNCTION notify_message_recipients()
RETURNS TRIGGER AS $$
DECLARE
  participant RECORD;
  sender_name TEXT;
  thread_type TEXT;
  thread_preschool_id UUID;
  student_name TEXT;
  display_message TEXT;
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

  -- Get display message (handles media content transformation)
  display_message := get_message_display_text(NEW.content);
  
  -- Truncate if needed (only for regular text, media messages are already short)
  IF LENGTH(display_message) > 100 AND NOT display_message LIKE '🎤%' AND NOT display_message LIKE '📷%' AND NOT display_message LIKE '📎%' THEN
    display_message := LEFT(display_message, 97) || '...';
  END IF;

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
      display_message,
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

COMMENT ON FUNCTION notify_message_recipients() IS 
  'Creates notification records for message recipients when new messages are sent. Transforms media messages to friendly display text (e.g., "🎤 Voice message").';

-- Update the push notification queue trigger to handle media messages
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

  -- Get message preview (handles media content transformation)
  message_preview := get_message_display_text(NEW.content);
  
  -- Truncate if needed (only for regular text)
  IF LENGTH(message_preview) > 50 AND NOT message_preview LIKE '🎤%' AND NOT message_preview LIKE '📷%' AND NOT message_preview LIKE '📎%' THEN
    message_preview := LEFT(message_preview, 47) || '...';
  END IF;

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

COMMENT ON FUNCTION queue_message_push_notification() IS 
  'Queues web push notifications for message recipients. Transforms media content to friendly text. Non-blocking.';
