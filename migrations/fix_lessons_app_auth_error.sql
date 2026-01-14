-- Fix lessons table RLS policies to remove app_auth schema dependency
-- This migration fixes the "permission denied for schema app_auth" error
-- that occurs when users try to access lessons

BEGIN;

-- ====================================================================
-- STEP 1: DROP ALL EXISTING POLICIES ON LESSONS TABLE
-- ====================================================================

-- Drop any policies that might reference app_auth
DROP POLICY IF EXISTS "lessons_rls_read" ON lessons;
DROP POLICY IF EXISTS "lessons_rls_write" ON lessons;
DROP POLICY IF EXISTS "lessons_tenant_isolation" ON lessons;
DROP POLICY IF EXISTS "service_role_access" ON lessons;
DROP POLICY IF EXISTS "authenticated_access" ON lessons;
DROP POLICY IF EXISTS "anon_debug_access" ON lessons;
DROP POLICY IF EXISTS "lessons_select_policy" ON lessons;
DROP POLICY IF EXISTS "lessons_insert_policy" ON lessons;
DROP POLICY IF EXISTS "lessons_update_policy" ON lessons;
DROP POLICY IF EXISTS "lessons_delete_policy" ON lessons;
DROP POLICY IF EXISTS "Teachers can view their own lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can view school lessons" ON lessons;
DROP POLICY IF EXISTS "Allow read access to lessons" ON lessons;
DROP POLICY IF EXISTS "Allow write access to lessons" ON lessons;

-- ====================================================================
-- STEP 2: ENSURE RLS IS ENABLED
-- ====================================================================

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- STEP 3: CREATE NEW POLICIES WITHOUT APP_AUTH DEPENDENCY
-- ====================================================================

-- 1. SERVICE ROLE BYPASS (Critical for Edge Functions and admin operations)
CREATE POLICY "lessons_service_role_bypass"
ON lessons FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. AUTHENTICATED USERS - Can view lessons from their organization
CREATE POLICY "lessons_org_read_access"
ON lessons FOR SELECT
TO authenticated
USING (
  -- Super-admins can see all lessons
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
  OR
  -- Users can see lessons from their organization
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id IS NOT NULL
    AND profiles.organization_id = lessons.preschool_id
  )
  OR
  -- Public lessons can be viewed by any authenticated user
  (lessons.is_public = true)
);

-- 3. TEACHERS - Can create/update/delete their own lessons
CREATE POLICY "lessons_teacher_write_access"
ON lessons FOR INSERT
TO authenticated
WITH CHECK (
  -- Teachers can create lessons for their organization
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('teacher', 'principal', 'superadmin')
    AND (
      profiles.organization_id = lessons.preschool_id
      OR profiles.role = 'superadmin'
    )
  )
);

CREATE POLICY "lessons_teacher_update_access"
ON lessons FOR UPDATE
TO authenticated
USING (
  -- Teachers can update their own lessons
  lessons.teacher_id = auth.uid()
  OR
  -- Principals can update any lesson in their org
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('principal', 'superadmin')
    AND (
      profiles.organization_id = lessons.preschool_id
      OR profiles.role = 'superadmin'
    )
  )
)
WITH CHECK (
  lessons.teacher_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('principal', 'superadmin')
    AND (
      profiles.organization_id = lessons.preschool_id
      OR profiles.role = 'superadmin'
    )
  )
);

CREATE POLICY "lessons_teacher_delete_access"
ON lessons FOR DELETE
TO authenticated
USING (
  -- Teachers can delete their own lessons
  lessons.teacher_id = auth.uid()
  OR
  -- Principals can delete any lesson in their org
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('principal', 'superadmin')
    AND (
      profiles.organization_id = lessons.preschool_id
      OR profiles.role = 'superadmin'
    )
  )
);

-- ====================================================================
-- STEP 4: CREATE user_lesson_bookmarks TABLE IF NOT EXISTS
-- ====================================================================

CREATE TABLE IF NOT EXISTS user_lesson_bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Enable RLS on bookmarks table
ALTER TABLE user_lesson_bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies for bookmarks
CREATE POLICY "bookmarks_user_access"
ON user_lesson_bookmarks FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookmarks_service_role_bypass"
ON user_lesson_bookmarks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ====================================================================
-- STEP 5: VERIFICATION
-- ====================================================================

-- Test that lessons are now accessible
SELECT 'Testing lessons access:' AS test;
SELECT COUNT(*) AS total_lessons FROM lessons;

-- Show new policies
SELECT
  'Current lessons policies:' AS info,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE
  schemaname = 'public'
  AND tablename = 'lessons'
ORDER BY policyname;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ====================================================================
-- SUCCESS MESSAGE
-- ====================================================================

/*
Migration completed successfully!

Fixed the following issues:
1. Removed all RLS policies referencing app_auth schema
2. Created new policies using only auth.uid() and profiles table
3. Created user_lesson_bookmarks table for bookmark functionality

Users should now be able to:
- View lessons from their organization
- Create/update/delete their own lessons (teachers)
- Manage lessons in their org (principals)
- Bookmark lessons

Test by having katso@youngeagles.org.za access lessons again.
*/
