-- Migration: Add mobile push notification trigger for messages
-- Date: 2024-12-24
-- Description: Calls notifications-dispatcher Edge Function to send Expo push notifications
-- This enables message notifications to appear in the Android/iOS notification drawer

-- Function to call notifications-dispatcher for mobile push
CREATE OR REPLACE FUNCTION notify_message_recipients()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_ids UUID[];
  sender_name TEXT;
  supabase_url TEXT;
  service_role_key TEXT;
  request_id BIGINT;
  message_preview TEXT;
BEGIN
  -- Get Supabase URL from vault (or use hardcoded fallback)
  SELECT decrypted_secret INTO supabase_url 
  FROM vault.decrypted_secrets 
  WHERE name = 'supabase_url';
  
  IF supabase_url IS NULL THEN
    supabase_url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
  END IF;

  -- Get service role key from vault
  SELECT decrypted_secret INTO service_role_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'supabase_service_role_key';
  
  IF service_role_key IS NULL THEN
    -- Skip if no service role key (can't call Edge Function securely)
    RAISE WARNING 'No service_role_key found in vault, skipping mobile push notification';
    RETURN NEW;
  END IF;

  -- Get sender name for notification
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Someone')
  INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Get all recipient IDs (except sender)
  SELECT ARRAY_AGG(mp.user_id)
  INTO recipient_ids
  FROM message_participants mp
  WHERE mp.thread_id = NEW.thread_id
    AND mp.user_id != NEW.sender_id;

  -- No recipients to notify
  IF recipient_ids IS NULL OR ARRAY_LENGTH(recipient_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Create message preview
  message_preview := CASE 
    WHEN NEW.content IS NULL OR NEW.content = '' THEN 'Sent an attachment'
    WHEN LENGTH(NEW.content) > 50 THEN LEFT(NEW.content, 47) || '...'
    ELSE NEW.content
  END;

  -- Call notifications-dispatcher Edge Function for mobile push
  -- This sends Expo push notifications which appear in notification drawer
  SELECT INTO request_id net.http_post(
    url := supabase_url || '/functions/v1/notifications-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'event_type', 'new_message',
      'user_ids', recipient_ids,
      'thread_id', NEW.thread_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'sender_name', sender_name,
      'message_preview', message_preview,
      'send_immediately', true,
      'include_push', true
    )::jsonb
  );
  
  RAISE LOG 'Sent message notification for message % in thread % to % users, request_id: %', 
    NEW.id, NEW.thread_id, ARRAY_LENGTH(recipient_ids, 1), request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_notify_message_recipients ON messages;

-- Create trigger to send mobile push notification on new message
CREATE TRIGGER trigger_notify_message_recipients
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_message_recipients();

-- Add comment explaining the purpose
COMMENT ON FUNCTION notify_message_recipients() IS 
  'Sends mobile push notifications via notifications-dispatcher Edge Function when messages are sent. Notifications appear in Android/iOS notification drawer like WhatsApp.';
