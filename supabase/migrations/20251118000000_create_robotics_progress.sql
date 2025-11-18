-- Create robotics progress tracking table
CREATE TABLE IF NOT EXISTS robotics_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  challenge_id INTEGER NOT NULL,
  stars_earned INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one progress record per user per challenge
  UNIQUE(user_id, module_id, challenge_id)
);

-- Create index for faster queries
CREATE INDEX idx_robotics_progress_user ON robotics_progress(user_id);
CREATE INDEX idx_robotics_progress_module ON robotics_progress(module_id);

-- Enable RLS
ALTER TABLE robotics_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own robotics progress"
  ON robotics_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own robotics progress"
  ON robotics_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own robotics progress"
  ON robotics_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_robotics_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER robotics_progress_updated_at
  BEFORE UPDATE ON robotics_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_robotics_progress_updated_at();

-- Comments
COMMENT ON TABLE robotics_progress IS 'Tracks user progress through robotics learning modules';
COMMENT ON COLUMN robotics_progress.module_id IS 'Module identifier (e.g., intro-robotics-r-3, block-coding-4-6)';
COMMENT ON COLUMN robotics_progress.challenge_id IS 'Challenge number within the module';
COMMENT ON COLUMN robotics_progress.stars_earned IS 'Number of stars earned (1-3 based on difficulty)';
