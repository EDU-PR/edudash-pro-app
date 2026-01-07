-- Migration: Add registration fee support to child_registration_requests
-- This aligns in-app registration with the website registration flow

-- =============================================================================
-- 1. Add registration fee columns to child_registration_requests
-- =============================================================================

ALTER TABLE child_registration_requests
ADD COLUMN IF NOT EXISTS registration_fee_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS proof_of_payment_url TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Add comment for documentation
COMMENT ON COLUMN child_registration_requests.registration_fee_amount IS 'Registration fee amount (from school settings or fee_structures)';
COMMENT ON COLUMN child_registration_requests.registration_fee_paid IS 'Whether parent claims to have paid';
COMMENT ON COLUMN child_registration_requests.proof_of_payment_url IS 'URL to uploaded proof of payment document';
COMMENT ON COLUMN child_registration_requests.payment_method IS 'Payment method: eft, cash, card, payfast';
COMMENT ON COLUMN child_registration_requests.payment_verified IS 'Whether principal has verified the payment';
COMMENT ON COLUMN child_registration_requests.payment_verified_by IS 'Principal who verified the payment';
COMMENT ON COLUMN child_registration_requests.payment_verified_at IS 'When payment was verified';
COMMENT ON COLUMN child_registration_requests.payment_reference IS 'Payment reference number';

-- =============================================================================
-- 2. Create registration fee structure for schools that don't have one
-- =============================================================================

-- Add registration fee type if it doesn't exist for Young Eagles
INSERT INTO fee_structures (
  preschool_id,
  name,
  description,
  amount,
  fee_type,
  frequency,
  mandatory,
  is_active,
  effective_from,
  created_by
)
SELECT 
  'ba79097c-1b93-4b48-bcbe-df73878ab4d1',
  'Registration Fee',
  'One-time registration fee for new students',
  250.00, -- Default registration fee amount
  'registration',
  'once',
  true,
  true,
  CURRENT_DATE,
  '136cf31c-b37c-45c0-9cf7-755bd1b9afbf' -- Principal user
WHERE NOT EXISTS (
  SELECT 1 FROM fee_structures 
  WHERE preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1' 
  AND fee_type = 'registration'
);

-- =============================================================================
-- 3. Function to get school's registration fee amount
-- =============================================================================

CREATE OR REPLACE FUNCTION get_registration_fee(p_preschool_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fee DECIMAL(10,2);
BEGIN
  -- Try to get from fee_structures
  SELECT amount INTO v_fee
  FROM fee_structures
  WHERE preschool_id = p_preschool_id
    AND fee_type = 'registration'
    AND is_active = true
  LIMIT 1;
  
  -- If not found, check preschools table for default
  IF v_fee IS NULL THEN
    SELECT COALESCE(
      (settings->>'registration_fee')::DECIMAL,
      0
    ) INTO v_fee
    FROM preschools
    WHERE id = p_preschool_id;
  END IF;
  
  RETURN COALESCE(v_fee, 0);
END;
$$;

-- =============================================================================
-- 4. Function to auto-assign fees when student is approved
-- =============================================================================

CREATE OR REPLACE FUNCTION assign_initial_student_fees(
  p_student_id UUID,
  p_preschool_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fee_structure RECORD;
  v_current_month DATE;
  v_due_date DATE;
BEGIN
  -- Get current month start
  v_current_month := date_trunc('month', CURRENT_DATE)::DATE;
  
  -- Loop through all active mandatory fees for this school
  FOR v_fee_structure IN
    SELECT id, fee_type, amount, frequency, due_day
    FROM fee_structures
    WHERE preschool_id = p_preschool_id
      AND is_active = true
      AND mandatory = true
  LOOP
    -- Calculate due date based on frequency
    IF v_fee_structure.frequency = 'once' THEN
      -- One-time fees due immediately
      v_due_date := CURRENT_DATE + INTERVAL '7 days';
    ELSIF v_fee_structure.frequency = 'monthly' THEN
      -- Monthly fees due on the due_day of next month
      v_due_date := (v_current_month + INTERVAL '1 month')::DATE;
      IF v_fee_structure.due_day IS NOT NULL THEN
        v_due_date := make_date(
          EXTRACT(YEAR FROM v_due_date)::INT,
          EXTRACT(MONTH FROM v_due_date)::INT,
          LEAST(v_fee_structure.due_day, 28)
        );
      END IF;
    ELSIF v_fee_structure.frequency = 'quarterly' THEN
      v_due_date := (v_current_month + INTERVAL '3 months')::DATE;
    ELSIF v_fee_structure.frequency = 'annually' THEN
      v_due_date := (v_current_month + INTERVAL '1 year')::DATE;
    ELSE
      v_due_date := (v_current_month + INTERVAL '1 month')::DATE;
    END IF;
    
    -- Insert fee record if it doesn't exist
    INSERT INTO student_fees (
      student_id,
      fee_structure_id,
      amount,
      final_amount,
      due_date,
      status,
      amount_outstanding
    )
    SELECT
      p_student_id,
      v_fee_structure.id,
      v_fee_structure.amount,
      v_fee_structure.amount,
      v_due_date,
      'pending',
      v_fee_structure.amount
    WHERE NOT EXISTS (
      SELECT 1 FROM student_fees
      WHERE student_id = p_student_id
        AND fee_structure_id = v_fee_structure.id
        AND date_trunc('month', due_date) = date_trunc('month', v_due_date)
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- 5. Update RLS policies for the new columns
-- =============================================================================

-- Parents can view their own registration requests (including payment info)
DROP POLICY IF EXISTS "Parents can view own child registration requests" ON child_registration_requests;
CREATE POLICY "Parents can view own child registration requests"
ON child_registration_requests FOR SELECT
USING (parent_id = auth.uid());

-- Parents can insert registration requests with payment info
DROP POLICY IF EXISTS "Parents can insert child registration requests" ON child_registration_requests;
CREATE POLICY "Parents can insert child registration requests"
ON child_registration_requests FOR INSERT
WITH CHECK (parent_id = auth.uid());

-- Parents can update their own pending requests (e.g., upload POP)
DROP POLICY IF EXISTS "Parents can update own pending requests" ON child_registration_requests;
CREATE POLICY "Parents can update own pending requests"
ON child_registration_requests FOR UPDATE
USING (
  parent_id = auth.uid() 
  AND status = 'pending'
)
WITH CHECK (
  parent_id = auth.uid()
  AND status = 'pending'
);

-- Principals can view all requests for their school
DROP POLICY IF EXISTS "Principals can view school registration requests" ON child_registration_requests;
CREATE POLICY "Principals can view school registration requests"
ON child_registration_requests FOR SELECT
USING (
  preschool_id IN (
    SELECT preschool_id FROM profiles WHERE id = auth.uid() AND role IN ('principal', 'principal_admin', 'super_admin')
  )
);

-- Principals can update requests (approve/reject/verify payment)
DROP POLICY IF EXISTS "Principals can update school registration requests" ON child_registration_requests;
CREATE POLICY "Principals can update school registration requests"
ON child_registration_requests FOR UPDATE
USING (
  preschool_id IN (
    SELECT preschool_id FROM profiles WHERE id = auth.uid() AND role IN ('principal', 'principal_admin', 'super_admin')
  )
);

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION get_registration_fee(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_initial_student_fees(UUID, UUID) TO authenticated;
