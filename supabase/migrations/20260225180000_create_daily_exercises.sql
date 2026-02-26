-- Daily exercise configuration (one per student)
CREATE TABLE IF NOT EXISTS daily_exercise_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  parent_id UUID NOT NULL,
  organization_id UUID,
  grade TEXT NOT NULL,
  core_subjects TEXT[] NOT NULL DEFAULT '{mathematics,english_hl}',
  optional_subjects TEXT[] DEFAULT '{}',
  questions_per_subject INT NOT NULL DEFAULT 5,
  difficulty TEXT NOT NULL DEFAULT 'adaptive' CHECK (difficulty IN ('easy','medium','hard','adaptive')),
  alert_enabled BOOLEAN DEFAULT TRUE,
  alert_time TIME DEFAULT '15:00',
  alert_days INT[] DEFAULT '{1,2,3,4,5}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily exercise instances (generated each day)
CREATE TABLE IF NOT EXISTS daily_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES daily_exercise_configs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  exercise_date DATE NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  score NUMERIC(5,2),
  correct_count INT DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 5,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  time_spent_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress tracking
CREATE TABLE IF NOT EXISTS daily_exercise_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  total_days_completed INT DEFAULT 0,
  total_questions_answered INT DEFAULT 0,
  total_correct INT DEFAULT 0,
  average_score NUMERIC(5,2) DEFAULT 0,
  subject_scores JSONB DEFAULT '{}',
  last_completed_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_daily_exercise_configs_student ON daily_exercise_configs(student_id);
CREATE INDEX idx_daily_exercises_student_date ON daily_exercises(student_id, exercise_date);
CREATE INDEX idx_daily_exercises_config_date ON daily_exercises(config_id, exercise_date);
CREATE INDEX idx_daily_exercise_progress_student ON daily_exercise_progress(student_id);

-- RLS
ALTER TABLE daily_exercise_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_exercise_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents manage own children configs" ON daily_exercise_configs
  FOR ALL USING (parent_id = auth.uid());
CREATE POLICY "Parents view own children exercises" ON daily_exercises
  FOR ALL USING (student_id IN (
    SELECT student_id FROM daily_exercise_configs WHERE parent_id = auth.uid()
  ));
CREATE POLICY "Parents view own children progress" ON daily_exercise_progress
  FOR SELECT USING (student_id IN (
    SELECT student_id FROM daily_exercise_configs WHERE parent_id = auth.uid()
  ));
