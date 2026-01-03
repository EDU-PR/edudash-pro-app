-- ============================================================================
-- Preschool Teaching Enhancement Migration
-- Date: 2026-01-03
-- Purpose: Add gamification, daily activities, and interactive features
--   for preschool teaching workflow
-- ============================================================================

-- ============================================================================
-- SECTION 1: Student Achievements & Gamification
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  
  -- Achievement type
  achievement_type TEXT NOT NULL CHECK (achievement_type IN (
    'star', 'badge', 'sticker', 'streak', 'certificate', 'level_up', 'milestone'
  )),
  achievement_name TEXT NOT NULL,
  achievement_icon TEXT, -- emoji or icon name
  achievement_color TEXT, -- hex color
  
  -- Context
  category TEXT, -- 'reading', 'math', 'art', 'behavior', 'attendance', 'homework'
  related_activity_id UUID,
  related_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  
  -- Points/value
  points INTEGER DEFAULT 1,
  level INTEGER DEFAULT 1,
  
  -- Metadata
  description TEXT,
  awarded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_achievements_student ON student_achievements(student_id);
CREATE INDEX idx_achievements_preschool ON student_achievements(preschool_id);
CREATE INDEX idx_achievements_type ON student_achievements(achievement_type);
CREATE INDEX idx_achievements_category ON student_achievements(category);
CREATE INDEX idx_achievements_earned ON student_achievements(earned_at DESC);

COMMENT ON TABLE student_achievements IS 'Gamification: stars, badges, stickers earned by students';

-- Enable RLS
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "achievements_select" ON student_achievements;
CREATE POLICY "achievements_select" ON student_achievements
  FOR SELECT USING (
    -- Student's parent can view
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = student_achievements.student_id 
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
    OR
    -- Teachers at same school can view
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = student_achievements.preschool_id
      AND p.role IN ('teacher', 'principal')
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "achievements_insert" ON student_achievements;
CREATE POLICY "achievements_insert" ON student_achievements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = student_achievements.preschool_id
      AND p.role IN ('teacher', 'principal')
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- SECTION 2: Student Streaks (Daily Engagement Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  
  -- Streak tracking
  streak_type TEXT NOT NULL CHECK (streak_type IN ('attendance', 'homework', 'activity', 'login')),
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(student_id, streak_type)
);

CREATE INDEX idx_streaks_student ON student_streaks(student_id);
CREATE INDEX idx_streaks_preschool ON student_streaks(preschool_id);

COMMENT ON TABLE student_streaks IS 'Track consecutive day streaks for engagement';

ALTER TABLE student_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "streaks_select" ON student_streaks;
CREATE POLICY "streaks_select" ON student_streaks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = student_streaks.student_id 
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = student_streaks.preschool_id
      AND p.role IN ('teacher', 'principal')
    )
  );

DROP POLICY IF EXISTS "streaks_upsert" ON student_streaks;
CREATE POLICY "streaks_upsert" ON student_streaks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = student_streaks.preschool_id
      AND p.role IN ('teacher', 'principal')
    )
  );

-- ============================================================================
-- SECTION 3: Student Activity Feed (Parent Updates)
-- NOTE: daily_activities table is used for class schedules, so using 
--       student_activity_feed for parent daily updates
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'learning', 'play', 'meal', 'rest', 'special', 'milestone', 
    'outdoor', 'art', 'music', 'story', 'social'
  )),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Media
  media_urls JSONB DEFAULT '[]'::jsonb, -- array of image/video URLs
  
  -- Visibility
  visibility TEXT DEFAULT 'parent_only' CHECK (visibility IN (
    'parent_only', 'class_parents', 'all_parents', 'private'
  )),
  
  -- Timing
  activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  
  -- Engagement
  reactions JSONB DEFAULT '[]'::jsonb, -- [{parent_id, emoji, created_at}]
  
  -- Status
  is_published BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_student ON student_activity_feed(student_id, activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_class ON student_activity_feed(class_id, activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_preschool ON student_activity_feed(preschool_id, activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_teacher ON student_activity_feed(teacher_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_type ON student_activity_feed(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_feed_date ON student_activity_feed(DATE(activity_at));

COMMENT ON TABLE student_activity_feed IS 'Daily activity feed for parents - what children did today';

ALTER TABLE student_activity_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_feed_select" ON student_activity_feed;
CREATE POLICY "activity_feed_select" ON student_activity_feed
  FOR SELECT USING (
    -- Parents can see activities for their children
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = student_activity_feed.student_id 
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
    OR
    -- Teachers/principals at same school
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = student_activity_feed.preschool_id
      AND p.role IN ('teacher', 'principal')
    )
  );

DROP POLICY IF EXISTS "activity_feed_manage" ON student_activity_feed;
CREATE POLICY "activity_feed_manage" ON student_activity_feed
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = student_activity_feed.preschool_id
      AND p.role IN ('teacher', 'principal')
    )
  );

-- ============================================================================
-- SECTION 4: Interactive Activities (Preschool Games)
-- ============================================================================

CREATE TABLE IF NOT EXISTS interactive_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Activity definition
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'matching', 'coloring', 'tracing', 'counting', 'sorting',
    'puzzle', 'memory', 'sequence', 'drawing', 'quiz'
  )),
  title TEXT NOT NULL,
  instructions TEXT,
  
  -- Content
  content JSONB NOT NULL, -- Activity-specific content
  -- Example for matching: {pairs: [{id, image1, image2, text1, text2}]}
  -- Example for coloring: {outlineUrl, colorPalette}
  -- Example for counting: {items: [{image, count}]}
  
  -- Settings
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  age_group_min INTEGER DEFAULT 3,
  age_group_max INTEGER DEFAULT 6,
  time_limit_seconds INTEGER,
  max_attempts INTEGER DEFAULT 3,
  
  -- Reward
  stars_reward INTEGER DEFAULT 1,
  badge_reward TEXT, -- badge name if any
  
  -- Metadata
  subject TEXT, -- 'math', 'language', 'science', 'art', 'social'
  skills JSONB DEFAULT '[]'::jsonb, -- ['fine_motor', 'counting', 'colors']
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_template BOOLEAN DEFAULT false, -- Global template
  
  -- Usage stats
  times_played INTEGER DEFAULT 0,
  avg_score DECIMAL(5,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_interactive_activities_type ON interactive_activities(activity_type);
CREATE INDEX idx_interactive_activities_preschool ON interactive_activities(preschool_id);
CREATE INDEX idx_interactive_activities_difficulty ON interactive_activities(difficulty_level);
CREATE INDEX idx_interactive_activities_age ON interactive_activities(age_group_min, age_group_max);
CREATE INDEX idx_interactive_activities_subject ON interactive_activities(subject);

COMMENT ON TABLE interactive_activities IS 'Interactive preschool activities: matching, coloring, counting games';

ALTER TABLE interactive_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interactive_activities_select" ON interactive_activities;
CREATE POLICY "interactive_activities_select" ON interactive_activities
  FOR SELECT USING (
    -- Templates are public
    is_template = true
    OR
    -- School members can see school activities
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = interactive_activities.preschool_id
    )
    OR
    -- Parents can see activities for their child's school
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.preschool_id = interactive_activities.preschool_id 
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "interactive_activities_insert" ON interactive_activities;
CREATE POLICY "interactive_activities_insert" ON interactive_activities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = interactive_activities.preschool_id
      AND p.role IN ('teacher', 'principal')
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- SECTION 5: Activity Attempts (Student Progress)
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES interactive_activities(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- Attempt details
  attempt_number INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Results
  score INTEGER, -- 0-100
  stars_earned INTEGER DEFAULT 0,
  time_spent_seconds INTEGER,
  
  -- Answers
  answers JSONB, -- Activity-specific answer data
  
  -- Status
  status TEXT DEFAULT 'in_progress' CHECK (status IN (
    'in_progress', 'completed', 'abandoned', 'timed_out'
  )),
  
  -- Feedback
  feedback TEXT, -- AI or teacher feedback
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_attempts_activity ON activity_attempts(activity_id);
CREATE INDEX idx_activity_attempts_student ON activity_attempts(student_id);
CREATE INDEX idx_activity_attempts_status ON activity_attempts(status);
CREATE INDEX idx_activity_attempts_date ON activity_attempts(started_at DESC);

COMMENT ON TABLE activity_attempts IS 'Track student attempts at interactive activities';

ALTER TABLE activity_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_attempts_select" ON activity_attempts;
CREATE POLICY "activity_attempts_select" ON activity_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = activity_attempts.student_id 
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM interactive_activities ia
      JOIN profiles p ON p.preschool_id = ia.preschool_id
      WHERE ia.id = activity_attempts.activity_id
      AND p.id = auth.uid()
      AND p.role IN ('teacher', 'principal')
    )
  );

DROP POLICY IF EXISTS "activity_attempts_insert" ON activity_attempts;
CREATE POLICY "activity_attempts_insert" ON activity_attempts
  FOR INSERT WITH CHECK (
    -- Parents can submit on behalf of children
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = activity_attempts.student_id 
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
    OR
    -- Teachers can record attempts
    EXISTS (
      SELECT 1 FROM interactive_activities ia
      JOIN profiles p ON p.preschool_id = ia.preschool_id
      WHERE ia.id = activity_attempts.activity_id
      AND p.id = auth.uid()
      AND p.role IN ('teacher', 'principal')
    )
  );

DROP POLICY IF EXISTS "activity_attempts_update" ON activity_attempts;
CREATE POLICY "activity_attempts_update" ON activity_attempts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = activity_attempts.student_id 
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM interactive_activities ia
      JOIN profiles p ON p.preschool_id = ia.preschool_id
      WHERE ia.id = activity_attempts.activity_id
      AND p.id = auth.uid()
      AND p.role IN ('teacher', 'principal')
    )
  );

-- ============================================================================
-- SECTION 6: Homework Submissions (Photo-based for Preschool)
-- ============================================================================

-- Add columns to existing homework_submissions if they don't exist
ALTER TABLE homework_submissions
ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'text' CHECK (submission_type IN ('text', 'photo', 'video', 'audio', 'file', 'drawing')),
ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id), -- Parent can submit for child
ADD COLUMN IF NOT EXISTS ai_feedback TEXT,
ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

-- ============================================================================
-- SECTION 7: Helper Functions
-- ============================================================================

-- Function to award achievement to student
CREATE OR REPLACE FUNCTION award_student_achievement(
  p_student_id UUID,
  p_achievement_type TEXT,
  p_achievement_name TEXT,
  p_category TEXT DEFAULT NULL,
  p_points INTEGER DEFAULT 1,
  p_description TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_preschool_id UUID;
  v_achievement_id UUID;
BEGIN
  -- Get student's preschool
  SELECT preschool_id INTO v_preschool_id FROM students WHERE id = p_student_id;
  
  IF v_preschool_id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  
  -- Insert achievement
  INSERT INTO student_achievements (
    student_id, preschool_id, achievement_type, achievement_name,
    category, points, description, achievement_icon, achievement_color,
    awarded_by
  ) VALUES (
    p_student_id, v_preschool_id, p_achievement_type, p_achievement_name,
    p_category, p_points, p_description, p_icon, p_color,
    auth.uid()
  ) RETURNING id INTO v_achievement_id;
  
  RETURN v_achievement_id;
END;
$$;

-- Function to update streak
CREATE OR REPLACE FUNCTION update_student_streak(
  p_student_id UUID,
  p_streak_type TEXT
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_preschool_id UUID;
  v_last_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  -- Get student's preschool
  SELECT preschool_id INTO v_preschool_id FROM students WHERE id = p_student_id;
  
  -- Get current streak data
  SELECT last_activity_date, current_streak, longest_streak 
  INTO v_last_date, v_current_streak, v_longest_streak
  FROM student_streaks 
  WHERE student_id = p_student_id AND streak_type = p_streak_type;
  
  IF NOT FOUND THEN
    -- Create new streak
    INSERT INTO student_streaks (student_id, preschool_id, streak_type, current_streak, longest_streak, last_activity_date)
    VALUES (p_student_id, v_preschool_id, p_streak_type, 1, 1, CURRENT_DATE);
    RETURN 1;
  END IF;
  
  -- Check if streak continues
  IF v_last_date = CURRENT_DATE - 1 THEN
    -- Continue streak
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
  ELSIF v_last_date < CURRENT_DATE - 1 THEN
    -- Reset streak
    v_current_streak := 1;
  END IF;
  -- If same day, don't update
  
  UPDATE student_streaks SET
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_activity_date = CURRENT_DATE,
    updated_at = now()
  WHERE student_id = p_student_id AND streak_type = p_streak_type;
  
  RETURN v_current_streak;
END;
$$;

-- Function to get student's total stars
CREATE OR REPLACE FUNCTION get_student_stars(p_student_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_total
  FROM student_achievements
  WHERE student_id = p_student_id AND achievement_type = 'star';
  
  RETURN v_total;
END;
$$;

-- Function to get student's badges
CREATE OR REPLACE FUNCTION get_student_badges(p_student_id UUID)
RETURNS TABLE (
  badge_name TEXT,
  badge_icon TEXT,
  badge_color TEXT,
  earned_at TIMESTAMPTZ,
  category TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    achievement_name,
    achievement_icon,
    achievement_color,
    student_achievements.earned_at,
    student_achievements.category
  FROM student_achievements
  WHERE student_id = p_student_id 
  AND achievement_type = 'badge'
  ORDER BY earned_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION award_student_achievement(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_student_streak(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_stars(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_badges(UUID) TO authenticated;

-- ============================================================================
-- SECTION 8: Seed Default Activity Templates
-- ============================================================================

INSERT INTO interactive_activities (
  activity_type, title, instructions, content, difficulty_level,
  age_group_min, age_group_max, stars_reward, subject, skills,
  is_template, is_active
) VALUES 
-- Matching Games
(
  'matching', 'Animal Match', 'Match the animals with their sounds!',
  '{"pairs": [
    {"id": "1", "image1": "🐕", "text2": "Woof!"},
    {"id": "2", "image1": "🐱", "text2": "Meow!"},
    {"id": "3", "image1": "🐄", "text2": "Moo!"},
    {"id": "4", "image1": "🐷", "text2": "Oink!"}
  ]}'::jsonb,
  1, 3, 5, 2, 'science', '["memory", "animals", "sounds"]'::jsonb, true, true
),
(
  'matching', 'Color Match', 'Match the objects with their colors!',
  '{"pairs": [
    {"id": "1", "image1": "🍎", "text2": "Red"},
    {"id": "2", "image1": "🍌", "text2": "Yellow"},
    {"id": "3", "image1": "🥬", "text2": "Green"},
    {"id": "4", "image1": "🍇", "text2": "Purple"}
  ]}'::jsonb,
  1, 3, 5, 2, 'art', '["colors", "vocabulary", "matching"]'::jsonb, true, true
),
-- Counting Games
(
  'counting', 'Count the Animals', 'How many animals do you see?',
  '{"items": [
    {"image": "🐕🐕🐕", "count": 3},
    {"image": "🐱🐱", "count": 2},
    {"image": "🐦🐦🐦🐦", "count": 4},
    {"image": "🐟", "count": 1}
  ]}'::jsonb,
  1, 3, 5, 3, 'math', '["counting", "numbers", "animals"]'::jsonb, true, true
),
(
  'counting', 'Count the Shapes', 'Count the shapes in each picture!',
  '{"items": [
    {"image": "🔴🔴🔴🔴🔴", "count": 5},
    {"image": "🟡🟡🟡", "count": 3},
    {"image": "🟢🟢🟢🟢🟢🟢", "count": 6},
    {"image": "🔵🔵", "count": 2}
  ]}'::jsonb,
  2, 4, 6, 3, 'math', '["counting", "shapes", "colors"]'::jsonb, true, true
),
-- Sorting Games
(
  'sorting', 'Sort by Size', 'Put the items in order from smallest to biggest!',
  '{"items": ["🐁", "🐱", "🐕", "🐘"], "correct_order": [0, 1, 2, 3]}'::jsonb,
  1, 3, 5, 2, 'math', '["sorting", "size", "comparison"]'::jsonb, true, true
),
-- Sequence Games
(
  'sequence', 'Daily Routine', 'Put the activities in the right order!',
  '{"items": [
    {"id": "1", "image": "🌅", "text": "Wake up"},
    {"id": "2", "image": "🪥", "text": "Brush teeth"},
    {"id": "3", "image": "🥣", "text": "Eat breakfast"},
    {"id": "4", "image": "🏫", "text": "Go to school"}
  ], "correct_order": ["1", "2", "3", "4"]}'::jsonb,
  2, 4, 6, 3, 'social', '["sequence", "routine", "daily_life"]'::jsonb, true, true
)
ON CONFLICT DO NOTHING;

SELECT 'Preschool teaching enhancement migration completed!' as result;
