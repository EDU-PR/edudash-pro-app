-- Migration: Fix video_calls and students FK relationships
-- Date: 2026-01-22
-- Description: Fix FK relationships, add RLS policies for video_calls table, and fix profile visibility

-- ============================================================================
-- 1. Fix video_calls table - ensure proper FK constraints and RLS policies
-- ============================================================================

-- Ensure video_calls table exists with core columns used by policies/indexes
CREATE TABLE IF NOT EXISTS video_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES profiles(id),
    class_id UUID REFERENCES classes(id),
    preschool_id UUID REFERENCES preschools(id),
    status TEXT,
    scheduled_start TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- First, check if video_calls table exists and has proper structure
DO $$
BEGIN
    -- Add teacher_id column if it doesn't exist (references profiles.id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_calls' AND column_name = 'teacher_id'
    ) THEN
        ALTER TABLE video_calls ADD COLUMN teacher_id UUID REFERENCES profiles(id);
    END IF;

    -- Add class_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_calls' AND column_name = 'class_id'
    ) THEN
        ALTER TABLE video_calls ADD COLUMN class_id UUID REFERENCES classes(id);
    END IF;

    -- Add preschool_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_calls' AND column_name = 'preschool_id'
    ) THEN
        ALTER TABLE video_calls ADD COLUMN preschool_id UUID REFERENCES preschools(id);
    END IF;
END $$;

-- ============================================================================
-- 2. Enable RLS on video_calls if not already enabled
-- ============================================================================
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Drop existing policies to recreate them properly
-- ============================================================================
DROP POLICY IF EXISTS "video_calls_select_policy" ON video_calls;
DROP POLICY IF EXISTS "video_calls_insert_policy" ON video_calls;
DROP POLICY IF EXISTS "video_calls_update_policy" ON video_calls;
DROP POLICY IF EXISTS "video_calls_delete_policy" ON video_calls;
DROP POLICY IF EXISTS "Users can view video calls at their school" ON video_calls;
DROP POLICY IF EXISTS "Teachers can manage their video calls" ON video_calls;
DROP POLICY IF EXISTS "Principals can manage school video calls" ON video_calls;

-- ============================================================================
-- 4. Create comprehensive RLS policies for video_calls
-- ============================================================================

-- Ensure participants table exists before policies that reference it
CREATE TABLE IF NOT EXISTS video_call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_call_id UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    role VARCHAR(50) DEFAULT 'participant',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_call_id, user_id)
);

-- SELECT: Users can view video calls at their school or that they're invited to
CREATE POLICY "video_calls_select_policy" ON video_calls
    FOR SELECT
    USING (
        -- User is from the same school
        preschool_id IN (
            SELECT COALESCE(organization_id, preschool_id)
            FROM profiles
            WHERE id = auth.uid()
        )
        OR
        -- User is the teacher of the call
        teacher_id = auth.uid()
        OR
        -- User is a participant (check video_call_participants table if it exists)
        EXISTS (
            SELECT 1 FROM video_call_participants vcp
            WHERE vcp.video_call_id = video_calls.id
            AND vcp.user_id = auth.uid()
        )
    );

-- INSERT: Teachers and principals can create video calls
CREATE POLICY "video_calls_insert_policy" ON video_calls
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('teacher', 'principal', 'principal_admin', 'super_admin')
            AND (
                video_calls.preschool_id IS NULL 
                OR COALESCE(p.organization_id, p.preschool_id) = video_calls.preschool_id
            )
        )
    );

-- UPDATE: Teachers can update their own calls, principals can update school calls
CREATE POLICY "video_calls_update_policy" ON video_calls
    FOR UPDATE
    USING (
        teacher_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('principal', 'principal_admin', 'super_admin')
            AND COALESCE(p.organization_id, p.preschool_id) = video_calls.preschool_id
        )
    );

-- DELETE: Teachers can delete their own calls, principals can delete school calls
CREATE POLICY "video_calls_delete_policy" ON video_calls
    FOR DELETE
    USING (
        teacher_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('principal', 'principal_admin', 'super_admin')
            AND COALESCE(p.organization_id, p.preschool_id) = video_calls.preschool_id
        )
    );

-- ============================================================================
-- 5. Create video_call_participants table if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_call_id UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    role VARCHAR(50) DEFAULT 'participant',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_call_id, user_id)
);

-- Enable RLS on participants table
ALTER TABLE video_call_participants ENABLE ROW LEVEL SECURITY;

-- Policies for video_call_participants
DROP POLICY IF EXISTS "video_call_participants_select" ON video_call_participants;
DROP POLICY IF EXISTS "video_call_participants_insert" ON video_call_participants;
DROP POLICY IF EXISTS "video_call_participants_update" ON video_call_participants;

CREATE POLICY "video_call_participants_select" ON video_call_participants
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM video_calls vc
            WHERE vc.id = video_call_participants.video_call_id
            AND vc.teacher_id = auth.uid()
        )
    );

CREATE POLICY "video_call_participants_insert" ON video_call_participants
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM video_calls vc
            WHERE vc.id = video_call_participants.video_call_id
            AND vc.teacher_id = auth.uid()
        )
    );

CREATE POLICY "video_call_participants_update" ON video_call_participants
    FOR UPDATE
    USING (user_id = auth.uid());

-- ============================================================================
-- 6. Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_video_calls_preschool_id ON video_calls(preschool_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_teacher_id ON video_calls(teacher_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_class_id ON video_calls(class_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON video_calls(status);
CREATE INDEX IF NOT EXISTS idx_video_calls_scheduled_start ON video_calls(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_video_call_participants_call_id ON video_call_participants(video_call_id);
CREATE INDEX IF NOT EXISTS idx_video_call_participants_user_id ON video_call_participants(user_id);

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON video_calls TO authenticated;
GRANT SELECT, INSERT, UPDATE ON video_call_participants TO authenticated;

-- ============================================================================
-- 8. Fix profiles visibility for FK joins (students_parent_id_fkey)
-- ============================================================================

-- Policy: Allow staff to view parent profiles at their school
DROP POLICY IF EXISTS "profiles_staff_view_school_parents" ON profiles;

CREATE POLICY "profiles_staff_view_school_parents" ON profiles
    FOR SELECT
    USING (
        -- User is staff (teacher/principal) at same school as target profile
        EXISTS (
            SELECT 1 FROM profiles viewer
            WHERE viewer.id = auth.uid()
            AND viewer.role IN ('teacher', 'principal', 'principal_admin', 'super_admin')
            AND (
                COALESCE(viewer.organization_id, viewer.preschool_id) = COALESCE(profiles.organization_id, profiles.preschool_id)
                OR viewer.role = 'super_admin'
            )
        )
    );

-- Policy: Allow parents to view other parent profiles at schools where their children attend
DROP POLICY IF EXISTS "profiles_parents_view_school_parents" ON profiles;

CREATE POLICY "profiles_parents_view_school_parents" ON profiles
    FOR SELECT
    USING (
        -- Target profile is a parent at a school where requesting user's child attends
        EXISTS (
            SELECT 1 FROM students my_child
            JOIN students target_child ON target_child.preschool_id = my_child.preschool_id
            WHERE (my_child.parent_id = auth.uid() OR my_child.guardian_id = auth.uid())
            AND (target_child.parent_id = profiles.id OR target_child.guardian_id = profiles.id)
        )
    );

COMMIT;
