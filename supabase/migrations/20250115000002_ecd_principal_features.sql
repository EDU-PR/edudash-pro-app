-- ECD Principal Features Migration
-- Year Planner, Term Management, Curriculum Planning, Lesson Templates
-- Date: 2025-01-15

-- ================================================================
-- PART 1: ACADEMIC TERMS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Term details
  name TEXT NOT NULL, -- e.g., "Term 1", "First Semester"
  academic_year INTEGER NOT NULL, -- e.g., 2025
  term_number INTEGER NOT NULL CHECK (term_number BETWEEN 1 AND 4),
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  
  -- Metadata
  description TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique term numbers per preschool per year
  UNIQUE (preschool_id, academic_year, term_number)
);

CREATE INDEX IF NOT EXISTS idx_academic_terms_preschool_year 
ON academic_terms(preschool_id, academic_year DESC);

CREATE INDEX IF NOT EXISTS idx_academic_terms_active 
ON academic_terms(preschool_id, is_active) 
WHERE is_active = true;

-- ================================================================
-- PART 2: CURRICULUM THEMES/UNITS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS curriculum_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Theme details
  title TEXT NOT NULL,
  description TEXT,
  
  -- Planning
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  week_number INTEGER CHECK (week_number BETWEEN 1 AND 52),
  start_date DATE,
  end_date DATE,
  
  -- Learning objectives
  learning_objectives JSONB DEFAULT '[]', -- Array of objectives
  key_concepts JSONB DEFAULT '[]', -- Array of concepts
  vocabulary_words JSONB DEFAULT '[]', -- Array of vocabulary
  
  -- Activities
  suggested_activities JSONB DEFAULT '[]', -- Array of activity suggestions
  materials_needed JSONB DEFAULT '[]', -- Array of materials
  
  -- ECD-specific
  developmental_domains JSONB DEFAULT '[]', -- ['cognitive', 'physical', 'social', 'emotional', 'language']
  age_groups TEXT[] DEFAULT ARRAY['3-6'], -- ['1-2', '3-4', '4-5', '5-6']
  
  -- Status
  is_published BOOLEAN DEFAULT false,
  is_template BOOLEAN DEFAULT false, -- Can be reused
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_themes_preschool_term 
ON curriculum_themes(preschool_id, term_id);

CREATE INDEX IF NOT EXISTS idx_curriculum_themes_published 
ON curriculum_themes(preschool_id, is_published) 
WHERE is_published = true;

-- ================================================================
-- PART 3: LESSON PLANNING TEMPLATES TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS lesson_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Template details
  name TEXT NOT NULL,
  description TEXT,
  
  -- Template structure
  template_structure JSONB NOT NULL DEFAULT '{
    "sections": [
      {"name": "Learning Objectives", "required": true},
      {"name": "Materials Needed", "required": true},
      {"name": "Introduction", "required": true},
      {"name": "Main Activity", "required": true},
      {"name": "Conclusion", "required": true},
      {"name": "Assessment", "required": false},
      {"name": "Extensions", "required": false}
    ]
  }',
  
  -- Default values
  default_duration_minutes INTEGER DEFAULT 30,
  default_age_group TEXT DEFAULT '3-6',
  default_subject TEXT,
  
  -- Usage
  usage_count INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false, -- One default per preschool
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_templates_preschool 
ON lesson_templates(preschool_id, is_active);

CREATE INDEX IF NOT EXISTS idx_lesson_templates_default 
ON lesson_templates(preschool_id, is_default) 
WHERE is_default = true;

-- ================================================================
-- PART 4: WEEKLY PLANNING TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Week details
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  theme_id UUID REFERENCES curriculum_themes(id) ON DELETE SET NULL,
  week_number INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Daily plans (Monday-Friday)
  daily_plans JSONB DEFAULT '{
    "monday": {"activities": [], "learning_objectives": []},
    "tuesday": {"activities": [], "learning_objectives": []},
    "wednesday": {"activities": [], "learning_objectives": []},
    "thursday": {"activities": [], "learning_objectives": []},
    "friday": {"activities": [], "learning_objectives": []}
  }',
  
  -- Weekly focus
  weekly_focus TEXT,
  weekly_objectives JSONB DEFAULT '[]',
  
  -- Materials
  materials_list JSONB DEFAULT '[]',
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'published')),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One plan per class per week
  UNIQUE (class_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_preschool_week 
ON weekly_plans(preschool_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_class_week 
ON weekly_plans(class_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_status 
ON weekly_plans(preschool_id, status);

-- ================================================================
-- PART 5: RLS POLICIES
-- ================================================================

-- Academic Terms
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "principals_manage_academic_terms" ON academic_terms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = academic_terms.preschool_id
    )
  );

CREATE POLICY "teachers_view_academic_terms" ON academic_terms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = academic_terms.preschool_id
    )
  );

-- Curriculum Themes
ALTER TABLE curriculum_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "principals_manage_curriculum_themes" ON curriculum_themes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = curriculum_themes.preschool_id
    )
  );

CREATE POLICY "teachers_view_curriculum_themes" ON curriculum_themes
  FOR SELECT USING (
    is_published = true OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = curriculum_themes.preschool_id
    )
  );

-- Lesson Templates
ALTER TABLE lesson_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "principals_manage_lesson_templates" ON lesson_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = lesson_templates.preschool_id
    )
  );

CREATE POLICY "teachers_use_lesson_templates" ON lesson_templates
  FOR SELECT USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = lesson_templates.preschool_id
    )
  );

-- Weekly Plans
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_manage_weekly_plans" ON weekly_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = weekly_plans.preschool_id
    )
  );

CREATE POLICY "principals_approve_weekly_plans" ON weekly_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = weekly_plans.preschool_id
    )
  );

-- ================================================================
-- PART 6: TRIGGERS FOR UPDATED_AT
-- ================================================================

CREATE TRIGGER update_academic_terms_updated_at
  BEFORE UPDATE ON academic_terms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_curriculum_themes_updated_at
  BEFORE UPDATE ON curriculum_themes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_templates_updated_at
  BEFORE UPDATE ON lesson_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_plans_updated_at
  BEFORE UPDATE ON weekly_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- PART 7: GRANTS
-- ================================================================

GRANT ALL ON academic_terms TO authenticated;
GRANT ALL ON curriculum_themes TO authenticated;
GRANT ALL ON lesson_templates TO authenticated;
GRANT ALL ON weekly_plans TO authenticated;

-- ================================================================
-- PART 8: FUNCTIONS
-- ================================================================

-- Function to get current active term
CREATE OR REPLACE FUNCTION get_active_term(p_preschool_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  start_date DATE,
  end_date DATE,
  academic_year INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.start_date,
    t.end_date,
    t.academic_year
  FROM academic_terms t
  WHERE t.preschool_id = p_preschool_id
    AND t.is_active = true
    AND CURRENT_DATE BETWEEN t.start_date AND t.end_date
  ORDER BY t.start_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(template_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE lesson_templates
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = template_uuid;
END;
$$ LANGUAGE plpgsql;
