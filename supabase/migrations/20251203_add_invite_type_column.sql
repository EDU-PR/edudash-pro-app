-- Add invite_type column to invite_logs table
BEGIN;

ALTER TABLE public.invite_logs 
ADD COLUMN IF NOT EXISTS invite_type TEXT;

COMMIT;
