-- RPC function to check if email exists (for real-time validation)
-- Checks profiles table as source of truth (users table is deprecated)
-- Returns true if email exists, false otherwise
-- SECURITY: Uses SECURITY DEFINER but only returns boolean, no sensitive data

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN := false;
BEGIN
  -- Normalize email (lowercase, trim)
  p_email := LOWER(TRIM(p_email));
  
  -- Check in profiles table (source of truth - users table is deprecated)
  SELECT EXISTS(
    SELECT 1 
    FROM public.profiles 
    WHERE LOWER(email) = p_email
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- Grant execute to authenticated and anon users (needed for registration)
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon;

-- Add comment
COMMENT ON FUNCTION public.check_email_exists(TEXT) IS 'Checks if an email exists in profiles table (source of truth). Used for real-time email validation during registration.';

