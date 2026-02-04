-- Expand notifications.type allowed values and align default

BEGIN;

ALTER TABLE public.notifications
  ALTER COLUMN type SET DEFAULT 'general';

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'general',
    'homework',
    'announcement',
    'payment',
    'emergency',
    'reminder',
    'message',
    'info',
    'warning',
    'success',
    'error'
  ));

COMMIT;
