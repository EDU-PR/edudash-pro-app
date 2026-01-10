-- Fix lessons_teacher_id foreign key to reference profiles instead of users
-- Date: 2026-01-11
-- Issue: Save failed: insert or update on table "lessons" violates foreign key constraint "lessons_teacher_id_fkey"
-- Root cause: FK referenced non-existent users table instead of profiles table

BEGIN;

-- Note: This migration documents the manual fix applied:
-- 1. Updated orphan teacher_ids to NULL
-- 2. Changed FK from users to profiles

-- The following SQL was already applied manually:
-- UPDATE public.lessons SET teacher_id = NULL WHERE teacher_id IS NOT NULL AND teacher_id NOT IN (SELECT id FROM public.profiles);
-- ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_teacher_id_fkey;
-- ALTER TABLE public.lessons ADD CONSTRAINT lessons_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Verify the constraint exists correctly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'lessons' 
    AND constraint_name = 'lessons_teacher_id_fkey'
  ) THEN
    RAISE EXCEPTION 'lessons_teacher_id_fkey constraint does not exist';
  END IF;
END $$;

COMMIT;
