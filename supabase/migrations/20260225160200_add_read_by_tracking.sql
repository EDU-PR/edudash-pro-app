-- Read-By List + Announcement Analytics (M9 + M13)
-- Track individual read receipts per message

CREATE TABLE IF NOT EXISTS message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_read_receipts_message ON message_read_receipts(message_id);

-- RLS
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see read receipts for their threads" ON message_read_receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN message_participants mp ON mp.thread_id = m.thread_id
      WHERE m.id = message_read_receipts.message_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own read receipts" ON message_read_receipts
  FOR INSERT WITH CHECK (user_id = auth.uid());
