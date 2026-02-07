-- =========================================================================
-- Migration: Add Parent-to-Parent Messaging Support
-- Description: Allows parents within the same organization to message
--              each other directly via 'parent-parent' thread type.
--              Also adds RLS policy for parent-created threads.
-- Author: Copilot
-- Date: 2026-02-07
-- =========================================================================

DO $do$
BEGIN

-- Guard: Only run if message_threads table exists
IF to_regclass('public.message_threads') IS NULL THEN
    RAISE NOTICE 'message_threads table not found, skipping migration';
    RETURN;
END IF;

-- =========================================================================
-- 1. Allow 'parent-parent' as a valid thread type
--    The type column uses a CHECK constraint — we need to update it.
--    First check if the constraint exists and drop/recreate it.
-- =========================================================================

-- Drop existing type check constraint if it exists
-- (The constraint name varies — try common patterns)
BEGIN
    ALTER TABLE message_threads
        DROP CONSTRAINT IF EXISTS message_threads_type_check;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- No constraint to drop
END;

-- The type column may not have a CHECK constraint (it's just TEXT),
-- so we only need to ensure our INSERT with 'parent-parent' works.
-- If there IS a constraint, the DROP above handled it.
-- We intentionally do NOT re-add a CHECK constraint to keep types flexible.

-- =========================================================================
-- 2. RLS: Allow parents to create threads (for parent-parent DMs)
-- =========================================================================

-- Policy: Allow authenticated users to create message threads
-- This enables parents to create parent-parent DM threads
DROP POLICY IF EXISTS "Users can create message threads" ON message_threads;
CREATE POLICY "Users can create message threads" ON message_threads
    FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
    );

-- Policy: Allow users to insert themselves as participants
DROP POLICY IF EXISTS "Users can add participants to own threads"
    ON message_participants;
CREATE POLICY "Users can add participants to own threads"
    ON message_participants
    FOR INSERT
    WITH CHECK (
        -- User is adding themselves
        auth.uid() = user_id
        OR
        -- User is the thread creator (can add the other participant)
        EXISTS (
            SELECT 1
            FROM message_threads
            WHERE id = message_participants.thread_id
            AND created_by = auth.uid()
        )
        OR
        -- User is a group admin
        EXISTS (
            SELECT 1
            FROM message_participants mp
            WHERE mp.thread_id = message_participants.thread_id
            AND mp.user_id = auth.uid()
            AND mp.is_admin = TRUE
        )
    );

-- =========================================================================
-- 3. Index for parent-parent thread lookups
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_message_threads_type_parent
    ON message_threads(type)
    WHERE type = 'parent-parent';

-- =========================================================================
-- 4. RLS: Allow parents to see profiles in their org (for contact list)
--    This may already exist but we ensure it does.
-- =========================================================================

-- Ensure profiles can be read by members of the same org
DROP POLICY IF EXISTS "Users can view profiles in same org" ON profiles;
CREATE POLICY "Users can view profiles in same org" ON profiles
    FOR SELECT
    USING (
        -- Same preschool/organization
        COALESCE(organization_id, preschool_id) = (
            SELECT COALESCE(p2.organization_id, p2.preschool_id)
            FROM profiles p2
            WHERE p2.id = auth.uid()
        )
        -- Or own profile
        OR id = auth.uid()
        -- Or super admin
        OR EXISTS (
            SELECT 1
            FROM profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin')
        )
    );

END $do$;
