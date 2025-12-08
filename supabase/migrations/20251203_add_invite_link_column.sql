-- Add invite_link column to invite_logs table
BEGIN;

ALTER TABLE public.invite_logs 
ADD COLUMN IF NOT EXISTS invite_link TEXT;

-- Add index for invite_link lookups
CREATE INDEX IF NOT EXISTS idx_invite_logs_invite_link ON public.invite_logs(invite_link);

COMMIT;
