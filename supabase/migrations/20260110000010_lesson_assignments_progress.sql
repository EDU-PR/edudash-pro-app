-- Lesson Assignments and Progress Tracking Tables
-- Created for the complete aftercare teaching system

-- ================================================================
-- LESSON ASSIGNMENTS TABLE
-- Tracks which lessons are assigned to which students/classes
-- ================================================================
CREATE TABLE IF NOT EXISTS lesson_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'assigned' 
    CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- At least one of student_id or class_id must be set
  CONSTRAINT lesson_assignment_target CHECK (student_id IS NOT NULL OR class_id IS NOT NULL)
);

-- ================================================================
-- LESSON COMPLETIONS TABLE
-- Tracks student completion of assigned lessons
-- ================================================================
CREATE TABLE IF NOT EXISTS lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES lesson_assignments(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  time_spent_minutes INTEGER,
  score DECIMAL(5,2),
  feedback JSONB DEFAULT '{}',
  teacher_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'needs_review', 'reviewed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- ACTIVITY PROGRESS TABLE
-- Tracks student progress on individual activities within lessons
-- ================================================================
CREATE TABLE IF NOT EXISTS activity_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES lesson_activities(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score DECIMAL(5,2),
  attempts INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  progress_data JSONB DEFAULT '{}', -- Stores activity-specific progress data
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (activity_id, student_id)
);

-- ================================================================
-- STUDENT PROGRESS SUMMARY TABLE
-- Aggregated progress data for quick access
-- ================================================================
CREATE TABLE IF NOT EXISTS student_progress_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'term', 'annual')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- Lesson stats
  lessons_assigned INTEGER DEFAULT 0,
  lessons_completed INTEGER DEFAULT 0,
  lessons_in_progress INTEGER DEFAULT 0,
  -- Activity stats
  activities_completed INTEGER DEFAULT 0,
  activities_attempted INTEGER DEFAULT 0,
  -- Time stats
  total_time_spent_minutes INTEGER DEFAULT 0,
  average_score DECIMAL(5,2),
  -- Engagement metrics
  streak_days INTEGER DEFAULT 0,
  badges_earned JSONB DEFAULT '[]',
  strengths JSONB DEFAULT '[]',
  areas_for_improvement JSONB DEFAULT '[]',
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, period_type, period_start)
);

-- ================================================================
-- TEACHER APPROVAL STATUS TRACKING
-- For pending teacher approvals after invitation acceptance
-- ================================================================
CREATE TABLE IF NOT EXISTS teacher_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES teacher_invites(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  seat_assigned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (teacher_id, preschool_id)
);

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_student ON lesson_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_class ON lesson_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_preschool ON lesson_assignments(preschool_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_status ON lesson_assignments(status);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_due_date ON lesson_assignments(due_date);

CREATE INDEX IF NOT EXISTS idx_lesson_completions_student ON lesson_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson ON lesson_completions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_preschool ON lesson_completions(preschool_id);

CREATE INDEX IF NOT EXISTS idx_activity_progress_student ON activity_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_activity ON activity_progress(activity_id);

CREATE INDEX IF NOT EXISTS idx_student_progress_summary_student ON student_progress_summary(student_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_summary_period ON student_progress_summary(period_type, period_start);

CREATE INDEX IF NOT EXISTS idx_teacher_approvals_preschool ON teacher_approvals(preschool_id);
CREATE INDEX IF NOT EXISTS idx_teacher_approvals_status ON teacher_approvals(status);

-- ================================================================
-- RLS POLICIES
-- ================================================================

-- Enable RLS on all new tables
ALTER TABLE lesson_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_approvals ENABLE ROW LEVEL SECURITY;

-- Lesson Assignments: Teachers and principals can manage for their school
CREATE POLICY "teachers_manage_lesson_assignments" ON lesson_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = lesson_assignments.preschool_id
    )
  );

-- Lesson Assignments: Parents can view their children's assignments
CREATE POLICY "parents_view_child_assignments" ON lesson_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_assignments.student_id
      AND s.parent_id = auth.uid()
    )
  );

-- Lesson Completions: Teachers and principals can manage for their school
CREATE POLICY "teachers_manage_lesson_completions" ON lesson_completions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = lesson_completions.preschool_id
    )
  );

-- Lesson Completions: Parents can view their children's completions
CREATE POLICY "parents_view_child_completions" ON lesson_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_completions.student_id
      AND s.parent_id = auth.uid()
    )
  );

-- Activity Progress: Teachers and principals can manage for their school
CREATE POLICY "teachers_manage_activity_progress" ON activity_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = activity_progress.preschool_id
    )
  );

-- Activity Progress: Parents can view their children's progress
CREATE POLICY "parents_view_child_activity_progress" ON activity_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = activity_progress.student_id
      AND s.parent_id = auth.uid()
    )
  );

-- Student Progress Summary: Teachers and principals can manage for their school
CREATE POLICY "teachers_manage_progress_summary" ON student_progress_summary
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_progress_summary.preschool_id
    )
  );

-- Student Progress Summary: Parents can view their children's summary
CREATE POLICY "parents_view_child_progress_summary" ON student_progress_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_progress_summary.student_id
      AND s.parent_id = auth.uid()
    )
  );

-- Teacher Approvals: Principals can manage for their school
CREATE POLICY "principals_manage_teacher_approvals" ON teacher_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = teacher_approvals.preschool_id
    )
  );

-- Teacher Approvals: Teachers can view their own approval status
CREATE POLICY "teachers_view_own_approval" ON teacher_approvals
  FOR SELECT USING (teacher_id = auth.uid());

-- ================================================================
-- TRIGGERS FOR UPDATED_AT
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lesson_assignments_updated_at
  BEFORE UPDATE ON lesson_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_completions_updated_at
  BEFORE UPDATE ON lesson_completions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activity_progress_updated_at
  BEFORE UPDATE ON activity_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_progress_summary_updated_at
  BEFORE UPDATE ON student_progress_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teacher_approvals_updated_at
  BEFORE UPDATE ON teacher_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- FUNCTION: Auto-update assignment status when lesson completed
-- ================================================================
CREATE OR REPLACE FUNCTION update_assignment_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the assignment status to completed when a completion record is inserted
  UPDATE lesson_assignments
  SET status = 'completed', updated_at = NOW()
  WHERE id = NEW.assignment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_assignment_on_completion
  AFTER INSERT ON lesson_completions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION update_assignment_on_completion();

-- ================================================================
-- GRANTS
-- ================================================================
GRANT ALL ON lesson_assignments TO authenticated;
GRANT ALL ON lesson_completions TO authenticated;
GRANT ALL ON activity_progress TO authenticated;
GRANT ALL ON student_progress_summary TO authenticated;
GRANT ALL ON teacher_approvals TO authenticated;
