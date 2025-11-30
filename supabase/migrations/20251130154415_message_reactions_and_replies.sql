-- Add reply_to_id column to messages for reply threading
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Add forwarded_from_id for forwarded messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS on message_reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_reactions
CREATE POLICY "Users can view reactions on messages in their threads" ON message_reactions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM message_participants mp
        WHERE mp.thread_id = (SELECT thread_id FROM messages WHERE id = message_reactions.message_id)
        AND mp.user_id = auth.uid()
    )
);

CREATE POLICY "Users can add reactions to messages in their threads" ON message_reactions
FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM message_participants mp
        WHERE mp.thread_id = (SELECT thread_id FROM messages WHERE id = message_reactions.message_id)
        AND mp.user_id = auth.uid()
    )
);

CREATE POLICY "Users can remove their own reactions" ON message_reactions
FOR DELETE USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;
GRANT ALL ON message_reactions TO service_role;

-- Index for faster reaction queries
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);

-- Index for reply lookups
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Update messages RLS to allow soft delete (update deleted_at instead of hard delete)
-- Users can soft-delete their own messages by setting deleted_at
DROP POLICY IF EXISTS "messages_update_policy" ON messages;
CREATE POLICY "messages_update_policy" ON messages
FOR UPDATE USING (
    sender_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM message_participants mp
        WHERE mp.thread_id = messages.thread_id
        AND mp.user_id = auth.uid()
    )
) WITH CHECK (
    sender_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM message_participants mp
        WHERE mp.thread_id = messages.thread_id
        AND mp.user_id = auth.uid()
    )
);

-- Add comment
COMMENT ON TABLE message_reactions IS 'Emoji reactions on chat messages';
COMMENT ON COLUMN messages.reply_to_id IS 'Reference to the message being replied to';
COMMENT ON COLUMN messages.forwarded_from_id IS 'Reference to the original message if this is a forward';
