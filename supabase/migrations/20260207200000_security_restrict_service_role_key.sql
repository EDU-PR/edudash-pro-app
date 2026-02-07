-- Migration: Restrict get_service_role_key RPC
-- CRITICAL SECURITY FIX: This function returns vault secrets and must
-- only be callable by service_role, never by authenticated users.

-- Revoke execute from all roles
REVOKE EXECUTE ON FUNCTION public.get_service_role_key()
    FROM PUBLIC, authenticated, anon;

-- Add internal guard to the function body
CREATE OR REPLACE FUNCTION public.get_service_role_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Only allow service_role to call this function
    IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' != 'service_role' THEN
        RAISE EXCEPTION 'Access denied: only service_role may call get_service_role_key';
    END IF;

    RETURN (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
        LIMIT 1
    );
END;
$$;

-- Re-grant only to service_role (postgres role used by service key)
GRANT EXECUTE ON FUNCTION public.get_service_role_key() TO service_role;
