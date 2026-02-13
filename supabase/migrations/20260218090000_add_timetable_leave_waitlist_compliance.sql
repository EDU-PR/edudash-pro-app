-- Migration: Add timetables, staff leave, waitlist, and school compliance tables
-- These tables enable the 5 missing principal/admin capabilities:
-- 1. Timetable management
-- 2. Staff leave tracking
-- 3. Waitlist management
-- 4. School-level compliance checks (budget/petty cash already exists)

-- ════════════════════════════════════════════════════════════
-- 1. TIMETABLES
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS timetable_slots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
    teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    subject text,
    activity_type text DEFAULT 'lesson',
    room text,
    notes text,
    is_recurring boolean DEFAULT true,
    effective_from date DEFAULT CURRENT_DATE,
    effective_until date,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_timetable_slots_school ON timetable_slots(school_id);
CREATE INDEX idx_timetable_slots_class ON timetable_slots(class_id);
CREATE INDEX idx_timetable_slots_teacher ON timetable_slots(teacher_id);
CREATE INDEX idx_timetable_slots_day ON timetable_slots(school_id, day_of_week);

ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;

-- Principals + admins: full CRUD on own school
CREATE POLICY timetable_slots_principal_all ON timetable_slots
    FOR ALL
    USING (
        school_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'admin', 'principal_admin')
        )
    );

-- Teachers: read own school timetable
CREATE POLICY timetable_slots_teacher_select ON timetable_slots
    FOR SELECT
    USING (
        school_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'teacher'
        )
    );

-- ════════════════════════════════════════════════════════════
-- 2. STAFF LEAVE REQUESTS
-- ════════════════════════════════════════════════════════════

CREATE TYPE leave_type AS ENUM (
    'annual', 'sick', 'family_responsibility', 'maternity',
    'unpaid', 'study', 'compassionate', 'other'
);

CREATE TYPE leave_status AS ENUM (
    'pending', 'approved', 'rejected', 'cancelled'
);

CREATE TABLE IF NOT EXISTS staff_leave_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    leave_type leave_type NOT NULL DEFAULT 'annual',
    status leave_status NOT NULL DEFAULT 'pending',
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_requested numeric(4, 1) NOT NULL CHECK (days_requested > 0),
    reason text,
    supporting_document_path text,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    review_notes text,
    substitute_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_staff_leave_school ON staff_leave_requests(school_id);
CREATE INDEX idx_staff_leave_staff ON staff_leave_requests(staff_id);
CREATE INDEX idx_staff_leave_status ON staff_leave_requests(school_id, status);
CREATE INDEX idx_staff_leave_dates ON staff_leave_requests(start_date, end_date);

ALTER TABLE staff_leave_requests ENABLE ROW LEVEL SECURITY;

-- Principals: full CRUD
CREATE POLICY staff_leave_principal_all ON staff_leave_requests
    FOR ALL
    USING (
        school_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'admin', 'principal_admin')
        )
    );

-- Staff: read/insert own requests
CREATE POLICY staff_leave_own_select ON staff_leave_requests
    FOR SELECT
    USING (staff_id = auth.uid());

CREATE POLICY staff_leave_own_insert ON staff_leave_requests
    FOR INSERT
    WITH CHECK (staff_id = auth.uid());

-- Staff: update own ONLY if still pending (cancel)
CREATE POLICY staff_leave_own_cancel ON staff_leave_requests
    FOR UPDATE
    USING (staff_id = auth.uid() AND status = 'pending')
    WITH CHECK (status = 'cancelled');

-- ════════════════════════════════════════════════════════════
-- 3. WAITLIST ENTRIES
-- ════════════════════════════════════════════════════════════

CREATE TYPE waitlist_status AS ENUM (
    'active', 'offered', 'accepted', 'declined', 'expired', 'enrolled'
);

CREATE TABLE IF NOT EXISTS waitlist_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    child_first_name text NOT NULL,
    child_last_name text NOT NULL,
    child_date_of_birth date,
    parent_name text NOT NULL,
    parent_email text,
    parent_phone text,
    preferred_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
    preferred_start_date date,
    status waitlist_status NOT NULL DEFAULT 'active',
    priority smallint DEFAULT 0,
    position serial,
    notes text,
    offered_at timestamptz,
    offer_expires_at timestamptz,
    enrolled_student_id uuid REFERENCES students(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_waitlist_school ON waitlist_entries(school_id);
CREATE INDEX idx_waitlist_status ON waitlist_entries(school_id, status);
CREATE INDEX idx_waitlist_position ON waitlist_entries(school_id, position);

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Principals: full CRUD
CREATE POLICY waitlist_principal_all ON waitlist_entries
    FOR ALL
    USING (
        school_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'admin', 'principal_admin')
        )
    );

-- Teachers: read-only (for awareness)
CREATE POLICY waitlist_teacher_select ON waitlist_entries
    FOR SELECT
    USING (
        school_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'teacher'
        )
    );

-- ════════════════════════════════════════════════════════════
-- 4. SCHOOL COMPLIANCE CHECKS
-- ════════════════════════════════════════════════════════════

CREATE TYPE compliance_category AS ENUM (
    'health_safety', 'dsd_registration', 'fire_certificate',
    'building_compliance', 'food_hygiene', 'staff_qualifications',
    'first_aid', 'insurance', 'curriculum', 'child_protection', 'other'
);

CREATE TYPE compliance_check_status AS ENUM (
    'compliant', 'non_compliant', 'pending_review', 'expired', 'not_applicable'
);

CREATE TABLE IF NOT EXISTS school_compliance_checks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    category compliance_category NOT NULL,
    title text NOT NULL,
    description text,
    status compliance_check_status NOT NULL DEFAULT 'pending_review',
    due_date date,
    completed_date date,
    expiry_date date,
    document_path text,
    inspector_name text,
    inspector_reference text,
    notes text,
    checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_compliance_school ON school_compliance_checks(school_id);
CREATE INDEX idx_compliance_status ON school_compliance_checks(school_id, status);
CREATE INDEX idx_compliance_due ON school_compliance_checks(due_date)
    WHERE status NOT IN ('compliant', 'not_applicable');
CREATE INDEX idx_compliance_expiry ON school_compliance_checks(expiry_date)
    WHERE expiry_date IS NOT NULL;

ALTER TABLE school_compliance_checks ENABLE ROW LEVEL SECURITY;

-- Principals: full CRUD
CREATE POLICY compliance_principal_all ON school_compliance_checks
    FOR ALL
    USING (
        school_id IN (
            SELECT COALESCE(p.organization_id, p.preschool_id)
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'admin', 'principal_admin')
        )
    );

-- Teachers: read-only
CREATE POLICY compliance_teacher_select ON school_compliance_checks
    FOR SELECT
    USING (
        school_id IN (
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

CREATE TRIGGER set_updated_at_timetable_slots
    BEFORE UPDATE ON timetable_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_staff_leave_requests
    BEFORE UPDATE ON staff_leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_waitlist_entries
    BEFORE UPDATE ON waitlist_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_school_compliance_checks
    BEFORE UPDATE ON school_compliance_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
