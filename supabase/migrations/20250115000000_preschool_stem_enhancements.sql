-- Preschool STEM Dashboard Enhancements Migration
-- Adds STEM integration support, progress tracking, and principal control settings
-- Date: 2025-01-15

-- ================================================================
-- PART 1: ENHANCE LESSON_ASSIGNMENTS TABLE
-- ================================================================

-- Add STEM-related columns to lesson_assignments if they don't exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lesson_assignments'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'interactive_activities'
  ) THEN
  -- Add lesson_type enum column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lesson_assignments' AND column_name = 'lesson_type'
  ) THEN
    ALTER TABLE lesson_assignments 
    ADD COLUMN lesson_type TEXT DEFAULT 'standard' 
    CHECK (lesson_type IN ('standard', 'interactive', 'ai_enhanced', 'robotics', 'computer_literacy'));
  END IF;

  -- Add interactive_activity_id column (will reference interactive_activities table)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lesson_assignments' AND column_name = 'interactive_activity_id'
  ) THEN
    ALTER TABLE lesson_assignments 
    ADD COLUMN interactive_activity_id UUID;
  END IF;

  -- Add stem_category column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lesson_assignments' AND column_name = 'stem_category'
  ) THEN
    ALTER TABLE lesson_assignments 
    ADD COLUMN stem_category TEXT DEFAULT 'none' 
    CHECK (stem_category IN ('ai', 'robotics', 'computer_literacy', 'none'));
  END IF;
  END IF;
END $$;

-- Create index for interactive_activity_id (will be used after table creation)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lesson_assignments'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'interactive_activities'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_lesson_assignments_interactive_activity 
    ON lesson_assignments(interactive_activity_id) 
    WHERE interactive_activity_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_lesson_assignments_stem_category 
    ON lesson_assignments(stem_category);

    CREATE INDEX IF NOT EXISTS idx_lesson_assignments_lesson_type 
    ON lesson_assignments(lesson_type);
  END IF;
END $$;

-- ================================================================
-- PART 2: CREATE INTERACTIVE_ACTIVITIES TABLE
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'preschools'
  ) THEN
CREATE TABLE IF NOT EXISTS interactive_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  activity_type TEXT NOT NULL DEFAULT 'matching'
    CHECK (activity_type IN ('matching', 'coloring', 'tracing', 'counting', 'sorting', 'puzzle', 'memory', 'quiz')),
  content JSONB NOT NULL DEFAULT '{}',
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  time_limit_seconds INTEGER,
  max_attempts INTEGER DEFAULT 3,
  stars_reward INTEGER DEFAULT 3 CHECK (stars_reward BETWEEN 1 AND 5),
  badge_reward TEXT,
  stem_category TEXT DEFAULT 'none' 
    CHECK (stem_category IN ('ai', 'robotics', 'computer_literacy', 'none')),
  age_group TEXT DEFAULT '3-6' 
    CHECK (age_group IN ('1-2', '3-4', '4-5', '5-6', '3-6')),
  is_published BOOLEAN DEFAULT false,
  play_count INTEGER DEFAULT 0,
  average_score DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
  END IF;
END $$;

-- Add foreign key constraint for interactive_activity_id in lesson_assignments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lesson_assignments'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'lesson_assignments_interactive_activity_id_fkey'
    ) THEN
      ALTER TABLE lesson_assignments
      ADD CONSTRAINT lesson_assignments_interactive_activity_id_fkey
      FOREIGN KEY (interactive_activity_id) 
      REFERENCES interactive_activities(id) 
      ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ================================================================
-- PART 3: CREATE STEM_PROGRESS TABLE
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'preschools'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'students'
  ) THEN
CREATE TABLE IF NOT EXISTS stem_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  category TEXT NOT NULL 
    CHECK (category IN ('ai', 'robotics', 'computer_literacy')),
  lessons_completed INTEGER DEFAULT 0,
  activities_completed INTEGER DEFAULT 0,
  homework_submitted INTEGER DEFAULT 0,
  last_activity_date DATE,
  engagement_score DECIMAL(5,2) DEFAULT 0.0 CHECK (engagement_score BETWEEN 0 AND 100),
  streak_days INTEGER DEFAULT 0,
  badges_earned JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, preschool_id, category)
);
  END IF;
END $$;

-- ================================================================
-- PART 4: CREATE PRESCHOOL_SETTINGS TABLE
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'preschools'
  ) THEN
CREATE TABLE IF NOT EXISTS preschool_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL UNIQUE REFERENCES preschools(id) ON DELETE CASCADE,
  enable_ai_program BOOLEAN DEFAULT false,
  enable_robotics_program BOOLEAN DEFAULT false,
  enable_computer_literacy BOOLEAN DEFAULT false,
  require_lesson_approval BOOLEAN DEFAULT false,
  default_homework_due_days INTEGER DEFAULT 7,
  stem_curriculum_version TEXT DEFAULT 'v1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
  END IF;
END $$;

-- ================================================================
-- PART 5: CREATE LESSON_APPROVALS TABLE (for principal control)
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'preschools'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lessons'
  ) THEN
CREATE TABLE IF NOT EXISTS lesson_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  rejection_reason TEXT,
  review_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
  END IF;
END $$;

-- ================================================================
-- PART 6: INDEXES FOR PERFORMANCE
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'interactive_activities'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_interactive_activities_preschool 
    ON interactive_activities(preschool_id);

    CREATE INDEX IF NOT EXISTS idx_interactive_activities_stem_category 
    ON interactive_activities(stem_category);

    CREATE INDEX IF NOT EXISTS idx_interactive_activities_activity_type 
    ON interactive_activities(activity_type);

    CREATE INDEX IF NOT EXISTS idx_interactive_activities_published 
    ON interactive_activities(is_published) 
    WHERE is_published = true;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'stem_progress'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_stem_progress_student 
    ON stem_progress(student_id);

    CREATE INDEX IF NOT EXISTS idx_stem_progress_category 
    ON stem_progress(category);

    CREATE INDEX IF NOT EXISTS idx_stem_progress_preschool_category 
    ON stem_progress(preschool_id, category);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lesson_approvals'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_lesson_approvals_lesson 
    ON lesson_approvals(lesson_id);

    CREATE INDEX IF NOT EXISTS idx_lesson_approvals_status 
    ON lesson_approvals(status);

    CREATE INDEX IF NOT EXISTS idx_lesson_approvals_preschool 
    ON lesson_approvals(preschool_id);
  END IF;
END $$;

-- ================================================================
-- PART 7: RLS POLICIES
-- ================================================================

-- Enable RLS on all new tables
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'interactive_activities'
  ) THEN
    ALTER TABLE interactive_activities ENABLE ROW LEVEL SECURITY;

    -- Interactive Activities: Teachers and principals can manage for their school
    CREATE POLICY "teachers_manage_interactive_activities" ON interactive_activities
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'principal_admin')
          AND COALESCE(p.organization_id, p.preschool_id) = interactive_activities.preschool_id
        )
      );

    -- Interactive Activities: Parents can view published activities for their children's school
    CREATE POLICY "parents_view_interactive_activities" ON interactive_activities
      FOR SELECT USING (
        is_published = true AND
        EXISTS (
          SELECT 1 FROM students s
          JOIN profiles p ON p.id = auth.uid()
          WHERE s.preschool_id = interactive_activities.preschool_id
          AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'stem_progress'
  ) THEN
    ALTER TABLE stem_progress ENABLE ROW LEVEL SECURITY;

    -- STEM Progress: Teachers and principals can manage for their school
    CREATE POLICY "teachers_manage_stem_progress" ON stem_progress
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'principal_admin')
          AND COALESCE(p.organization_id, p.preschool_id) = stem_progress.preschool_id
        )
      );

    -- STEM Progress: Parents can view their children's progress
    CREATE POLICY "parents_view_child_stem_progress" ON stem_progress
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM students s
          WHERE s.id = stem_progress.student_id
          AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'preschool_settings'
  ) THEN
    ALTER TABLE preschool_settings ENABLE ROW LEVEL SECURITY;

    -- Preschool Settings: Only principals can manage
    CREATE POLICY "principals_manage_preschool_settings" ON preschool_settings
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('principal', 'principal_admin')
          AND COALESCE(p.organization_id, p.preschool_id) = preschool_settings.preschool_id
        )
      );

    -- Preschool Settings: Teachers can view
    CREATE POLICY "teachers_view_preschool_settings" ON preschool_settings
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'principal_admin')
          AND COALESCE(p.organization_id, p.preschool_id) = preschool_settings.preschool_id
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lesson_approvals'
  ) THEN
    ALTER TABLE lesson_approvals ENABLE ROW LEVEL SECURITY;

    -- Lesson Approvals: Principals can manage
    CREATE POLICY "principals_manage_lesson_approvals" ON lesson_approvals
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('principal', 'principal_admin')
          AND COALESCE(p.organization_id, p.preschool_id) = lesson_approvals.preschool_id
        )
      );

    -- Lesson Approvals: Teachers can view and submit
    CREATE POLICY "teachers_view_submit_lesson_approvals" ON lesson_approvals
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'principal_admin')
          AND COALESCE(p.organization_id, p.preschool_id) = lesson_approvals.preschool_id
        )
      );

    CREATE POLICY "teachers_insert_lesson_approvals" ON lesson_approvals
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'principal_admin')
          AND COALESCE(p.organization_id, p.preschool_id) = lesson_approvals.preschool_id
        )
      );
  END IF;
END $$;

-- ================================================================
-- PART 8: TRIGGERS FOR UPDATED_AT
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'interactive_activities'
  ) THEN
    CREATE TRIGGER update_interactive_activities_updated_at
      BEFORE UPDATE ON interactive_activities
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'stem_progress'
  ) THEN
    CREATE TRIGGER update_stem_progress_updated_at
      BEFORE UPDATE ON stem_progress
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'preschool_settings'
  ) THEN
    CREATE TRIGGER update_preschool_settings_updated_at
      BEFORE UPDATE ON preschool_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lesson_approvals'
  ) THEN
    CREATE TRIGGER update_lesson_approvals_updated_at
      BEFORE UPDATE ON lesson_approvals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ================================================================
-- PART 9: FUNCTIONS FOR AUTOMATIC UPDATES
-- ================================================================

-- Function to update STEM progress when lesson is completed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lesson_assignments'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'stem_progress'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lesson_completions'
  ) THEN
    CREATE OR REPLACE FUNCTION update_stem_progress_on_completion()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Only update if lesson has STEM category
      IF EXISTS (
        SELECT 1 FROM lesson_assignments la
        WHERE la.id = NEW.assignment_id
        AND la.stem_category != 'none'
      ) THEN
        INSERT INTO stem_progress (
          student_id, 
          preschool_id, 
          category, 
          lessons_completed,
          last_activity_date
        )
        SELECT 
          NEW.student_id,
          NEW.preschool_id,
          la.stem_category,
          1,
          CURRENT_DATE
        FROM lesson_assignments la
        WHERE la.id = NEW.assignment_id
        AND la.stem_category != 'none'
        ON CONFLICT (student_id, preschool_id, category)
        DO UPDATE SET
          lessons_completed = stem_progress.lessons_completed + 1,
          last_activity_date = CURRENT_DATE,
          updated_at = NOW();
      END IF;
      
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    -- Trigger to update STEM progress on lesson completion
    DROP TRIGGER IF EXISTS trigger_update_stem_progress_on_completion ON lesson_completions;
    CREATE TRIGGER trigger_update_stem_progress_on_completion
      AFTER INSERT ON lesson_completions
      FOR EACH ROW
      WHEN (NEW.status = 'completed')
      EXECUTE FUNCTION update_stem_progress_on_completion();
  END IF;
END $$;

-- Function to increment interactive activity play count
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'interactive_activities'
  ) THEN
    CREATE OR REPLACE FUNCTION increment_activity_play_count(activity_uuid UUID)
    RETURNS void AS $increment$
    BEGIN
      UPDATE interactive_activities
      SET play_count = play_count + 1,
          updated_at = NOW()
      WHERE id = activity_uuid;
    END;
    $increment$ LANGUAGE plpgsql;
  END IF;
END $$;

-- ================================================================
-- PART 10: GRANTS
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'interactive_activities'
  ) THEN
    GRANT ALL ON interactive_activities TO authenticated;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'stem_progress'
  ) THEN
    GRANT ALL ON stem_progress TO authenticated;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'preschool_settings'
  ) THEN
    GRANT ALL ON preschool_settings TO authenticated;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lesson_approvals'
  ) THEN
    GRANT ALL ON lesson_approvals TO authenticated;
  END IF;
END $$;

-- ================================================================
-- PART 11: INITIAL DATA - Create default settings for existing preschools
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'preschool_settings'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'preschools'
  ) THEN
    INSERT INTO preschool_settings (preschool_id, enable_ai_program, enable_robotics_program, enable_computer_literacy)
    SELECT id, false, false, false
    FROM preschools
    WHERE id NOT IN (SELECT preschool_id FROM preschool_settings)
    ON CONFLICT (preschool_id) DO NOTHING;
  END IF;
END $$;
