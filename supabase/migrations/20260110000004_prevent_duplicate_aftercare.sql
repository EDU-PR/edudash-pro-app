-- Prevent Duplicate Aftercare Registrations
-- ============================================================================
-- Created: 2026-01-10
-- Purpose: Prevent multiple registrations for the same child from the same parent
-- ============================================================================

-- Create unique partial index to prevent duplicates
-- Only applies when status is NOT 'cancelled' (allows re-registration after cancellation)
CREATE UNIQUE INDEX IF NOT EXISTS idx_aftercare_registrations_unique_child
ON aftercare_registrations (
  parent_email,
  child_first_name,
  child_last_name,
  COALESCE(child_date_of_birth, '1900-01-01'::date),
  preschool_id
)
WHERE status != 'cancelled';

-- Add function to check for duplicates before insert (additional safety)
CREATE OR REPLACE FUNCTION check_duplicate_aftercare_registration()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Only check if status is not cancelled
  IF NEW.status != 'cancelled' THEN
    -- Check if a registration already exists for this child from this parent
    SELECT COUNT(*) INTO existing_count
    FROM aftercare_registrations
    WHERE parent_email = NEW.parent_email
      AND child_first_name = NEW.child_first_name
      AND child_last_name = NEW.child_last_name
      AND COALESCE(child_date_of_birth, '1900-01-01'::date) = COALESCE(NEW.child_date_of_birth, '1900-01-01'::date)
      AND preschool_id = NEW.preschool_id
      AND status != 'cancelled'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Duplicate registration: A registration for this child already exists. Please contact the school if you need to update your registration.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS prevent_duplicate_aftercare_insert ON aftercare_registrations;
CREATE TRIGGER prevent_duplicate_aftercare_insert
  BEFORE INSERT ON aftercare_registrations
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_aftercare_registration();

-- Create trigger for UPDATE operations (in case status changes from cancelled)
DROP TRIGGER IF EXISTS prevent_duplicate_aftercare_update ON aftercare_registrations;
CREATE TRIGGER prevent_duplicate_aftercare_update
  BEFORE UPDATE ON aftercare_registrations
  FOR EACH ROW
  WHEN (NEW.status != 'cancelled')
  EXECUTE FUNCTION check_duplicate_aftercare_registration();

-- Add helpful view to identify any existing duplicates (for cleanup)
CREATE OR REPLACE VIEW duplicate_aftercare_registrations AS
SELECT 
  parent_email,
  child_first_name,
  child_last_name,
  child_date_of_birth,
  preschool_id,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at) as registration_ids,
  array_agg(status ORDER BY created_at) as statuses,
  array_agg(created_at ORDER BY created_at) as created_dates
FROM aftercare_registrations
WHERE status != 'cancelled'
GROUP BY parent_email, child_first_name, child_last_name, child_date_of_birth, preschool_id
HAVING COUNT(*) > 1;

COMMENT ON VIEW duplicate_aftercare_registrations IS 
'Shows duplicate aftercare registrations that need to be cleaned up. This should be empty after applying the unique constraint.';

-- Grant access to the view
GRANT SELECT ON duplicate_aftercare_registrations TO authenticated;
