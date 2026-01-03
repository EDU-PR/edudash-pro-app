-- ============================================================================
-- Migration: Add update_school_settings RPC function
-- 
-- Creates the missing RPC function that allows principals to update
-- school settings through the client API with proper RBAC enforcement.
-- 
-- NOTE: This updates the preschools.settings JSONB column, NOT the
-- school_settings table (which is used for petty cash settings).
-- ============================================================================

-- Function to update school settings (RBAC enforced)
CREATE OR REPLACE FUNCTION update_school_settings(
  p_preschool_id UUID,
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_settings JSONB;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get user's role and verify they belong to this preschool
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id 
    AND (preschool_id = p_preschool_id OR organization_id = p_preschool_id);
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'User does not belong to this school';
  END IF;
  
  -- Only principals can update school settings
  IF v_user_role NOT IN ('principal', 'principal_admin', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to update school settings';
  END IF;
  
  -- Get current settings from preschools table
  SELECT COALESCE(settings, '{}'::jsonb) INTO v_current_settings
  FROM preschools
  WHERE id = p_preschool_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;
  
  -- Merge patch into current settings (deep merge at top level)
  v_result := v_current_settings || p_patch;
  
  -- Update preschools.settings
  UPDATE preschools
  SET settings = v_result,
      updated_at = now()
  WHERE id = p_preschool_id;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users (RBAC enforced inside function)
GRANT EXECUTE ON FUNCTION update_school_settings(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION update_school_settings IS 'Update preschool settings JSONB with RBAC enforcement. Only principals and admins can update.';
