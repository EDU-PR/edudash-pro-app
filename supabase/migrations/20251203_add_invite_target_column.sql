-- Add invite_target column to invite_logs table
BEGIN;

ALTER TABLE public.invite_logs 
ADD COLUMN IF NOT EXISTS invite_target TEXT;

COMMIT;
