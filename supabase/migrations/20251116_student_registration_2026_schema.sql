-- =====================================================
-- STUDENT REGISTRATION SYSTEM FOR 2026 ACADEMIC YEAR
-- Database: bppuzibjlxgfwrujzfsz (Supabase)
-- Purpose: Multi-tenant student registration and management
-- =====================================================

-- =====================================================
-- 1. ENHANCE ORGANIZATIONS TABLE
-- =====================================================

-- Add columns to existing organizations table if they don't exist
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS school_code VARCHAR(20) UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS principal_id UUID REFERENCES auth.users(id);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS academic_year VARCHAR(10) DEFAULT '2026';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enrollment_open BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 500;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS school_type VARCHAR(50);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for school_code lookups
CREATE INDEX IF NOT EXISTS idx_organizations_school_code ON organizations(school_code);
CREATE INDEX IF NOT EXISTS idx_organizations_principal ON organizations(principal_id);

COMMENT ON COLUMN organizations.school_code IS 'Unique code for parent registration (e.g., YE-2026)';
COMMENT ON COLUMN organizations.enrollment_open IS 'Whether school is accepting new registrations';

-- =====================================================
-- 2. PRESCHOOLS/CAMPUSES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS preschools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  campus_code VARCHAR(20) UNIQUE,
  address TEXT,
  principal_id UUID REFERENCES auth.users(id),
  capacity INTEGER DEFAULT 200,
  current_enrollment INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_preschools_org ON preschools(organization_id);
CREATE INDEX idx_preschools_campus_code ON preschools(campus_code);

COMMENT ON TABLE preschools IS 'Individual campuses/branches within an organization';

-- =====================================================
-- 3. CLASSES/GRADES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  grade_level VARCHAR(50),
  teacher_id UUID REFERENCES auth.users(id),
  academic_year VARCHAR(10) DEFAULT '2026',
  max_students INTEGER DEFAULT 25,
  current_students INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  schedule JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_classes_org ON classes(organization_id);
CREATE INDEX idx_classes_preschool ON classes(preschool_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_academic_year ON classes(academic_year);

COMMENT ON TABLE classes IS 'Classes/grades within preschools (Grade R, Reception, etc.)';

-- =====================================================
-- 4. STUDENTS TABLE (MULTI-TENANT)
-- =====================================================

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  preschool_id UUID REFERENCES preschools(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  
  -- Unique Student ID (auto-generated)
  student_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- Personal Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20),
  nationality VARCHAR(100),
  id_number VARCHAR(50),
  passport_number VARCHAR(50),
  
  -- Contact Information
  home_address TEXT,
  home_phone VARCHAR(20),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relationship VARCHAR(50),
  
  -- Academic Information
  enrollment_date DATE DEFAULT CURRENT_DATE,
  academic_year VARCHAR(10) DEFAULT '2026',
  status VARCHAR(50) DEFAULT 'registered',
  previous_school VARCHAR(255),
  
  -- Medical Information
  medical_conditions TEXT,
  allergies TEXT,
  medication TEXT,
  doctor_name VARCHAR(255),
  doctor_phone VARCHAR(20),
  
  -- Additional Information
  profile_picture_url TEXT,
  languages_spoken TEXT[],
  special_needs TEXT,
  dietary_requirements TEXT,
  notes JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_student_status CHECK (status IN ('registered', 'enrolled', 'active', 'inactive', 'graduated', 'withdrawn'))
);

CREATE INDEX idx_students_org ON students(organization_id);
CREATE INDEX idx_students_preschool ON students(preschool_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_academic_year ON students(academic_year);
CREATE INDEX idx_students_name ON students(first_name, last_name);

COMMENT ON TABLE students IS 'Student records with multi-tenant isolation';
COMMENT ON COLUMN students.student_id IS 'Auto-generated ID: ORG-YEAR-NNNN (e.g., YE-2026-0001)';
COMMENT ON COLUMN students.status IS 'registered=applied, enrolled=accepted, active=attending, inactive=not attending, graduated, withdrawn';

-- =====================================================
-- 5. STUDENT-GUARDIAN RELATIONSHIPS
-- =====================================================

CREATE TABLE IF NOT EXISTS student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Relationship Details
  relationship VARCHAR(50) NOT NULL,
  primary_contact BOOLEAN DEFAULT FALSE,
  can_pickup BOOLEAN DEFAULT TRUE,
  financial_responsibility BOOLEAN DEFAULT FALSE,
  
  -- Contact Preferences
  receive_notifications BOOLEAN DEFAULT TRUE,
  notification_methods JSONB DEFAULT '{"email": true, "sms": false}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(student_id, guardian_id),
  CONSTRAINT chk_relationship CHECK (relationship IN ('mother', 'father', 'guardian', 'grandparent', 'other'))
);

CREATE INDEX idx_student_guardians_student ON student_guardians(student_id);
CREATE INDEX idx_student_guardians_guardian ON student_guardians(guardian_id);
CREATE INDEX idx_student_guardians_primary ON student_guardians(primary_contact);

COMMENT ON TABLE student_guardians IS 'Many-to-many relationship between students and guardians';
COMMENT ON COLUMN student_guardians.primary_contact IS 'Primary contact for school communications';

-- =====================================================
-- 6. REGISTRATION REQUESTS (2026 INTAKE)
-- =====================================================

CREATE TABLE IF NOT EXISTS registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- Guardian Information
  guardian_name VARCHAR(255) NOT NULL,
  guardian_email VARCHAR(255) NOT NULL,
  guardian_phone VARCHAR(20) NOT NULL,
  guardian_id_number VARCHAR(50),
  guardian_address TEXT,
  guardian_occupation VARCHAR(255),
  guardian_employer VARCHAR(255),
  
  -- Student Information
  student_first_name VARCHAR(100) NOT NULL,
  student_last_name VARCHAR(100) NOT NULL,
  student_dob DATE NOT NULL,
  student_gender VARCHAR(20),
  student_id_number VARCHAR(50),
  
  -- Registration Details
  preferred_class VARCHAR(100),
  preferred_start_date DATE,
  academic_year VARCHAR(10) DEFAULT '2026',
  status VARCHAR(50) DEFAULT 'pending',
  priority_points INTEGER DEFAULT 0,
  
  -- Review Information
  submission_date TIMESTAMPTZ DEFAULT NOW(),
  reviewed_date TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  internal_notes TEXT,
  
  -- Documents (JSON array of {name, url, type, uploaded_at})
  documents JSONB DEFAULT '[]',
  
  -- Additional Information
  how_did_you_hear VARCHAR(255),
  special_requests TEXT,
  sibling_enrolled BOOLEAN DEFAULT FALSE,
  sibling_student_id VARCHAR(50),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_registration_status CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'enrolled', 'waitlisted'))
);

CREATE INDEX idx_registration_org ON registration_requests(organization_id);
CREATE INDEX idx_registration_status ON registration_requests(status);
CREATE INDEX idx_registration_academic_year ON registration_requests(academic_year);
CREATE INDEX idx_registration_email ON registration_requests(guardian_email);
CREATE INDEX idx_registration_submission_date ON registration_requests(submission_date);

COMMENT ON TABLE registration_requests IS 'Public registration submissions for 2026 academic year';
COMMENT ON COLUMN registration_requests.priority_points IS 'Priority scoring for waitlist (sibling=5, early=3, etc.)';

-- =====================================================
-- 7. ATTENDANCE TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  
  -- Attendance Details
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  notes TEXT,
  
  -- Recorded By
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(student_id, date),
  CONSTRAINT chk_attendance_status CHECK (status IN ('present', 'absent', 'late', 'excused', 'sick', 'early_pickup'))
);

CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_org ON attendance(organization_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);

COMMENT ON TABLE attendance IS 'Daily attendance tracking per student';

-- =====================================================
-- 8. STUDENT FEES & PAYMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Fee Details
  fee_type VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ZAR',
  
  -- Due Date & Payment Status
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  
  -- Payment Information
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  transaction_id VARCHAR(255),
  
  -- Discount/Adjustment
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_reason TEXT,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_fee_type CHECK (fee_type IN ('registration', 'monthly_tuition', 'annual_fee', 'activity_fee', 'lunch', 'transport', 'uniform', 'other')),
  CONSTRAINT chk_payment_status CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue', 'refunded', 'waived'))
);

CREATE INDEX idx_student_fees_student ON student_fees(student_id);
CREATE INDEX idx_student_fees_org ON student_fees(organization_id);
CREATE INDEX idx_student_fees_status ON student_fees(payment_status);
CREATE INDEX idx_student_fees_due_date ON student_fees(due_date);

COMMENT ON TABLE student_fees IS 'Fee management and payment tracking';

-- =====================================================
-- 9. COMMUNICATION LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Communication Details
  type VARCHAR(50) NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  method VARCHAR(50) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- Sender
  sent_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_comm_type CHECK (type IN ('announcement', 'alert', 'reminder', 'invitation', 'report')),
  CONSTRAINT chk_comm_method CHECK (method IN ('email', 'sms', 'push', 'in_app')),
  CONSTRAINT chk_comm_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced'))
);

CREATE INDEX idx_comm_log_org ON communication_log(organization_id);
CREATE INDEX idx_comm_log_student ON communication_log(student_id);
CREATE INDEX idx_comm_log_guardian ON communication_log(guardian_id);
CREATE INDEX idx_comm_log_sent_at ON communication_log(sent_at);

COMMENT ON TABLE communication_log IS 'Track all communications sent to parents/guardians';

-- =====================================================
-- 10. ROW-LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE preschools ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ORGANIZATIONS POLICIES
-- =====================================================

CREATE POLICY "principals_manage_own_org" ON organizations
  FOR ALL USING (principal_id = auth.uid());

CREATE POLICY "public_can_view_open_orgs" ON organizations
  FOR SELECT USING (enrollment_open = TRUE);

-- =====================================================
-- STUDENTS POLICIES
-- =====================================================

-- Guardians can view their own children
CREATE POLICY "guardians_view_own_children" ON students
  FOR SELECT USING (
    id IN (
      SELECT student_id FROM student_guardians WHERE guardian_id = auth.uid()
    )
  );

-- Teachers can view students in their classes
CREATE POLICY "teachers_view_class_students" ON students
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

-- Principals can manage all students in their organization
CREATE POLICY "principals_manage_org_students" ON students
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM organizations WHERE principal_id = auth.uid()
    )
  );

-- =====================================================
-- STUDENT_GUARDIANS POLICIES
-- =====================================================

CREATE POLICY "guardians_view_own_relationships" ON student_guardians
  FOR SELECT USING (guardian_id = auth.uid());

CREATE POLICY "principals_manage_org_guardians" ON student_guardians
  FOR ALL USING (
    student_id IN (
      SELECT id FROM students WHERE organization_id IN (
        SELECT id FROM organizations WHERE principal_id = auth.uid()
      )
    )
  );

-- =====================================================
-- REGISTRATION_REQUESTS POLICIES
-- =====================================================

-- Anyone can submit a registration request
CREATE POLICY "public_can_submit_registration" ON registration_requests
  FOR INSERT WITH CHECK (TRUE);

-- Users can view their own requests
CREATE POLICY "users_view_own_requests" ON registration_requests
  FOR SELECT USING (guardian_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Principals can manage registrations for their org
CREATE POLICY "principals_manage_registrations" ON registration_requests
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM organizations WHERE principal_id = auth.uid()
    )
  );

-- =====================================================
-- ATTENDANCE POLICIES
-- =====================================================

CREATE POLICY "guardians_view_own_child_attendance" ON attendance
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM student_guardians WHERE guardian_id = auth.uid()
    )
  );

CREATE POLICY "teachers_manage_class_attendance" ON attendance
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "principals_manage_org_attendance" ON attendance
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM organizations WHERE principal_id = auth.uid()
    )
  );

-- =====================================================
-- STUDENT_FEES POLICIES
-- =====================================================

CREATE POLICY "guardians_view_own_child_fees" ON student_fees
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM student_guardians WHERE guardian_id = auth.uid()
    )
  );

CREATE POLICY "principals_manage_org_fees" ON student_fees
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM organizations WHERE principal_id = auth.uid()
    )
  );

-- =====================================================
-- 11. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Auto-generate student_id
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER AS $$
DECLARE
  org_code VARCHAR(10);
  year VARCHAR(4);
  counter INT;
  new_id VARCHAR(50);
BEGIN
  -- Get organization school code
  SELECT school_code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  
  -- Use academic year
  year := NEW.academic_year;
  
  -- Get next counter for this org and year
  SELECT COUNT(*) + 1 INTO counter
  FROM students
  WHERE organization_id = NEW.organization_id
    AND academic_year = NEW.academic_year;
  
  -- Generate ID: ORG-YEAR-NNNN
  new_id := org_code || '-' || year || '-' || LPAD(counter::TEXT, 4, '0');
  
  NEW.student_id := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-generate student_id before insert
CREATE TRIGGER trg_generate_student_id
  BEFORE INSERT ON students
  FOR EACH ROW
  WHEN (NEW.student_id IS NULL)
  EXECUTE FUNCTION generate_student_id();

-- Function: Update enrollment counts
CREATE OR REPLACE FUNCTION update_enrollment_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update class current_students count
  IF TG_OP = 'INSERT' AND NEW.class_id IS NOT NULL THEN
    UPDATE classes SET current_students = current_students + 1 WHERE id = NEW.class_id;
  ELSIF TG_OP = 'DELETE' AND OLD.class_id IS NOT NULL THEN
    UPDATE classes SET current_students = current_students - 1 WHERE id = OLD.class_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.class_id != NEW.class_id THEN
    IF OLD.class_id IS NOT NULL THEN
      UPDATE classes SET current_students = current_students - 1 WHERE id = OLD.class_id;
    END IF;
    IF NEW.class_id IS NOT NULL THEN
      UPDATE classes SET current_students = current_students + 1 WHERE id = NEW.class_id;
    END IF;
  END IF;
  
  -- Update preschool current_enrollment
  IF TG_OP = 'INSERT' AND NEW.preschool_id IS NOT NULL THEN
    UPDATE preschools SET current_enrollment = current_enrollment + 1 WHERE id = NEW.preschool_id;
  ELSIF TG_OP = 'DELETE' AND OLD.preschool_id IS NOT NULL THEN
    UPDATE preschools SET current_enrollment = current_enrollment - 1 WHERE id = OLD.preschool_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.preschool_id != NEW.preschool_id THEN
    IF OLD.preschool_id IS NOT NULL THEN
      UPDATE preschools SET current_enrollment = current_enrollment - 1 WHERE id = OLD.preschool_id;
    END IF;
    IF NEW.preschool_id IS NOT NULL THEN
      UPDATE preschools SET current_enrollment = current_enrollment + 1 WHERE id = NEW.preschool_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update enrollment counts
CREATE TRIGGER trg_update_enrollment_counts
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_enrollment_counts();

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_preschools_updated_at BEFORE UPDATE ON preschools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_student_guardians_updated_at BEFORE UPDATE ON student_guardians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_registration_requests_updated_at BEFORE UPDATE ON registration_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_student_fees_updated_at BEFORE UPDATE ON student_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 12. SEED DATA (EXAMPLE)
-- =====================================================

-- Insert Young Eagles as flagship organization
INSERT INTO organizations (id, name, school_code, academic_year, enrollment_open, school_type, address, contact_email, contact_phone)
VALUES (
  gen_random_uuid(),
  'Young Eagles Education',
  'YE-2026',
  '2026',
  TRUE,
  'Preschool',
  '123 Education Street, Johannesburg, South Africa',
  'admin@youngeagles.org.za',
  '+27 11 123 4567'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

COMMENT ON SCHEMA public IS 'Student Registration System for 2026 - Multi-tenant preschool management';
