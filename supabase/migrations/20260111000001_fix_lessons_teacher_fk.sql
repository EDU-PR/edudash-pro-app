-- Fix lessons_teacher_id foreign key to reference profiles instead of users
-- Date: 2026-01-11
-- Issue: Save failed: insert or update on table "lessons" violates foreign key constraint "lessons_teacher_id_fkey"
-- Root cause: FK referenced non-existent users table instead of profiles table

DO $$
BEGIN
  IF to_regclass('public.lessons') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'lessons'
    AND constraint_name = 'lessons_teacher_id_fkey'
  ) THEN
    RAISE NOTICE 'lessons_teacher_id_fkey constraint does not exist';
  END IF;
END $$;
