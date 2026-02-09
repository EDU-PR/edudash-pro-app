-- ============================================
-- Quiz & Interactive Learning System
-- Phase 3.1: Dash AI Interactive Learning
-- ============================================

-- Learning progress per user per subject/topic
CREATE TABLE IF NOT EXISTS dash_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  grade_level TEXT,
  skill_level TEXT NOT NULL DEFAULT 'beginner'
    CHECK (skill_level IN ('beginner', 'developing', 'proficient', 'advanced', 'mastery')),
  mastery_score NUMERIC(5,2) DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
  total_attempts INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  incorrect_count INT DEFAULT 0,
  streak_current INT DEFAULT 0,
  streak_best INT DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subject, topic)
);

-- AI-generated quiz questions
CREATE TABLE IF NOT EXISTS dash_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard', 'challenge')),
  question_type TEXT NOT NULL
    CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank', 'matching')),
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,       -- For multiple_choice: [{label, value}], matching: [{left, right}]
  explanation TEXT,                          -- Why the answer is correct
  hints JSONB DEFAULT '[]'::jsonb,          -- Progressive hints
  caps_aligned BOOLEAN DEFAULT false,       -- South African CAPS curriculum aligned
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}'::jsonb,       -- Extra context (images, audio refs, etc.)
  usage_count INT DEFAULT 0,
  avg_correct_rate NUMERIC(5,2) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quiz sessions (a user taking a quiz)
CREATE TABLE IF NOT EXISTS dash_quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  grade_level TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  question_ids UUID[] NOT NULL DEFAULT '{}',
  current_question_index INT DEFAULT 0,
  score NUMERIC(5,2) DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  correct_answers INT DEFAULT 0,
  incorrect_answers INT DEFAULT 0,
  hints_used INT DEFAULT 0,
  time_spent_seconds INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned', 'timed_out')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Individual answers within a session
CREATE TABLE IF NOT EXISTS dash_quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES dash_quiz_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES dash_quiz_questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  hints_used INT DEFAULT 0,
  time_taken_seconds INT DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT now()
);

-- Achievement/badge definitions
CREATE TABLE IF NOT EXISTS dash_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'star',
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('quiz_mastery', 'streak', 'exploration', 'speed', 'general')),
  requirement_type TEXT NOT NULL
    CHECK (requirement_type IN ('quiz_score', 'streak_days', 'topics_mastered', 'questions_answered', 'perfect_quiz', 'speed_run')),
  requirement_value INT NOT NULL,                      -- e.g., 10 for "Answer 10 questions"
  requirement_subject TEXT DEFAULT NULL,                -- NULL = any subject
  tier TEXT NOT NULL DEFAULT 'bronze'
    CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  xp_reward INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User earned achievements
CREATE TABLE IF NOT EXISTS dash_user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES dash_achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, achievement_id)
);

-- Spaced repetition schedule (SM-2 algorithm)
CREATE TABLE IF NOT EXISTS dash_review_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES dash_quiz_questions(id) ON DELETE CASCADE,
  ease_factor NUMERIC(4,2) DEFAULT 2.50,
  repetitions INT DEFAULT 0,
  interval_days INT DEFAULT 1,
  next_review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMPTZ,
  quality_history INT[] DEFAULT '{}',      -- SM-2 quality scores (0-5)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_learning_progress_user
  ON dash_learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_subject
  ON dash_learning_progress(subject, topic);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_subject
  ON dash_quiz_questions(subject, topic, grade_level);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_difficulty
  ON dash_quiz_questions(difficulty, question_type);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user
  ON dash_quiz_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_session
  ON dash_quiz_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_review_schedule_due
  ON dash_review_schedule(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON dash_user_achievements(user_id);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE dash_learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE dash_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dash_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dash_quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dash_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dash_user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dash_review_schedule ENABLE ROW LEVEL SECURITY;

-- Learning progress: users see their own, teachers see org members
CREATE POLICY "Users view own learning progress"
  ON dash_learning_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own learning progress"
  ON dash_learning_progress FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers view org learning progress"
  ON dash_learning_progress FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('teacher', 'principal_admin')
    )
  );

-- Quiz questions: read by anyone in org, write by teachers/admins
CREATE POLICY "Read quiz questions in org"
  ON dash_quiz_questions FOR SELECT
  USING (
    organization_id IS NULL OR
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers create quiz questions"
  ON dash_quiz_questions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
  );

-- Quiz sessions: users see their own
CREATE POLICY "Users manage own quiz sessions"
  ON dash_quiz_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers view org quiz sessions"
  ON dash_quiz_sessions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('teacher', 'principal_admin')
    )
  );

-- Quiz answers: accessible through session ownership
CREATE POLICY "Users manage own quiz answers"
  ON dash_quiz_answers FOR ALL
  USING (
    session_id IN (
      SELECT id FROM dash_quiz_sessions WHERE user_id = auth.uid()
    )
  );

-- Achievements: readable by all, admin-managed
CREATE POLICY "Anyone can read achievements"
  ON dash_achievements FOR SELECT
  USING (true);

-- User achievements: users see their own
CREATE POLICY "Users view own achievements"
  ON dash_user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts user achievements"
  ON dash_user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Review schedule: users manage their own
CREATE POLICY "Users manage own review schedule"
  ON dash_review_schedule FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- Seed: Default Achievements
-- ============================================
INSERT INTO dash_achievements (name, description, icon, category, requirement_type, requirement_value, tier, xp_reward) VALUES
  ('First Quiz', 'Complete your first quiz', 'play-circle', 'general', 'questions_answered', 1, 'bronze', 5),
  ('Quiz Enthusiast', 'Answer 25 questions', 'zap', 'general', 'questions_answered', 25, 'bronze', 15),
  ('Quiz Master', 'Answer 100 questions', 'award', 'general', 'questions_answered', 100, 'silver', 50),
  ('Perfect Score', 'Get 100% on a quiz', 'star', 'quiz_mastery', 'perfect_quiz', 1, 'silver', 25),
  ('Triple Perfect', 'Get 100% on 3 quizzes', 'stars', 'quiz_mastery', 'perfect_quiz', 3, 'gold', 75),
  ('Speed Demon', 'Complete a quiz in under 60 seconds', 'clock', 'speed', 'speed_run', 60, 'silver', 30),
  ('3-Day Streak', 'Practice 3 days in a row', 'flame', 'streak', 'streak_days', 3, 'bronze', 10),
  ('Week Warrior', 'Practice 7 days in a row', 'flame', 'streak', 'streak_days', 7, 'silver', 30),
  ('Month Master', 'Practice 30 days in a row', 'flame', 'streak', 'streak_days', 30, 'gold', 100),
  ('Topic Explorer', 'Master 5 different topics', 'compass', 'exploration', 'topics_mastered', 5, 'silver', 40),
  ('Subject Scholar', 'Master 15 different topics', 'book-open', 'exploration', 'topics_mastered', 15, 'gold', 100),
  ('Math Whiz', 'Answer 50 math questions correctly', 'calculator', 'quiz_mastery', 'quiz_score', 50, 'gold', 60),
  ('Science Star', 'Answer 50 science questions correctly', 'flask-conical', 'quiz_mastery', 'quiz_score', 50, 'gold', 60)
ON CONFLICT (name) DO NOTHING;
