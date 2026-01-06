-- Migration: Create aftercare_registrations table
-- Description: Store aftercare program registrations for EduDash Pro Community School
-- Date: 2026-01-06

-- Create aftercare_registrations table
CREATE TABLE IF NOT EXISTS aftercare_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  
  -- Parent Details
  parent_first_name TEXT NOT NULL,
  parent_last_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_id_number TEXT,
  
  -- Child Details
  child_first_name TEXT NOT NULL,
  child_last_name TEXT NOT NULL,
  child_grade TEXT NOT NULL CHECK (child_grade IN ('R', '1', '2', '3', '4', '5', '6', '7')),
  child_date_of_birth DATE,
  child_allergies TEXT,
  child_medical_conditions TEXT,
  
  -- Emergency Contact
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  emergency_contact_relation TEXT NOT NULL,
  
  -- Registration Info
  how_did_you_hear TEXT,
  registration_fee DECIMAL(10, 2) DEFAULT 200.00,
  registration_fee_original DECIMAL(10, 2) DEFAULT 400.00,
  promotion_code TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'enrolled', 'cancelled', 'waitlisted')),
  payment_date TIMESTAMPTZ,
  payment_reference TEXT,
  
  -- Linked accounts (optional - when parent creates app account)
  parent_user_id UUID REFERENCES auth.users(id),
  student_id UUID REFERENCES students(id),
  
  -- Audit
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_aftercare_reg_preschool ON aftercare_registrations(preschool_id);
CREATE INDEX idx_aftercare_reg_status ON aftercare_registrations(status);
CREATE INDEX idx_aftercare_reg_email ON aftercare_registrations(parent_email);
CREATE INDEX idx_aftercare_reg_phone ON aftercare_registrations(parent_phone);
CREATE INDEX idx_aftercare_reg_grade ON aftercare_registrations(child_grade);
CREATE INDEX idx_aftercare_reg_created ON aftercare_registrations(created_at DESC);

-- Enable RLS
ALTER TABLE aftercare_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can insert (public registration form)
CREATE POLICY "Anyone can register for aftercare"
  ON aftercare_registrations
  FOR INSERT
  WITH CHECK (true);

-- School admins can view all registrations for their school
CREATE POLICY "School admins can view registrations"
  ON aftercare_registrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.user_id = auth.uid()
        AND t.preschool_id = aftercare_registrations.preschool_id
        AND t.role IN ('principal', 'admin')
    )
  );

-- School admins can update registrations
CREATE POLICY "School admins can update registrations"
  ON aftercare_registrations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.user_id = auth.uid()
        AND t.preschool_id = aftercare_registrations.preschool_id
        AND t.role IN ('principal', 'admin')
    )
  );

-- Parents can view their own registrations (by email match)
CREATE POLICY "Parents can view own registrations"
  ON aftercare_registrations
  FOR SELECT
  USING (
    parent_user_id = auth.uid()
    OR
    parent_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_aftercare_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_aftercare_registrations_updated_at
  BEFORE UPDATE ON aftercare_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_aftercare_registrations_updated_at();

-- Add comment
COMMENT ON TABLE aftercare_registrations IS 'Aftercare program registrations for schools. Initially for EduDash Pro Community School early bird special.';
