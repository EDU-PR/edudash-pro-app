-- ============================================================================
-- Update create_class_group and create_parent_group to respect
-- group_creator_auto_add_as_admin setting
-- ============================================================================
-- When the setting is true (default): teachers who create groups are
-- automatically added as admins.
-- When false: only the class teacher (for class groups) is added; the
-- creating teacher is not added when they create a group for another class.
-- Principals/admins are always added when they create (they need group access).
-- ============================================================================

-- Helper: resolve profile role and whether creator is staff (principal/admin always added)
-- p_created_by is auth.uid(); profiles may key by id or auth_user_id

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
  v_creator_role TEXT;
  v_auto_add_creator BOOLEAN := true;
BEGIN
  -- Get creator role (support both profiles.id and profiles.auth_user_id)
  SELECT role INTO v_creator_role
  FROM profiles
  WHERE id = p_created_by OR auth_user_id = p_created_by
  LIMIT 1;

  -- Read org setting: when teachers create groups, auto-add them as admin
  SELECT COALESCE(ps.group_creator_auto_add_as_admin, true) INTO v_auto_add_creator
  FROM preschool_settings ps
  WHERE ps.preschool_id = p_preschool_id
  LIMIT 1;

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
    v_creator_role
  )
  RETURNING id INTO v_thread_id;

  -- Add class teacher as admin
  IF v_teacher_id IS NOT NULL THEN
    INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
    VALUES (v_thread_id, v_teacher_id, 'teacher', TRUE, TRUE)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  -- Add creator as admin: always when principal/admin; when teacher, only if setting is on
  IF (p_created_by != v_teacher_id OR v_teacher_id IS NULL) THEN
    IF v_creator_role IN ('principal', 'admin', 'principal_admin', 'super_admin') THEN
      -- Principals/admins always added
      INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
      VALUES (v_thread_id, p_created_by, COALESCE(v_creator_role, 'teacher'), TRUE, TRUE)
      ON CONFLICT (thread_id, user_id) DO NOTHING;
    ELSIF v_auto_add_creator THEN
      -- Teacher creator: add when setting is true
      INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
      VALUES (v_thread_id, p_created_by, COALESCE(v_creator_role, 'teacher'), TRUE, TRUE)
      ON CONFLICT (thread_id, user_id) DO NOTHING;
    END IF;
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

-- create_parent_group: creator is always added (they need to manage the group they created)
-- The setting only affects create_class_group.
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
  SELECT role INTO v_creator_role
  FROM profiles
  WHERE id = p_created_by OR auth_user_id = p_created_by
  LIMIT 1;

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

  -- Add creator as admin (always - they created the group and need to manage it)
  INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
  VALUES (v_thread_id, p_created_by, v_creator_role, TRUE, TRUE)
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  -- Add parents as members
  IF p_parent_ids IS NOT NULL AND array_length(p_parent_ids, 1) > 0 THEN
    INSERT INTO message_participants (thread_id, user_id, role, is_admin, can_send_messages)
    SELECT v_thread_id, unnest(p_parent_ids), 'parent', FALSE, p_allow_replies
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  RETURN v_thread_id;
END;
$$;
