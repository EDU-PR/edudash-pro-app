-- Migration: Fix current_preschool_id function to also check profiles table
-- Issue: Principal users exist in profiles but not in legacy users table
-- This causes RLS policies to deny access because current_preschool_id() returns NULL

CREATE OR REPLACE FUNCTION public.current_preschool_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $function$
DECLARE
  preschool_id_claim TEXT;
  result_uuid UUID;
BEGIN
  -- Try to get preschool_id from JWT claims first
  preschool_id_claim := auth.jwt() ->> 'preschool_id';
  
  -- If found in JWT, convert to UUID and return
  IF preschool_id_claim IS NOT NULL AND preschool_id_claim != '' THEN
    BEGIN
      result_uuid := preschool_id_claim::UUID;
      RETURN result_uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- If conversion fails, fall through to fallback methods
      RAISE LOG 'Invalid UUID in JWT preschool_id claim: %', preschool_id_claim;
    END;
  END IF;
  
  -- Fallback: try organization_id claim
  preschool_id_claim := auth.jwt() ->> 'organization_id';
  IF preschool_id_claim IS NOT NULL AND preschool_id_claim != '' THEN
    BEGIN
      result_uuid := preschool_id_claim::UUID;
      RETURN result_uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE LOG 'Invalid UUID in JWT organization_id claim: %', preschool_id_claim;
    END;
  END IF;
  
  -- Fallback: lookup from profiles table using auth.uid()
  IF auth.uid() IS NOT NULL THEN
    -- Try profiles table first (newer system)
    SELECT COALESCE(organization_id, preschool_id) INTO result_uuid
    FROM profiles 
    WHERE id = auth.uid()
    LIMIT 1;
    
    IF result_uuid IS NOT NULL THEN
      RETURN result_uuid;
    END IF;
    
    -- Legacy fallback: lookup from users table
    SELECT COALESCE(organization_id, preschool_id) INTO result_uuid
    FROM users 
    WHERE auth_user_id = auth.uid() OR id = auth.uid()
    LIMIT 1;
    
    IF result_uuid IS NOT NULL THEN
      RETURN result_uuid;
    END IF;
  END IF;
  
  -- If all else fails, return NULL (will cause RLS to deny access)
  RAISE LOG 'No preschool_id found for user %', auth.uid();
  RETURN NULL;
END;
$function$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.current_preschool_id() IS 
'Returns the current user''s organization/preschool ID for RLS policies. 
Checks JWT claims first, then falls back to profiles table, then legacy users table.';
