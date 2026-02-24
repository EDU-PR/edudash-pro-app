-- Fix principal_groups.created_by foreign key.
--
-- Problem:
--   created_by currently references public.users(id), but the app
--   always sets created_by = auth.uid() (from Supabase Auth).
--   On most tenants, there is no matching row in public.users, which
--   causes:
--     insert or update on table "principal_groups"
--     violates foreign key constraint "principal_groups_created_by_fkey"
--
-- Fix:
--   Drop the old FK and re-create it to reference auth.users(id)
--   so principal_groups.created_by matches the authenticated user id.

DO $do$
BEGIN
  IF to_regclass('public.principal_groups') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'principal_groups_created_by_fkey'
      AND conrelid = 'public.principal_groups'::regclass
  ) THEN
    ALTER TABLE public.principal_groups
      DROP CONSTRAINT principal_groups_created_by_fkey;
  END IF;

  ALTER TABLE public.principal_groups
    ADD CONSTRAINT principal_groups_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
END;
$do$;
