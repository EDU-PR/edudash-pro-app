-- Migration: Observation checklists and learner support/adaptation records
-- Enables Principal and Teacher to:
-- 1. Record structured observation checklists with criteria
-- 2. Track learner support plans, IEP, accommodations, and adaptations

-- ════════════════════════════════════════════════════════════
-- 1. OBSERVATION CHECKLIST TEMPLATES
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS observation_checklist_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL DEFAULT 'general'
        CHECK (category IN ('literacy', 'numeracy', 'life_skills', 'behavior', 'participation', 'assessment', 'general')),
    criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- criteria: [{ id, label, type: 'yes_no'|'scale_1_5'|'text', required: bool }]
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_obs_checklist_tpl_preschool ON observation_checklist_templates(preschool_id);
CREATE INDEX idx_obs_checklist_tpl_category ON observation_checklist_templates(preschool_id, category);

ALTER TABLE observation_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY obs_checklist_tpl_principal_all ON observation_checklist_templates
    FOR ALL
    USING (
        preschool_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'admin', 'principal_admin')
        )
    );

CREATE POLICY obs_checklist_tpl_teacher_select ON observation_checklist_templates
    FOR SELECT
    USING (
        preschool_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'teacher'
        )
    );

-- ════════════════════════════════════════════════════════════
-- 2. OBSERVATION CHECKLIST RECORDS (completed observations)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS observation_checklist_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    template_id uuid REFERENCES observation_checklist_templates(id) ON DELETE SET NULL,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
    observed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    observation_date date NOT NULL,
    notes text,
    responses jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- responses: { criterion_id: value }
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_obs_checklist_rec_preschool ON observation_checklist_records(preschool_id);
CREATE INDEX idx_obs_checklist_rec_student ON observation_checklist_records(student_id);
CREATE INDEX idx_obs_checklist_rec_date ON observation_checklist_records(observation_date);
CREATE INDEX idx_obs_checklist_rec_observed_by ON observation_checklist_records(observed_by);

ALTER TABLE observation_checklist_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY obs_checklist_rec_principal_all ON observation_checklist_records
    FOR ALL
    USING (
        preschool_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'admin', 'principal_admin')
        )
    );

CREATE POLICY obs_checklist_rec_teacher_all ON observation_checklist_records
    FOR ALL
    USING (
        preschool_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'teacher'
        )
    );

-- ════════════════════════════════════════════════════════════
-- 3. LEARNER SUPPORT / ADAPTATION RECORDS (IEP, accommodations)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS learner_support_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    record_type text NOT NULL DEFAULT 'support_plan'
        CHECK (record_type IN ('support_plan', 'iep', 'accommodation', 'modification', 'intervention')),
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'reviewed', 'archived')),
    start_date date,
    end_date date,
    accommodations jsonb DEFAULT '[]'::jsonb,
    -- [{ type, description, frequency }]
    modifications jsonb DEFAULT '[]'::jsonb,
    -- [{ subject_area, description }]
    goals jsonb DEFAULT '[]'::jsonb,
    -- [{ goal, target_date, progress }]
    interventions jsonb DEFAULT '[]'::jsonb,
    -- [{ type, description, frequency, notes }]
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT valid_support_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_learner_support_preschool ON learner_support_records(preschool_id);
CREATE INDEX idx_learner_support_student ON learner_support_records(student_id);
CREATE INDEX idx_learner_support_status ON learner_support_records(preschool_id, status);
CREATE INDEX idx_learner_support_type ON learner_support_records(record_type);

ALTER TABLE learner_support_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY learner_support_principal_all ON learner_support_records
    FOR ALL
    USING (
        preschool_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'admin', 'principal_admin')
        )
    );

CREATE POLICY learner_support_teacher_all ON learner_support_records
    FOR ALL
    USING (
        preschool_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'teacher'
        )
    );

-- ════════════════════════════════════════════════════════════
-- 4. ACTIVITY SAMPLE LIBRARY (for teachers/principals)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS activity_sample_library (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    preschool_id uuid REFERENCES preschools(id) ON DELETE CASCADE,
    -- NULL = system-wide template; non-null = school-specific
    strand text NOT NULL CHECK (strand IN ('literacy', 'numeracy', 'life_skills', 'creative', 'physical', 'other')),
    title text NOT NULL,
    description text,
    age_group text,
    duration_minutes integer,
    objectives jsonb DEFAULT '[]'::jsonb,
    materials jsonb DEFAULT '[]'::jsonb,
    instructions text,
    caps_alignment text,
    is_system_template boolean DEFAULT false,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_sample_strand ON activity_sample_library(strand);
CREATE INDEX idx_activity_sample_preschool ON activity_sample_library(preschool_id);
CREATE INDEX idx_activity_sample_system ON activity_sample_library(is_system_template) WHERE is_system_template = true;

ALTER TABLE activity_sample_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_sample_principal_all ON activity_sample_library
    FOR ALL
    USING (
        preschool_id IS NULL
        OR preschool_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'admin', 'principal_admin')
        )
    );

CREATE POLICY activity_sample_teacher_select ON activity_sample_library
    FOR SELECT
    USING (
        preschool_id IS NULL
        OR preschool_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'teacher'
        )
    );

-- ════════════════════════════════════════════════════════════
-- 5. UPDATED_AT TRIGGERS
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_obs_checklist_tpl_updated_at
    BEFORE UPDATE ON observation_checklist_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_obs_checklist_rec_updated_at
    BEFORE UPDATE ON observation_checklist_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_learner_support_updated_at
    BEFORE UPDATE ON learner_support_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_activity_sample_updated_at
    BEFORE UPDATE ON activity_sample_library
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
