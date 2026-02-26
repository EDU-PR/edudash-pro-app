-- Thread Pinning (M3) + Per-Thread Notification Preferences (M10)
-- Adds pinning and notification mode columns to message_participants

ALTER TABLE message_participants ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE message_participants ADD COLUMN IF NOT EXISTS notification_mode TEXT DEFAULT 'all'
  CHECK (notification_mode IN ('all', 'mentions', 'muted'));
ALTER TABLE message_participants ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_message_participants_pinned
  ON message_participants(user_id, is_pinned) WHERE is_pinned = TRUE;
