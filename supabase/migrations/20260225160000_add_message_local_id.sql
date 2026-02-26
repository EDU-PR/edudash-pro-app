-- Add local_id to messages for offline-queue deduplication.
-- Each device-generated localId is paired with its thread so that duplicate
-- sends during queue flush are silently ignored via the unique index.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS local_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_thread_local_id
  ON public.messages (thread_id, local_id)
  WHERE local_id IS NOT NULL;
