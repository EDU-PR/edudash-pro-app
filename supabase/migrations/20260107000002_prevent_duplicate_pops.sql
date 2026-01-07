-- ============================================================================
-- Prevent Duplicate POP Uploads Migration
-- ============================================================================
-- Created: 2026-01-07
-- Purpose: Prevent parents from uploading multiple POPs for the same month
-- ============================================================================

-- Add unique index to prevent duplicate POPs for the same student in the same month
-- Only applies when status is 'pending' or 'approved' (rejected POPs can be re-uploaded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pop_uploads_unique_month 
ON pop_uploads (
  student_id, 
  DATE_TRUNC('month', payment_date)
)
WHERE status IN ('pending', 'approved');

-- Add helpful comment
COMMENT ON INDEX idx_pop_uploads_unique_month IS 
'Prevents duplicate POP uploads for the same student in the same month when status is pending or approved. Rejected POPs can be re-uploaded.';

-- Add function to check for duplicates before insert (additional safety)
CREATE OR REPLACE FUNCTION check_duplicate_pop_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if status is pending or approved
  IF NEW.status IN ('pending', 'approved') THEN
    -- Check if a POP already exists for this student in the same month
    IF EXISTS (
      SELECT 1 
      FROM pop_uploads
      WHERE student_id = NEW.student_id
        AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', NEW.payment_date)
        AND status IN ('pending', 'approved')
        AND id != NEW.id  -- Exclude current record on UPDATE
    ) THEN
      RAISE EXCEPTION 'A payment upload already exists for this month. Please wait for it to be reviewed or contact the school.'
        USING HINT = 'student_id: %, payment_month: %', NEW.student_id, DATE_TRUNC('month', NEW.payment_date);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS prevent_duplicate_pop_insert ON pop_uploads;
CREATE TRIGGER prevent_duplicate_pop_insert
  BEFORE INSERT ON pop_uploads
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_pop_upload();

-- Create trigger for UPDATE operations (in case status changes)
DROP TRIGGER IF EXISTS prevent_duplicate_pop_update ON pop_uploads;
CREATE TRIGGER prevent_duplicate_pop_update
  BEFORE UPDATE ON pop_uploads
  FOR EACH ROW
  WHEN (NEW.status IN ('pending', 'approved'))
  EXECUTE FUNCTION check_duplicate_pop_upload();

-- Add helpful view to identify any remaining duplicates
CREATE OR REPLACE VIEW duplicate_pops AS
SELECT 
  s.first_name,
  s.last_name,
  s.id AS student_id,
  DATE_TRUNC('month', pop.payment_date) AS payment_month,
  COUNT(*) AS upload_count,
  STRING_AGG(pop.id::TEXT, ', ') AS pop_ids,
  STRING_AGG(pop.status::TEXT, ', ') AS statuses,
  STRING_AGG(pop.payment_amount::TEXT, ', ') AS amounts
FROM pop_uploads pop
JOIN students s ON s.id = pop.student_id
WHERE pop.status IN ('pending', 'approved')
GROUP BY s.id, s.first_name, s.last_name, DATE_TRUNC('month', pop.payment_date)
HAVING COUNT(*) > 1
ORDER BY s.last_name, payment_month DESC;

COMMENT ON VIEW duplicate_pops IS 
'Shows students with multiple pending/approved POP uploads in the same month. This should be empty after cleanup.';

-- Grant access to the view
GRANT SELECT ON duplicate_pops TO authenticated;
