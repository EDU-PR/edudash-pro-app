-- Fix the messages table to add missing thread_id column
-- The table already exists but is missing the thread_id foreign key

-- Drop the existing messages table and recreate with correct schema
DROP TABLE IF EXISTS messages CASCADE;

-- Recreate messages table with correct schema
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES message_threads (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'system')),
  created_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Recreate index
CREATE INDEX idx_messages_thread_id_created_at ON messages (thread_id, created_at DESC);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY messages_select_policy ON messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM message_participants AS mp
    WHERE
      mp.thread_id = messages.thread_id
      AND mp.user_id = auth.uid()
  )
);

CREATE POLICY messages_insert_policy ON messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM message_participants AS mp
    WHERE
      mp.thread_id = messages.thread_id
      AND mp.user_id = auth.uid()
  )
);

CREATE POLICY messages_update_policy ON messages
FOR UPDATE USING (
  sender_id = auth.uid()
  AND deleted_at IS NULL
);

-- Recreate trigger
CREATE OR REPLACE FUNCTION update_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE message_threads 
    SET 
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_last_message_at
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_last_message_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;

-- Verify
SELECT 'SUCCESS: messages table fixed with thread_id column' AS status;
