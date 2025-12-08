-- Migration: Add message read tracking
-- Adds read_by column to track which users have read each message
-- Updates RLS policies to support read tracking

-- Add read_by column to messages table
-- This stores an array of user IDs who have read the message
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';

-- Add index for read_by queries
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON messages USING GIN (read_by);

-- Create function to mark message as read
CREATE OR REPLACE FUNCTION mark_message_as_read(message_id UUID, reader_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE messages
  SET read_by = array_append(read_by, reader_id)
  WHERE id = message_id
    AND NOT (reader_id = ANY(read_by))
    AND sender_id != reader_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark all messages in thread as read
CREATE OR REPLACE FUNCTION mark_thread_messages_as_read(thread_id UUID, reader_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE messages
  SET read_by = array_append(read_by, reader_id)
  WHERE messages.thread_id = mark_thread_messages_as_read.thread_id
    AND NOT (reader_id = ANY(read_by))
    AND sender_id != reader_id;
    
  -- Also update last_read_at in message_participants
  UPDATE message_participants
  SET last_read_at = now()
  WHERE message_participants.thread_id = mark_thread_messages_as_read.thread_id
    AND user_id = reader_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_message_as_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_thread_messages_as_read(UUID, UUID) TO authenticated;

-- Add comment explaining the schema
COMMENT ON COLUMN messages.read_by IS 'Array of user IDs who have read this message. Excludes the sender.';
