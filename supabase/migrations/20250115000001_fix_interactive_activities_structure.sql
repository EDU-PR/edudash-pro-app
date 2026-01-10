-- Fix migration: Add missing columns to existing interactive_activities table
-- Date: 2025-01-15

-- Add stem_category column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interactive_activities' AND column_name = 'stem_category'
  ) THEN
    ALTER TABLE interactive_activities 
    ADD COLUMN stem_category TEXT DEFAULT 'none' 
    CHECK (stem_category IN ('ai', 'robotics', 'computer_literacy', 'none'));
  END IF;
END $$;

-- Add is_published column if it doesn't exist (map from is_active)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interactive_activities' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE interactive_activities 
    ADD COLUMN is_published BOOLEAN DEFAULT true;
    
    -- Set is_published based on is_active for existing records
    UPDATE interactive_activities 
    SET is_published = is_active 
    WHERE is_published IS NULL;
  END IF;
END $$;

-- Add description column if it doesn't exist (map from instructions)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interactive_activities' AND column_name = 'description'
  ) THEN
    ALTER TABLE interactive_activities 
    ADD COLUMN description TEXT;
    
    -- Copy instructions to description for existing records
    UPDATE interactive_activities 
    SET description = instructions 
    WHERE description IS NULL AND instructions IS NOT NULL;
  END IF;
END $$;

-- Add created_by column if it doesn't exist (map from teacher_id)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interactive_activities' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE interactive_activities 
    ADD COLUMN created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
    
    -- Copy teacher_id to created_by for existing records
    UPDATE interactive_activities 
    SET created_by = teacher_id 
    WHERE created_by IS NULL AND teacher_id IS NOT NULL;
  END IF;
END $$;

-- Add play_count column if it doesn't exist (map from times_played)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interactive_activities' AND column_name = 'play_count'
  ) THEN
    ALTER TABLE interactive_activities 
    ADD COLUMN play_count INTEGER DEFAULT 0;
    
    -- Copy times_played to play_count for existing records
    UPDATE interactive_activities 
    SET play_count = times_played 
    WHERE play_count IS NULL;
  END IF;
END $$;

-- Add average_score column if it doesn't exist (map from avg_score)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interactive_activities' AND column_name = 'average_score'
  ) THEN
    ALTER TABLE interactive_activities 
    ADD COLUMN average_score DECIMAL(5,2);
    
    -- Copy avg_score to average_score for existing records
    UPDATE interactive_activities 
    SET average_score = avg_score 
    WHERE average_score IS NULL AND avg_score IS NOT NULL;
  END IF;
END $$;

-- Now create the indexes that failed before
CREATE INDEX IF NOT EXISTS idx_interactive_activities_stem_category 
ON interactive_activities(stem_category) 
WHERE stem_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interactive_activities_published 
ON interactive_activities(is_published) 
WHERE is_published = true;

-- Fix the RLS policy that failed
DROP POLICY IF EXISTS "parents_view_interactive_activities" ON interactive_activities;
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
