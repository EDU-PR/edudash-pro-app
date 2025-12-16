-- ============================================
-- Learner Features Foundation Migration
-- Date: 2025-12-13
-- Purpose: Create tables for learner connections, study groups, submissions, CVs, and portfolio
-- ============================================

-- Learner connections (peer and instructor connections)
CREATE TABLE IF NOT EXISTS learner_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('peer', 'instructor')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(learner_id, connection_id),
  CONSTRAINT no_self_connection CHECK (learner_id != connection_id)
);

-- Indexes for learner connections
CREATE INDEX IF NOT EXISTS idx_learner_connections_learner_id ON learner_connections(learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_connections_connection_id ON learner_connections(connection_id);
CREATE INDEX IF NOT EXISTS idx_learner_connections_status ON learner_connections(status);

-- Study groups
CREATE TABLE IF NOT EXISTS study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  program_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  members JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for study groups
CREATE INDEX IF NOT EXISTS idx_study_groups_organization_id ON study_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_study_groups_program_id ON study_groups(program_id);
CREATE INDEX IF NOT EXISTS idx_study_groups_created_by ON study_groups(created_by);

-- Assignment submissions
-- Note: This assumes an 'assignments' table exists. If not, create it separately.
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID, -- Will reference assignments table when created
  learner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  files JSONB DEFAULT '[]'::jsonb, -- Array of file URLs from Supabase Storage
  text_response TEXT,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  grade DECIMAL(5, 2),
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for assignment submissions
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_learner_id ON assignment_submissions(learner_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_enrollment_id ON assignment_submissions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status ON assignment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id) WHERE assignment_id IS NOT NULL;

-- Learner CVs
CREATE TABLE IF NOT EXISTS learner_cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template_id TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb, -- Full CV data structure
  pdf_url TEXT, -- URL to generated PDF in Supabase Storage
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for learner CVs
CREATE INDEX IF NOT EXISTS idx_learner_cvs_learner_id ON learner_cvs(learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_cvs_is_primary ON learner_cvs(learner_id, is_primary) WHERE is_primary = true;

-- Portfolio items
CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., 'project', 'certificate', 'work_sample', 'assignment'
  file_url TEXT, -- URL to file in Supabase Storage
  thumbnail_url TEXT, -- URL to thumbnail image
  program_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for portfolio items
CREATE INDEX IF NOT EXISTS idx_portfolio_items_learner_id ON portfolio_items(learner_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_program_id ON portfolio_items(program_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_is_public ON portfolio_items(is_public);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_category ON portfolio_items(category);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_learner_connections_updated_at
  BEFORE UPDATE ON learner_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_groups_updated_at
  BEFORE UPDATE ON study_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignment_submissions_updated_at
  BEFORE UPDATE ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learner_cvs_updated_at
  BEFORE UPDATE ON learner_cvs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE learner_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be enhanced later)
-- Learner connections: users can see their own connections
CREATE POLICY "Users can view their own connections"
  ON learner_connections FOR SELECT
  USING (auth.uid() = learner_id OR auth.uid() = connection_id);

CREATE POLICY "Users can create their own connections"
  ON learner_connections FOR INSERT
  WITH CHECK (auth.uid() = learner_id);

CREATE POLICY "Users can update their own connections"
  ON learner_connections FOR UPDATE
  USING (auth.uid() = learner_id OR auth.uid() = connection_id);

-- Study groups: organization members can view
CREATE POLICY "Organization members can view study groups"
  ON study_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = study_groups.organization_id
    )
  );

CREATE POLICY "Organization members can create study groups"
  ON study_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = study_groups.organization_id
    )
    AND auth.uid() = created_by
  );

-- Assignment submissions: learners can view their own
CREATE POLICY "Learners can view their own submissions"
  ON assignment_submissions FOR SELECT
  USING (auth.uid() = learner_id);

CREATE POLICY "Learners can create their own submissions"
  ON assignment_submissions FOR INSERT
  WITH CHECK (auth.uid() = learner_id);

CREATE POLICY "Learners can update their own submissions"
  ON assignment_submissions FOR UPDATE
  USING (auth.uid() = learner_id);

-- Learner CVs: users can view their own
CREATE POLICY "Users can view their own CVs"
  ON learner_cvs FOR SELECT
  USING (auth.uid() = learner_id);

CREATE POLICY "Users can create their own CVs"
  ON learner_cvs FOR INSERT
  WITH CHECK (auth.uid() = learner_id);

CREATE POLICY "Users can update their own CVs"
  ON learner_cvs FOR UPDATE
  USING (auth.uid() = learner_id);

-- Portfolio items: users can view their own, public items visible to org
CREATE POLICY "Users can view their own portfolio items"
  ON portfolio_items FOR SELECT
  USING (auth.uid() = learner_id OR is_public = true);

CREATE POLICY "Users can create their own portfolio items"
  ON portfolio_items FOR INSERT
  WITH CHECK (auth.uid() = learner_id);

CREATE POLICY "Users can update their own portfolio items"
  ON portfolio_items FOR UPDATE
  USING (auth.uid() = learner_id);

-- Comments
COMMENT ON TABLE learner_connections IS 'Connections between learners and peers/instructors';
COMMENT ON TABLE study_groups IS 'Study groups created by learners within programs';
COMMENT ON TABLE assignment_submissions IS 'Submissions by learners for assignments';
COMMENT ON TABLE learner_cvs IS 'CVs created and managed by learners';
COMMENT ON TABLE portfolio_items IS 'Portfolio items showcasing learner work and achievements';



