-- Fix notifications foreign key to reference profiles instead of users
-- The users table is deprecated in favor of profiles table

BEGIN;

-- Drop the old foreign key constraint
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- Add new foreign key constraint to profiles table
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

-- Update the index to match
DROP INDEX IF EXISTS idx_notifications_user_id;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON public.notifications(user_id);

COMMIT;
