DO $do$
BEGIN
  IF to_regclass('public.message_threads') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.message_participants') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.messages') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.classes') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.students') IS NULL THEN
    RETURN;
  END IF;

-- =========================================================================
-- Migration: Add Group Messaging Support
-- Description: Enhances message_threads table to support group chats,
--              class groups, parent groups, and broadcast announcements
-- Author: Copilot
-- Date: 2026-01-13
-- =========================================================================

-- Add group-related columns to message_threads
ALTER TABLE message_threads
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS group_description TEXT,
ADD COLUMN IF NOT EXISTS group_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS group_type TEXT CHECK (group_type IN (
  'class_group',      -- Auto-created group for a class (all parents + teacher)
  'parent_group',     -- Custom group of parents created by principal/teacher
  'teacher_group',    -- Group of teachers only
  'announcement',     -- One-way broadcast channel
  'custom'           -- Custom group with mixed roles
)),
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS allow_replies BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_by_role TEXT;

-- Add role column to message_participants if not exists
ALTER TABLE message_participants
ADD COLUMN IF NOT EXISTS can_send_messages BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_message_threads_is_group ON message_threads(is_group) WHERE is_group = TRUE;
CREATE INDEX IF NOT EXISTS idx_message_threads_group_type ON message_threads(group_type) WHERE group_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_threads_class_id ON message_threads(class_id) WHERE class_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN message_threads.is_group IS 'Whether this thread is a group chat (multiple participants beyond 2)';
COMMENT ON COLUMN message_threads.group_name IS 'Display name for group chats';
COMMENT ON COLUMN message_threads.group_type IS 'Type of group: class_group, parent_group, teacher_group, announcement, custom';
COMMENT ON COLUMN message_threads.class_id IS 'Reference to class for class_group type threads';
COMMENT ON COLUMN message_threads.allow_replies IS 'Whether participants can reply (false for announcement-only channels)';
COMMENT ON COLUMN message_threads.created_by_role IS 'Role of the user who created this thread';

COMMENT ON COLUMN message_participants.can_send_messages IS 'Whether this participant can send messages in the thread';
COMMENT ON COLUMN message_participants.is_admin IS 'Whether this participant is an admin of the group';

-- =========================================================================
-- Function to create a class group for all parents and teacher
-- =========================================================================
CREATE OR REPLACE FUNCTION create_class_group(
  p_class_id UUID,
  p_preschool_id UUID,
  p_created_by UUID,
  p_group_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id UUID;
  v_class_name TEXT;
  v_teacher_id UUID;
  v_parent_ids UUID[];
BEGIN
  -- Get class info
  SELECT name, teacher_id INTO v_class_name, v_teacher_id
  FROM classes
  WHERE id = p_class_id AND preschool_id = p_preschool_id;

  IF v_class_name IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  -- Check if group already exists for this class
  SELECT id INTO v_thread_id
  FROM message_threads
  WHERE class_id = p_class_id AND group_type = 'class_group' AND is_group = TRUE;

  IF v_thread_id IS NOT NULL THEN
    RETURN v_thread_id;
  END IF;

  -- Create the thread
  INSERT INTO message_threads (
    preschool_id,
    created_by,
    subject,
    type,
    is_group,
    group_name,
    group_type,
    class_id,
    created_by_role
  )
  VALUES (
    p_preschool_id,
    p_created_by,
    COALESCE(p_group_name, v_class_name || ' Parents'),
    'class_group',
    TRUE,
    COALESCE(p_group_name, v_class_name || ' Parents'),
    'class_group',
    p_class_id,
    (SELECT role FROM profiles WHERE id = p_created_by)
  )
  RETURNING id INTO v_thread_id;

  -- Add teacher as admin
  IF v_teacher_id IS NOT NULL THEN
    INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
    VALUES (v_thread_id, v_teacher_id, 'teacher', TRUE, TRUE)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  -- Add creator as admin if different from teacher
  IF p_created_by != v_teacher_id OR v_teacher_id IS NULL THEN
    INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
    VALUES (v_thread_id, p_created_by, (SELECT role FROM profiles WHERE id = p_created_by), TRUE, TRUE)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  -- Get all parent IDs for students in this class
  SELECT ARRAY_AGG(DISTINCT guardian_id) INTO v_parent_ids
  FROM students
  WHERE class_id = p_class_id
    AND guardian_id IS NOT NULL;

  -- Add all parents
  IF v_parent_ids IS NOT NULL THEN
    INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
    SELECT v_thread_id, unnest(v_parent_ids), 'parent', FALSE, TRUE
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  RETURN v_thread_id;
END;
$$;

-- =========================================================================
-- Function to create a custom parent group
-- =========================================================================
CREATE OR REPLACE FUNCTION create_parent_group(
  p_preschool_id UUID,
  p_created_by UUID,
  p_group_name TEXT,
  p_parent_ids UUID[],
  p_description TEXT DEFAULT NULL,
  p_allow_replies BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id UUID;
  v_creator_role TEXT;
BEGIN
  -- Get creator role
  SELECT role INTO v_creator_role FROM profiles WHERE id = p_created_by;

  -- Only principals, teachers, and admins can create parent groups
  IF v_creator_role NOT IN ('principal', 'teacher', 'admin', 'principal_admin') THEN
    RAISE EXCEPTION 'Only school staff can create parent groups';
  END IF;

  -- Create the thread
  INSERT INTO message_threads (
    preschool_id,
    created_by,
    subject,
    type,
    is_group,
    group_name,
    group_description,
    group_type,
    allow_replies,
    created_by_role
  )
  VALUES (
    p_preschool_id,
    p_created_by,
    p_group_name,
    'parent_group',
    TRUE,
    p_group_name,
    p_description,
    'parent_group',
    p_allow_replies,
    v_creator_role
  )
  RETURNING id INTO v_thread_id;

  -- Add creator as admin
  INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
  VALUES (v_thread_id, p_created_by, v_creator_role, TRUE, TRUE);

  -- Add parents as members
  IF p_parent_ids IS NOT NULL AND array_length(p_parent_ids, 1) > 0 THEN
    INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
    SELECT v_thread_id, unnest(p_parent_ids), 'parent', FALSE, p_allow_replies
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  RETURN v_thread_id;
END;
$$;

-- =========================================================================
-- Function to create an announcement channel (one-way broadcast)
-- =========================================================================
CREATE OR REPLACE FUNCTION create_announcement_channel(
  p_preschool_id UUID,
  p_created_by UUID,
  p_channel_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_audience TEXT DEFAULT 'all_parents' -- 'all_parents', 'all_teachers', 'all_staff', 'everyone'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id UUID;
  v_creator_role TEXT;
  v_user_ids UUID[];
BEGIN
  -- Get creator role
  SELECT role INTO v_creator_role FROM profiles WHERE id = p_created_by;

  -- Only principals and admins can create announcement channels
  IF v_creator_role NOT IN ('principal', 'admin', 'principal_admin') THEN
    RAISE EXCEPTION 'Only principals and admins can create announcement channels';
  END IF;

  -- Create the thread
  INSERT INTO message_threads (
    preschool_id,
    created_by,
    subject,
    type,
    is_group,
    group_name,
    group_description,
    group_type,
    allow_replies,
    created_by_role
  )
  VALUES (
    p_preschool_id,
    p_created_by,
    p_channel_name,
    'announcement',
    TRUE,
    p_channel_name,
    p_description,
    'announcement',
    FALSE, -- No replies allowed
    v_creator_role
  )
  RETURNING id INTO v_thread_id;

  -- Add creator as admin (can send)
  INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
  VALUES (v_thread_id, p_created_by, v_creator_role, TRUE, TRUE);

  -- Add all principals/admins as admins (can also send)
  INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
  SELECT v_thread_id, id, role, TRUE, TRUE
  FROM profiles
  WHERE preschool_id = p_preschool_id
    AND role IN ('principal', 'admin', 'principal_admin')
    AND id != p_created_by
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  -- Get audience user IDs
  CASE p_audience
    WHEN 'all_parents' THEN
      SELECT ARRAY_AGG(DISTINCT guardian_id) INTO v_user_ids
      FROM students
      WHERE preschool_id = p_preschool_id AND guardian_id IS NOT NULL;
    WHEN 'all_teachers' THEN
      SELECT ARRAY_AGG(id) INTO v_user_ids
      FROM profiles
      WHERE preschool_id = p_preschool_id AND role = 'teacher';
    WHEN 'all_staff' THEN
      SELECT ARRAY_AGG(id) INTO v_user_ids
      FROM profiles
      WHERE preschool_id = p_preschool_id AND role IN ('teacher', 'admin', 'principal');
    WHEN 'everyone' THEN
      -- Get all staff
      SELECT ARRAY_AGG(id) INTO v_user_ids
      FROM profiles
      WHERE preschool_id = p_preschool_id;
      -- Add parents
      SELECT array_cat(v_user_ids, ARRAY_AGG(DISTINCT guardian_id)) INTO v_user_ids
      FROM students
      WHERE preschool_id = p_preschool_id AND guardian_id IS NOT NULL;
  END CASE;

  -- Add audience as members (read-only)
  IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
    INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
    SELECT v_thread_id, uid, 
           COALESCE((SELECT role FROM profiles WHERE id = uid), 'parent'),
           FALSE, 
           FALSE -- Cannot send messages
    FROM unnest(v_user_ids) AS uid
    WHERE uid NOT IN (
      SELECT user_id FROM message_participants WHERE thread_id = v_thread_id
    )
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  RETURN v_thread_id;
END;
$$;

-- =========================================================================
-- Function to add participants to a group
-- =========================================================================
CREATE OR REPLACE FUNCTION add_group_participants(
  p_thread_id UUID,
  p_user_ids UUID[],
  p_added_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_record RECORD;
  v_is_admin BOOLEAN;
BEGIN
  -- Get thread info
  SELECT * INTO v_thread_record FROM message_threads WHERE id = p_thread_id;
  
  IF v_thread_record.id IS NULL OR v_thread_record.is_group != TRUE THEN
    RAISE EXCEPTION 'Thread not found or not a group';
  END IF;

  -- Check if user is admin of the group
  SELECT is_admin INTO v_is_admin
  FROM message_participants
  WHERE thread_id = p_thread_id AND user_id = p_added_by;

  IF v_is_admin != TRUE THEN
    RAISE EXCEPTION 'Only group admins can add participants';
  END IF;

  -- Add participants
  INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
  SELECT 
    p_thread_id, 
    uid,
    COALESCE((SELECT role FROM profiles WHERE id = uid), 'parent'),
    FALSE,
    v_thread_record.allow_replies
  FROM unnest(p_user_ids) AS uid
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- =========================================================================
-- Function to remove participant from a group
-- =========================================================================
CREATE OR REPLACE FUNCTION remove_group_participant(
  p_thread_id UUID,
  p_user_id UUID,
  p_removed_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if remover is admin
  SELECT is_admin INTO v_is_admin
  FROM message_participants
  WHERE thread_id = p_thread_id AND user_id = p_removed_by;

  IF v_is_admin != TRUE AND p_user_id != p_removed_by THEN
    RAISE EXCEPTION 'Only group admins can remove other participants';
  END IF;

  -- Remove participant
  DELETE FROM message_participants
  WHERE thread_id = p_thread_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- =========================================================================
-- Create unique constraint for message_participants if not exists
-- =========================================================================
IF NOT EXISTS (
  SELECT 1 FROM pg_constraint 
  WHERE conname = 'message_participants_thread_user_unique'
) THEN
  BEGIN
    ALTER TABLE message_participants
    ADD CONSTRAINT message_participants_thread_user_unique UNIQUE (thread_id, user_id);
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Constraint already exists
  END;
END IF;

-- =========================================================================
-- Update RLS policies for group messaging
-- =========================================================================

-- Allow users to see group threads they're participants of
DROP POLICY IF EXISTS "Users can view threads they participate in" ON message_threads;
CREATE POLICY "Users can view threads they participate in" ON message_threads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM message_participants
      WHERE thread_id = message_threads.id
      AND user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- Allow admins to update group thread details
DROP POLICY IF EXISTS "Group admins can update thread details" ON message_threads;
CREATE POLICY "Group admins can update thread details" ON message_threads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM message_participants
      WHERE thread_id = message_threads.id
      AND user_id = auth.uid()
      AND is_admin = TRUE
    )
    OR created_by = auth.uid()
  );

-- Participants can only send messages if allowed
DROP POLICY IF EXISTS "Participants can send messages if allowed" ON messages;
CREATE POLICY "Participants can send messages if allowed" ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM message_participants mp
      JOIN message_threads mt ON mp.thread_id = mt.id
      WHERE mp.thread_id = messages.thread_id
      AND mp.user_id = auth.uid()
      AND (mp.can_send_messages = TRUE OR mp.is_admin = TRUE)
    )
    OR EXISTS (
      SELECT 1 FROM message_threads mt
      WHERE mt.id = messages.thread_id
      AND mt.is_group = FALSE
      AND EXISTS (
        SELECT 1 FROM message_participants
        WHERE thread_id = mt.id AND user_id = auth.uid()
      )
    )
  );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_class_group TO authenticated;
GRANT EXECUTE ON FUNCTION create_parent_group TO authenticated;
GRANT EXECUTE ON FUNCTION create_announcement_channel TO authenticated;
GRANT EXECUTE ON FUNCTION add_group_participants TO authenticated;
GRANT EXECUTE ON FUNCTION remove_group_participant TO authenticated;
END $do$;
