-- Fix get_my_profile to return SETOF instead of single row
-- This prevents 406 errors when the function returns NULL
-- PostgREST can't serialize NULL with application/vnd.pgrst.object+json

-- Drop the old function
DROP FUNCTION IF EXISTS public.get_my_profile();

-- Create new version that returns SETOF (table) instead of single row
-- This allows PostgREST to return empty result set instead of NULL
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Get the current authenticated user ID
    current_user_id := auth.uid();
    
    -- Return empty result set if no authenticated user (instead of NULL)
    IF current_user_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Return the user's profile as a result set
    -- First try to match by profile.id (which should equal auth.users.id)
    RETURN QUERY
    SELECT p.*
    FROM profiles p
    WHERE p.id = current_user_id
    LIMIT 1;
    
    -- If no rows returned, try auth_user_id column (fallback for older records)
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT p.*
        FROM profiles p
        WHERE p.auth_user_id = current_user_id
        LIMIT 1;
    END IF;
    
    -- If still no rows, return empty result set (not NULL)
    -- This prevents 406 errors in PostgREST
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Update comment
COMMENT ON FUNCTION public.get_my_profile() IS 
'Returns the profile of the currently authenticated user as a result set. 
Returns empty result set (not NULL) if user not found, preventing 406 errors in PostgREST.
Used by fetchEnhancedUserProfile in the app.';

