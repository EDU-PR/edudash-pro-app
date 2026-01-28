-- Fix parent_child_links foreign key constraints
-- Date: 2026-01-10
-- Issue: Foreign keys reference 'users' table but should reference 'profiles' and 'students'

-- Drop existing foreign key constraints
ALTER TABLE public.parent_child_links 
  DROP CONSTRAINT IF EXISTS parent_child_links_parent_id_fkey CASCADE;

ALTER TABLE public.parent_child_links 
  DROP CONSTRAINT IF EXISTS parent_child_links_child_id_fkey CASCADE;

-- Add correct foreign key constraints
-- parent_id should reference profiles table (not users)
ALTER TABLE public.parent_child_links
  ADD CONSTRAINT parent_child_links_parent_id_fkey 
    FOREIGN KEY (parent_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;

-- child_id should reference students table (not users)
ALTER TABLE public.parent_child_links
  ADD CONSTRAINT parent_child_links_child_id_fkey 
    FOREIGN KEY (child_id) 
    REFERENCES public.students(id) 
    ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_parent_child_links_parent_id 
  ON public.parent_child_links(parent_id);

CREATE INDEX IF NOT EXISTS idx_parent_child_links_child_id 
  ON public.parent_child_links(child_id);

-- Now create the link between Zanele and Mbali
INSERT INTO public.parent_child_links (parent_id, child_id, relationship, is_primary, can_pick_up, emergency_contact)
VALUES (
  '150f8d13-1b32-48e9-a37c-cf562459030b', -- Zanele's profile ID
  '074692f3-f5a3-4fea-977a-b726828e5067', -- Mbali's student ID
  'parent', -- Relationship type
  true, -- Is primary guardian
  true, -- Can pick up
  true  -- Emergency contact
)
ON CONFLICT DO NOTHING; -- Skip if link already exists

-- Verify the link was created
SELECT 
  pcl.id,
  p.email as parent_email,
  p.full_name as parent_name,
  s.first_name || ' ' || s.last_name as child_name,
  pcl.relationship
FROM public.parent_child_links pcl
JOIN public.profiles p ON pcl.parent_id = p.id
JOIN public.students s ON pcl.child_id = s.id
WHERE p.email = 'zanelelwndl@gmail.com';

COMMENT ON CONSTRAINT parent_child_links_parent_id_fkey ON public.parent_child_links IS 
'Links parent_id to profiles table (not users table)';

COMMENT ON CONSTRAINT parent_child_links_child_id_fkey ON public.parent_child_links IS 
'Links child_id to students table (not users table)';
