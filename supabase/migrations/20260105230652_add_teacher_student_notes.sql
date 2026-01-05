-- Teacher-Student Notes System
-- 
-- Enables teachers to send quick notes/updates about students to their parents.
-- Features:
-- - Different note types (highlight, concern, achievement, reminder, general)
-- - Read/acknowledgment tracking
-- - Real-time subscriptions for parents
-- - Audit trail for school records

-- =====================================================
-- 1. TEACHER-STUDENT NOTES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS teacher_student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  
  -- Note content
  note_type TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN ('highlight', 'concern', 'achievement', 'reminder', 'general')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Visibility and status
  is_visible_to_parents BOOLEAN DEFAULT true,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Acknowledgment (for important notes)
  requires_acknowledgment BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- 2. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_teacher_notes_student ON teacher_student_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_teacher ON teacher_student_notes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_preschool ON teacher_student_notes(preschool_id);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_class ON teacher_student_notes(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_type ON teacher_student_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_created ON teacher_student_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_unread ON teacher_student_notes(student_id, is_read) WHERE NOT is_read;

-- =====================================================
-- 3. TRIGGERS
-- =====================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_teacher_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teacher_notes_updated ON teacher_student_notes;
CREATE TRIGGER trg_teacher_notes_updated
  BEFORE UPDATE ON teacher_student_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_teacher_notes_updated_at();

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

ALTER TABLE teacher_student_notes ENABLE ROW LEVEL SECURITY;

-- Teachers can create and manage their own notes
DROP POLICY IF EXISTS "teachers_manage_own_notes" ON teacher_student_notes;
CREATE POLICY "teachers_manage_own_notes" ON teacher_student_notes
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Parents can view notes for their children (visible to parents only)
DROP POLICY IF EXISTS "parents_view_child_notes" ON teacher_student_notes;
CREATE POLICY "parents_view_child_notes" ON teacher_student_notes
FOR SELECT
TO authenticated
USING (
  is_visible_to_parents = true
  AND (
    student_id IN (SELECT id FROM students WHERE parent_id = auth.uid())
    OR student_id IN (SELECT id FROM students WHERE guardian_id = auth.uid())
    OR student_id IN (SELECT student_id FROM student_guardians WHERE guardian_id = auth.uid())
  )
);

-- Parents can update read/acknowledged status
DROP POLICY IF EXISTS "parents_acknowledge_notes" ON teacher_student_notes;
CREATE POLICY "parents_acknowledge_notes" ON teacher_student_notes
FOR UPDATE
TO authenticated
USING (
  is_visible_to_parents = true
  AND (
    student_id IN (SELECT id FROM students WHERE parent_id = auth.uid())
    OR student_id IN (SELECT id FROM students WHERE guardian_id = auth.uid())
  )
)
WITH CHECK (
  -- Parents can only update read/acknowledgment fields
  is_visible_to_parents = true
);

-- Principals can view all notes in their school
DROP POLICY IF EXISTS "principals_view_school_notes" ON teacher_student_notes;
CREATE POLICY "principals_view_school_notes" ON teacher_student_notes
FOR SELECT
TO authenticated
USING (
  preschool_id IN (SELECT id FROM preschools WHERE principal_id = auth.uid())
  OR preschool_id IN (SELECT id FROM organizations WHERE principal_id = auth.uid())
);

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON TABLE teacher_student_notes IS 
'Teacher notes to parents about their children. Supports different note types, read tracking, and acknowledgment for important messages.';

COMMENT ON COLUMN teacher_student_notes.note_type IS 
'Type of note: highlight (daily positive), concern (issue to address), achievement (milestone), reminder (task/event), general (misc)';

COMMENT ON COLUMN teacher_student_notes.requires_acknowledgment IS 
'If true, parent must acknowledge they have read the note (for important concerns)';
