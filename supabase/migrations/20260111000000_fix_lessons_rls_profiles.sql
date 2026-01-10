-- Fix lessons RLS policies to use profiles instead of users
-- Date: 2026-01-11
-- Issue: Teachers can't save lessons because RLS policies reference 'users' table
-- which doesn't contain their data (data is in 'profiles' table)

BEGIN;

-- Drop old policies that reference 'users' table
DROP POLICY IF EXISTS "lessons_teacher_access" ON public.lessons;
DROP POLICY IF EXISTS "lessons_tenant_access" ON public.lessons;

-- Create new teacher access policy using profiles
CREATE POLICY "lessons_teacher_insert"
ON public.lessons
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'teacher'
    AND p.preschool_id = lessons.preschool_id
  )
);

CREATE POLICY "lessons_teacher_update"
ON public.lessons
FOR UPDATE
TO authenticated
USING (
  teacher_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'teacher'
    AND p.preschool_id = lessons.preschool_id
  )
)
WITH CHECK (
  teacher_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'teacher'
    AND p.preschool_id = lessons.preschool_id
  )
);

CREATE POLICY "lessons_teacher_delete"
ON public.lessons
FOR DELETE
TO authenticated
USING (
  teacher_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'teacher'
    AND p.preschool_id = lessons.preschool_id
  )
);

CREATE POLICY "lessons_teacher_select"
ON public.lessons
FOR SELECT
TO authenticated
USING (
  -- Teachers can see their own lessons
  teacher_id = auth.uid()
  OR
  -- Teachers can see lessons from their school
  preschool_id IN (
    SELECT p.preschool_id FROM public.profiles p WHERE p.id = auth.uid()
  )
  OR
  -- Public lessons are visible to all
  is_public = true
);

-- Create principal/admin access policy using profiles
CREATE POLICY "lessons_principal_access"
ON public.lessons
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'admin', 'preschool_admin')
    AND p.preschool_id = lessons.preschool_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'admin', 'preschool_admin')
    AND p.preschool_id = lessons.preschool_id
  )
);

COMMIT;
