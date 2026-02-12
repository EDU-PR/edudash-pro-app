-- Weekly Program Copilot foundation
-- Adds first-class weekly programs and ordered daily blocks.

CREATE TABLE IF NOT EXISTS weekly_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  theme_id UUID REFERENCES curriculum_themes(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  age_group TEXT DEFAULT '3-6',
  title TEXT,
  summary TEXT,

  generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'published', 'archived')),

  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_programs_unique_scope
  ON weekly_programs (preschool_id, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid), week_start_date);

CREATE INDEX IF NOT EXISTS idx_weekly_programs_school_week
  ON weekly_programs (preschool_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_programs_status
  ON weekly_programs (preschool_id, status);

CREATE TABLE IF NOT EXISTS daily_program_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_program_id UUID NOT NULL REFERENCES weekly_programs(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  block_order INTEGER NOT NULL CHECK (block_order >= 1),
  block_type TEXT NOT NULL DEFAULT 'learning'
    CHECK (
      block_type IN (
        'circle_time',
        'learning',
        'movement',
        'outdoor',
        'meal',
        'nap',
        'assessment',
        'transition',
        'other'
      )
    ),
  title TEXT NOT NULL,
  start_time TIME,
  end_time TIME,

  objectives JSONB NOT NULL DEFAULT '[]',
  materials JSONB NOT NULL DEFAULT '[]',
  transition_cue TEXT,
  notes TEXT,
  parent_tip TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT daily_program_blocks_unique_order UNIQUE (weekly_program_id, day_of_week, block_order)
);

CREATE INDEX IF NOT EXISTS idx_daily_program_blocks_program_day
  ON daily_program_blocks (weekly_program_id, day_of_week, block_order);

CREATE INDEX IF NOT EXISTS idx_daily_program_blocks_school
  ON daily_program_blocks (preschool_id, day_of_week);

ALTER TABLE weekly_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_program_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_staff_view_weekly_programs ON weekly_programs;
CREATE POLICY school_staff_view_weekly_programs
  ON weekly_programs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = weekly_programs.preschool_id
    )
  );

DROP POLICY IF EXISTS school_staff_manage_weekly_programs ON weekly_programs;
CREATE POLICY school_staff_manage_weekly_programs
  ON weekly_programs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = weekly_programs.preschool_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = weekly_programs.preschool_id
    )
  );

DROP POLICY IF EXISTS school_staff_view_daily_program_blocks ON daily_program_blocks;
CREATE POLICY school_staff_view_daily_program_blocks
  ON daily_program_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = daily_program_blocks.preschool_id
    )
  );

DROP POLICY IF EXISTS school_staff_manage_daily_program_blocks ON daily_program_blocks;
CREATE POLICY school_staff_manage_daily_program_blocks
  ON daily_program_blocks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = daily_program_blocks.preschool_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = daily_program_blocks.preschool_id
    )
  );

DROP TRIGGER IF EXISTS update_weekly_programs_updated_at ON weekly_programs;
CREATE TRIGGER update_weekly_programs_updated_at
  BEFORE UPDATE ON weekly_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_program_blocks_updated_at ON daily_program_blocks;
CREATE TRIGGER update_daily_program_blocks_updated_at
  BEFORE UPDATE ON daily_program_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT ALL ON weekly_programs TO authenticated;
GRANT ALL ON daily_program_blocks TO authenticated;
