-- =============================================================================
-- Migration: fix_age_fee_guardrails
-- Purpose:
--   1. Fix 15 wrong fee assignments (children charged Infant rate at age 3-6)
--   2. Add age_min_months / age_max_months columns to fee_structures
--   3. Create get_tuition_fee_for_age() function — single source of truth
--   4. Create auto-correct trigger on student_fees INSERT/UPDATE
--   5. Add advance_payment_months to pop_uploads for future-month POPs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add structured age range columns to fee_structures
-- ---------------------------------------------------------------------------
ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS age_min_months integer,
  ADD COLUMN IF NOT EXISTS age_max_months integer;

COMMENT ON COLUMN fee_structures.age_min_months IS 'Minimum age in months (inclusive) for this fee tier';
COMMENT ON COLUMN fee_structures.age_max_months IS 'Maximum age in months (inclusive) for this fee tier';

-- Backfill the existing Young Eagles fee tiers
UPDATE fee_structures SET age_min_months = 6, age_max_months = 11
WHERE name ILIKE '%Infant%' AND fee_type = 'tuition' AND is_active = true;

UPDATE fee_structures SET age_min_months = 12, age_max_months = 47
WHERE name ILIKE '%1-3%' AND fee_type = 'tuition' AND is_active = true;

UPDATE fee_structures SET age_min_months = 48, age_max_months = 83
WHERE name ILIKE '%4-6%' AND fee_type = 'tuition' AND is_active = true;

-- ---------------------------------------------------------------------------
-- 2. get_tuition_fee_for_age() — deterministic fee lookup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_tuition_fee_for_age(
  p_preschool_id uuid,
  p_date_of_birth date,
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  fee_structure_id uuid,
  fee_name text,
  fee_amount numeric
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_age_months integer;
BEGIN
  -- Calculate age in months
  v_age_months := (
    EXTRACT(YEAR FROM age(p_as_of, p_date_of_birth)) * 12 +
    EXTRACT(MONTH FROM age(p_as_of, p_date_of_birth))
  )::integer;

  RETURN QUERY
  SELECT fs.id, fs.name, fs.amount
  FROM fee_structures fs
  WHERE fs.preschool_id = p_preschool_id
    AND fs.fee_type = 'tuition'
    AND fs.is_active = true
    AND fs.age_min_months IS NOT NULL
    AND fs.age_max_months IS NOT NULL
    AND v_age_months >= fs.age_min_months
    AND v_age_months <= fs.age_max_months
  ORDER BY
    -- Prefer narrowest matching range
    (fs.age_max_months - fs.age_min_months) ASC,
    -- Then most recently effective
    fs.effective_from DESC NULLS LAST,
    fs.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_tuition_fee_for_age IS
  'Returns the correct tuition fee structure for a child based on their age. '
  'Uses age_min_months / age_max_months on fee_structures for deterministic matching.';

-- ---------------------------------------------------------------------------
-- 3. Fix wrong fee assignments — update PENDING/OVERDUE fees only
--    (paid fees are historical records and stay as-is)
-- ---------------------------------------------------------------------------

-- Fix children age 4-6 wrongly on Infant tier (R850 → R680)
UPDATE student_fees sf
SET
  fee_structure_id = correct.fee_structure_id,
  amount = correct.fee_amount,
  final_amount = correct.fee_amount,
  amount_outstanding = correct.fee_amount - COALESCE(sf.amount_paid, 0)
FROM students s,
  LATERAL get_tuition_fee_for_age(s.preschool_id, s.date_of_birth) correct
WHERE sf.student_id = s.id
  AND s.is_active = true
  AND sf.status IN ('pending', 'overdue')
  AND sf.fee_structure_id IN (
    SELECT id FROM fee_structures WHERE fee_type = 'tuition'
  )
  AND sf.amount != correct.fee_amount
  AND correct.fee_structure_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Trigger: auto-correct fee on INSERT into student_fees
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_validate_student_fee()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_student RECORD;
  v_correct RECORD;
  v_fee_type text;
BEGIN
  -- Only validate tuition fees
  SELECT fs.fee_type INTO v_fee_type
  FROM fee_structures fs WHERE fs.id = NEW.fee_structure_id;

  IF v_fee_type IS DISTINCT FROM 'tuition' THEN
    RETURN NEW;
  END IF;

  -- Look up student DOB
  SELECT s.date_of_birth, s.preschool_id
  INTO v_student
  FROM students s WHERE s.id = NEW.student_id;

  IF v_student.date_of_birth IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get correct fee for this child's age
  SELECT * INTO v_correct
  FROM get_tuition_fee_for_age(
    v_student.preschool_id,
    v_student.date_of_birth,
    COALESCE(NEW.due_date, CURRENT_DATE)
  );

  -- If we found a correct fee and it differs, auto-correct
  IF v_correct.fee_structure_id IS NOT NULL
     AND v_correct.fee_structure_id != NEW.fee_structure_id THEN
    NEW.fee_structure_id := v_correct.fee_structure_id;
    NEW.amount := v_correct.fee_amount;
    NEW.final_amount := COALESCE(NEW.final_amount, v_correct.fee_amount);
    NEW.amount_outstanding := v_correct.fee_amount - COALESCE(NEW.amount_paid, 0);
    RAISE NOTICE 'Auto-corrected fee for student % to % (R%)',
      NEW.student_id, v_correct.fee_name, v_correct.fee_amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_student_fee_insert ON student_fees;
CREATE TRIGGER trg_validate_student_fee_insert
  BEFORE INSERT ON student_fees
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_student_fee();

-- ---------------------------------------------------------------------------
-- 5. Advance payment support on pop_uploads
-- ---------------------------------------------------------------------------
ALTER TABLE pop_uploads
  ADD COLUMN IF NOT EXISTS advance_months integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS covers_months date[] DEFAULT '{}';

COMMENT ON COLUMN pop_uploads.advance_months IS 'Number of months this POP covers beyond the current month';
COMMENT ON COLUMN pop_uploads.covers_months IS 'Array of billing_month dates this POP payment covers';

-- ---------------------------------------------------------------------------
-- 6. RPC: assign_correct_fee_for_student — callable from client
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_correct_fee_for_student(
  p_student_id uuid,
  p_billing_month date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_student RECORD;
  v_correct RECORD;
  v_existing RECORD;
BEGIN
  -- Load student
  SELECT id, date_of_birth, preschool_id, first_name, last_name
  INTO v_student
  FROM students WHERE id = p_student_id;

  IF v_student IS NULL THEN
    RETURN jsonb_build_object('error', 'Student not found');
  END IF;

  IF v_student.date_of_birth IS NULL THEN
    RETURN jsonb_build_object('error', 'Student has no date of birth set');
  END IF;

  -- Get correct fee
  SELECT * INTO v_correct
  FROM get_tuition_fee_for_age(v_student.preschool_id, v_student.date_of_birth, p_billing_month);

  IF v_correct.fee_structure_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No matching fee structure found for this age');
  END IF;

  -- Check for existing fee for this month
  SELECT id, amount, status INTO v_existing
  FROM student_fees
  WHERE student_id = p_student_id
    AND billing_month = p_billing_month
    AND category_code = 'tuition'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    -- Update existing
    UPDATE student_fees
    SET fee_structure_id = v_correct.fee_structure_id,
        amount = v_correct.fee_amount,
        final_amount = v_correct.fee_amount,
        amount_outstanding = v_correct.fee_amount - COALESCE(amount_paid, 0)
    WHERE id = v_existing.id
      AND status IN ('pending', 'overdue');

    RETURN jsonb_build_object(
      'action', 'updated',
      'student', v_student.first_name || ' ' || v_student.last_name,
      'fee_name', v_correct.fee_name,
      'amount', v_correct.fee_amount,
      'billing_month', p_billing_month
    );
  ELSE
    -- Insert new
    INSERT INTO student_fees (
      student_id, fee_structure_id, amount, final_amount,
      due_date, billing_month, status, amount_outstanding, category_code
    ) VALUES (
      p_student_id, v_correct.fee_structure_id, v_correct.fee_amount,
      v_correct.fee_amount, p_billing_month, p_billing_month,
      'pending', v_correct.fee_amount, 'tuition'
    );

    RETURN jsonb_build_object(
      'action', 'created',
      'student', v_student.first_name || ' ' || v_student.last_name,
      'fee_name', v_correct.fee_name,
      'amount', v_correct.fee_amount,
      'billing_month', p_billing_month
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION assign_correct_fee_for_student IS
  'Assigns or corrects the tuition fee for a student for a given billing month. '
  'Uses age-based fee lookup. Can be called by principals/admins.';

-- Grant execute to authenticated users (RLS on underlying tables still applies)
GRANT EXECUTE ON FUNCTION assign_correct_fee_for_student TO authenticated;
GRANT EXECUTE ON FUNCTION get_tuition_fee_for_age TO authenticated;
