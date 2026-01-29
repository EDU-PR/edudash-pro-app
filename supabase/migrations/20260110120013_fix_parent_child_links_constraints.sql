-- Fix parent_child_links foreign key constraints
-- Date: 2026-01-10
-- Issue: Foreign keys reference 'users' table but should reference 'profiles' and 'students'

DO $$
BEGIN
  IF to_regclass('public.parent_child_links') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.students') IS NULL THEN
    RETURN;
  END IF;

  -- Drop existing foreign key constraints
  EXECUTE 'ALTER TABLE public.parent_child_links DROP CONSTRAINT IF EXISTS parent_child_links_parent_id_fkey CASCADE';
  EXECUTE 'ALTER TABLE public.parent_child_links DROP CONSTRAINT IF EXISTS parent_child_links_child_id_fkey CASCADE';

  -- Add correct foreign key constraints
  EXECUTE $ddl$
    ALTER TABLE public.parent_child_links
      ADD CONSTRAINT parent_child_links_parent_id_fkey
        FOREIGN KEY (parent_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE
  $ddl$;

  EXECUTE $ddl$
    ALTER TABLE public.parent_child_links
      ADD CONSTRAINT parent_child_links_child_id_fkey
        FOREIGN KEY (child_id)
        REFERENCES public.students(id)
        ON DELETE CASCADE
  $ddl$;

  -- Create indexes for better query performance
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_parent_child_links_parent_id ON public.parent_child_links(parent_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_parent_child_links_child_id ON public.parent_child_links(child_id)';

  -- Create the link between Zanele and Mbali
  EXECUTE $ddl$
    INSERT INTO public.parent_child_links (parent_id, child_id, relationship, is_primary, can_pick_up, emergency_contact)
    VALUES (
      '150f8d13-1b32-48e9-a37c-cf562459030b',
      '074692f3-f5a3-4fea-977a-b726828e5067',
      'parent',
      true,
      true,
      true
    )
    ON CONFLICT DO NOTHING
  $ddl$;

  -- Add comments on constraints
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parent_child_links_parent_id_fkey'
      AND conrelid = 'public.parent_child_links'::regclass
  ) THEN
    EXECUTE $ddl$
      COMMENT ON CONSTRAINT parent_child_links_parent_id_fkey ON public.parent_child_links IS
      'Links parent_id to profiles table (not users table)'
    $ddl$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parent_child_links_child_id_fkey'
      AND conrelid = 'public.parent_child_links'::regclass
  ) THEN
    EXECUTE $ddl$
      COMMENT ON CONSTRAINT parent_child_links_child_id_fkey ON public.parent_child_links IS
      'Links child_id to students table (not users table)'
    $ddl$;
  END IF;
END $$;
