-- ============================================
-- Organization Enhancements Migration
-- Date: 2025-12-13
-- Purpose: Add columns and tables for organization settings, CV templates, and AI features
-- ============================================

-- Add organization settings columns
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ai_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{}'::jsonb; -- Store social media links

-- CV templates for organizations
CREATE TABLE IF NOT EXISTS cv_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'modern', 'skills_focused', 'creative', 'traditional'
  design JSONB NOT NULL DEFAULT '{}'::jsonb, -- Template design configuration
  fields JSONB NOT NULL DEFAULT '[]'::jsonb, -- Required/optional fields
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for CV templates
CREATE INDEX IF NOT EXISTS idx_cv_templates_organization_id ON cv_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_cv_templates_is_default ON cv_templates(organization_id, is_default) WHERE is_default = true;

-- AI generated content
CREATE TABLE IF NOT EXISTS ai_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- 'program_description', 'assignment', 'announcement', 'email_template'
  prompt TEXT,
  generated_text TEXT NOT NULL,
  reviewed BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for AI generated content
CREATE INDEX IF NOT EXISTS idx_ai_content_organization_id ON ai_generated_content(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_content_type ON ai_generated_content(content_type);
CREATE INDEX IF NOT EXISTS idx_ai_content_reviewed ON ai_generated_content(reviewed);

-- AI recommendations
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL, -- 'program_match', 'enrollment', 'resource', 'peer_connection'
  program_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  confidence_score DECIMAL(5, 2), -- 0.00 to 1.00
  reasoning TEXT,
  acted_upon BOOLEAN DEFAULT false,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for AI recommendations
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_learner_id ON ai_recommendations(learner_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_organization_id ON ai_recommendations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_program_id ON ai_recommendations(program_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_acted_upon ON ai_recommendations(acted_upon);

-- Add updated_at trigger for CV templates
CREATE TRIGGER update_cv_templates_updated_at
  BEFORE UPDATE ON cv_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE cv_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- CV templates: organization members can view, admins can manage
CREATE POLICY "Organization members can view CV templates"
  ON cv_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = cv_templates.organization_id
    )
  );

CREATE POLICY "Organization admins can manage CV templates"
  ON cv_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = cv_templates.organization_id
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- AI generated content: organization members can view, creators can manage
CREATE POLICY "Organization members can view AI content"
  ON ai_generated_content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = ai_generated_content.organization_id
    )
  );

CREATE POLICY "Users can create AI content for their org"
  ON ai_generated_content FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = ai_generated_content.organization_id
    )
    AND (auth.uid() = created_by OR created_by IS NULL)
  );

CREATE POLICY "Creators can update their AI content"
  ON ai_generated_content FOR UPDATE
  USING (auth.uid() = created_by OR created_by IS NULL);

-- AI recommendations: learners can view their own
CREATE POLICY "Learners can view their own recommendations"
  ON ai_recommendations FOR SELECT
  USING (auth.uid() = learner_id);

CREATE POLICY "System can create recommendations"
  ON ai_recommendations FOR INSERT
  WITH CHECK (true); -- System role will insert

CREATE POLICY "Learners can update their recommendations"
  ON ai_recommendations FOR UPDATE
  USING (auth.uid() = learner_id);

-- Comments
COMMENT ON TABLE cv_templates IS 'CV templates created by organizations for their learners';
COMMENT ON TABLE ai_generated_content IS 'AI-generated content (descriptions, assignments, etc.) for organizations';
COMMENT ON TABLE ai_recommendations IS 'AI-powered recommendations for learners (programs, connections, etc.)';

COMMENT ON COLUMN organizations.logo_url IS 'URL to organization logo';
COMMENT ON COLUMN organizations.brand_colors IS 'Brand color scheme (primary, secondary, accent, etc.)';
COMMENT ON COLUMN organizations.settings IS 'Organization-specific settings and preferences';
COMMENT ON COLUMN organizations.ai_preferences IS 'AI feature preferences and configuration';
COMMENT ON COLUMN organizations.social_media IS 'Social media links (facebook, instagram, twitter, etc.)';



