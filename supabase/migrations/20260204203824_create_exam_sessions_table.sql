-- Create exam_sessions table for storing student exam progress
-- Part of exam generation feature port from web to native app

CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Session data (JSONB for flexibility)
  session_data JSONB NOT NULL DEFAULT '{}',
  
  -- Session metadata
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Scoring
  total_marks INTEGER NOT NULL DEFAULT 0,
  earned_marks INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_id ON exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_id ON exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_preschool_id ON exam_sessions(preschool_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_started_at ON exam_sessions(started_at DESC);

-- Unique constraint: one active session per user per exam
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_sessions_unique_active 
  ON exam_sessions(user_id, exam_id) 
  WHERE status = 'in_progress';

-- RLS Policies
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own exam sessions
CREATE POLICY "Users can view their own exam sessions"
  ON exam_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own exam sessions
CREATE POLICY "Users can create their own exam sessions"
  ON exam_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own exam sessions
CREATE POLICY "Users can update their own exam sessions"
  ON exam_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own exam sessions
CREATE POLICY "Users can delete their own exam sessions"
  ON exam_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Teachers can view exam sessions for their preschool
CREATE POLICY "Teachers can view preschool exam sessions"
  ON exam_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE (profiles.id = auth.uid() OR profiles.auth_user_id = auth.uid())
        AND (profiles.organization_id = exam_sessions.preschool_id OR profiles.preschool_id = exam_sessions.preschool_id)
        AND profiles.role IN ('teacher', 'principal')
    )
  );

-- Principals can view all exam sessions for their preschool
CREATE POLICY "Principals can view all preschool exam sessions"
  ON exam_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE (profiles.id = auth.uid() OR profiles.auth_user_id = auth.uid())
        AND (profiles.organization_id = exam_sessions.preschool_id OR profiles.preschool_id = exam_sessions.preschool_id)
        AND profiles.role = 'principal'
    )
  );

-- Super-admins can view all exam sessions
CREATE POLICY "Super-admins can view all exam sessions"
  ON exam_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE (profiles.id = auth.uid() OR profiles.auth_user_id = auth.uid())
        AND profiles.role = 'super_admin'
    )
  );

-- Updated_at trigger
CREATE TRIGGER set_exam_sessions_updated_at
  BEFORE UPDATE ON exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment on table
COMMENT ON TABLE exam_sessions IS 'Stores student exam progress and answers for interactive exam feature';
COMMENT ON COLUMN exam_sessions.session_data IS 'JSONB containing exam structure, answers, and metadata';
COMMENT ON COLUMN exam_sessions.status IS 'Exam session status: in_progress, completed, or abandoned';
