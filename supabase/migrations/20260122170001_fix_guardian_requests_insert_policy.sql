-- ==========================================================================
-- Migration: Fix guardian_requests_parent_insert RLS Policy
-- Date: 2026-01-22
-- Author: AI Assistant
-- 
-- Problem:
-- The guardian_requests_parent_insert policy had a bug where it checked
-- profiles.id = auth.uid() instead of profiles.auth_user_id = auth.uid()
-- 
-- Fix Applied Directly to Database:
-- The fix was applied directly via psql. This migration documents the change.
-- ==========================================================================

-- Note: This policy was already fixed directly in the database.
-- This migration ensures consistency and documents the fix.

-- Drop and recreate to ensure correct state
DROP POLICY IF EXISTS guardian_requests_parent_insert ON guardian_requests;

CREATE POLICY guardian_requests_parent_insert ON guardian_requests
  FOR INSERT
  WITH CHECK (
    (parent_auth_id = auth.uid()) 
    AND (status = 'pending'::text) 
    AND (
      (school_id IS NULL) 
      OR (EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.auth_user_id = auth.uid()  -- CORRECT: Match auth_user_id, not id
          AND p.role = 'parent'::text 
          AND p.preschool_id = guardian_requests.school_id
      ))
    )
  );

COMMENT ON POLICY guardian_requests_parent_insert ON guardian_requests IS 
'Allows parents to insert guardian requests. Fixed 2026-01-22 to use profiles.auth_user_id = auth.uid() instead of profiles.id = auth.uid()';
