-- Allow message notifications in general notifications table
-- Ensures notify_message_recipients trigger can insert rows with type = 'message'

BEGIN;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (
      type IS NULL OR type IN (
        'general',
        'homework',
        'announcement',
        'payment',
        'emergency',
        'reminder',
        'message'
      )
    );

COMMIT;
