-- Auto-fill requester_id trigger for join_requests
-- Date: 2026-01-04
-- Purpose: Fix 400 errors when old app versions don't provide requester_id
-- This trigger ensures the valid_requester constraint is satisfied

CREATE OR REPLACE FUNCTION auto_fill_requester_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If requester_id is not provided, use the authenticated user's ID
  IF NEW.requester_id IS NULL THEN
    NEW.requester_id := auth.uid();
  END IF;
  
  -- If invited_by is provided but requester_id is still null, use invited_by
  -- (for admin-created invites where the admin is both inviter and requester)
  IF NEW.requester_id IS NULL AND NEW.invited_by IS NOT NULL THEN
    NEW.requester_id := NEW.invited_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger to run BEFORE INSERT
DROP TRIGGER IF EXISTS tr_auto_fill_requester_id ON join_requests;
CREATE TRIGGER tr_auto_fill_requester_id
  BEFORE INSERT ON join_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_requester_id();
