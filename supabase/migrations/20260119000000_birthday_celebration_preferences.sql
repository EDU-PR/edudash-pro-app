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

DO $policies$
DECLARE
  has_students BOOLEAN;
  has_parent_id BOOLEAN;
  has_class_id BOOLEAN;
  has_preschool_id BOOLEAN;
  has_classes BOOLEAN;
  has_teacher_id BOOLEAN;
  has_profiles BOOLEAN;
  has_profile_preschool_id BOOLEAN;
  has_profile_role BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'students'
  ) INTO has_students;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_id'
  ) INTO has_parent_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'class_id'
  ) INTO has_class_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'preschool_id'
  ) INTO has_preschool_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'classes'
  ) INTO has_classes;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'teacher_id'
  ) INTO has_teacher_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO has_profiles;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preschool_id'
  ) INTO has_profile_preschool_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) INTO has_profile_role;

  IF has_students AND has_parent_id THEN
    EXECUTE 'DROP POLICY IF EXISTS birthday_prefs_parent_policy ON birthday_celebration_preferences';
    EXECUTE 'CREATE POLICY birthday_prefs_parent_policy ON birthday_celebration_preferences FOR ALL USING (EXISTS (SELECT 1 FROM students s WHERE s.id = birthday_celebration_preferences.student_id AND s.parent_id = auth.uid()))';
  ELSE
    RAISE NOTICE 'Skipping parent birthday prefs policy: students.parent_id missing';
  END IF;

  IF has_students AND has_class_id AND has_classes AND has_teacher_id THEN
    EXECUTE 'DROP POLICY IF EXISTS birthday_prefs_teacher_view_policy ON birthday_celebration_preferences';
    EXECUTE 'CREATE POLICY birthday_prefs_teacher_view_policy ON birthday_celebration_preferences FOR SELECT USING (EXISTS (SELECT 1 FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = birthday_celebration_preferences.student_id AND c.teacher_id = auth.uid()))';
  ELSE
    RAISE NOTICE 'Skipping teacher birthday prefs policy: students.class_id or classes.teacher_id missing';
  END IF;

  IF has_students AND has_preschool_id AND has_profiles AND has_profile_preschool_id AND has_profile_role THEN
    EXECUTE 'DROP POLICY IF EXISTS birthday_prefs_principal_view_policy ON birthday_celebration_preferences';
    EXECUTE 'CREATE POLICY birthday_prefs_principal_view_policy ON birthday_celebration_preferences FOR SELECT USING (EXISTS (SELECT 1 FROM students s JOIN profiles p ON p.id = auth.uid() WHERE s.id = birthday_celebration_preferences.student_id AND s.preschool_id = p.preschool_id AND p.role = ''principal''))';
  ELSE
    RAISE NOTICE 'Skipping principal birthday prefs policy: required profiles/students columns missing';
  END IF;
END;
$policies$;

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
