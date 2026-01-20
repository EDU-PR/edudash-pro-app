-- Birthday Celebration Preferences Table
-- Stores parent preferences for student birthday celebrations at school
-- Migration: 20260119_birthday_celebration_preferences

-- Create the birthday_celebration_preferences table
CREATE TABLE IF NOT EXISTS birthday_celebration_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- Celebration preferences
  wants_school_celebration BOOLEAN DEFAULT true,
  preferred_theme TEXT,
  
  -- Health & Safety
  allergies TEXT[] DEFAULT '{}',
  dietary_restrictions TEXT[] DEFAULT '{}',
  
  -- Parent participation
  parent_bringing_treats BOOLEAN DEFAULT false,
  treats_description TEXT,
  guest_count INTEGER,
  
  -- Communication
  notify_classmates BOOLEAN DEFAULT true,
  special_requests TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one preference set per student
  UNIQUE(student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_birthday_prefs_student 
ON birthday_celebration_preferences(student_id);

-- Enable RLS
ALTER TABLE birthday_celebration_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Parents can view and manage their own children's preferences
DROP POLICY IF EXISTS birthday_prefs_parent_policy ON birthday_celebration_preferences;
CREATE POLICY birthday_prefs_parent_policy ON birthday_celebration_preferences
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = birthday_celebration_preferences.student_id
    AND s.parent_id = auth.uid()
  )
);

-- Policy: Teachers can view preferences for students in their classes
DROP POLICY IF EXISTS birthday_prefs_teacher_view_policy ON birthday_celebration_preferences;
CREATE POLICY birthday_prefs_teacher_view_policy ON birthday_celebration_preferences
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.id = birthday_celebration_preferences.student_id
    AND c.teacher_id = auth.uid()
  )
);

-- Policy: Principals can view all preferences in their school
DROP POLICY IF EXISTS birthday_prefs_principal_view_policy ON birthday_celebration_preferences;
CREATE POLICY birthday_prefs_principal_view_policy ON birthday_celebration_preferences
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s
    JOIN profiles p ON p.id = auth.uid()
    WHERE s.id = birthday_celebration_preferences.student_id
    AND s.preschool_id = p.preschool_id
    AND p.role = 'principal'
  )
);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_birthday_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS trigger_birthday_prefs_updated_at ON birthday_celebration_preferences;
CREATE TRIGGER trigger_birthday_prefs_updated_at
  BEFORE UPDATE ON birthday_celebration_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_birthday_prefs_updated_at();

-- Add helpful comments
COMMENT ON TABLE birthday_celebration_preferences IS 'Stores parent preferences for student birthday celebrations at school';
COMMENT ON COLUMN birthday_celebration_preferences.wants_school_celebration IS 'Whether the parent wants a school celebration';
COMMENT ON COLUMN birthday_celebration_preferences.preferred_theme IS 'Preferred birthday theme (princess, superhero, etc.)';
COMMENT ON COLUMN birthday_celebration_preferences.allergies IS 'List of allergies to consider for treats';
COMMENT ON COLUMN birthday_celebration_preferences.dietary_restrictions IS 'Dietary restrictions (vegetarian, halal, etc.)';
COMMENT ON COLUMN birthday_celebration_preferences.parent_bringing_treats IS 'Whether parent will provide treats';
COMMENT ON COLUMN birthday_celebration_preferences.notify_classmates IS 'Whether to notify other parents about the birthday';
