-- ============================================================================
-- CRITICAL: Create secure RPC functions for DashToolRegistry
-- ============================================================================
-- Issue: DashToolRegistry uses SERVICE_ROLE_KEY in service layer
-- Fix: Create SECURITY DEFINER functions with proper auth checks
-- Priority: CRITICAL
-- Date: 2025-12-03
-- ============================================================================

-- ============================================================================
-- Function: Get textbook metadata (secure)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_textbook_metadata(
  p_textbook_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_textbook JSON;
BEGIN
  -- Verify authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required';
  END IF;

  -- Get textbook (no RLS check needed as textbooks are public educational resources)
  SELECT row_to_json(t.*)
  INTO v_textbook
  FROM textbooks t
  WHERE t.id = p_textbook_id;

  IF v_textbook IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Textbook not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'data', v_textbook
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_textbook_metadata(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_textbook_metadata(UUID) IS 
  'Securely fetch textbook metadata for AI tools. Uses SECURITY DEFINER with auth check.';

-- ============================================================================
-- Function: Log AI tool usage (secure)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_ai_tool_event(
  p_tool_name TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
BEGIN
  -- Verify authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required';
  END IF;

  -- Insert AI event
  INSERT INTO ai_events (
    user_id,
    event_type,
    tool_name,
    metadata,
    created_at
  ) VALUES (
    v_user_id,
    'tool_use',
    p_tool_name,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_event_id;

  RETURN json_build_object(
    'success', true,
    'event_id', v_event_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the main operation if logging fails
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.log_ai_tool_event(TEXT, JSONB) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.log_ai_tool_event(TEXT, JSONB) IS 
  'Securely log AI tool usage. Uses SECURITY DEFINER with auth check.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Created secure RPC functions for DashToolRegistry';
  RAISE NOTICE '   - get_textbook_metadata(uuid)';
  RAISE NOTICE '   - log_ai_tool_event(text, jsonb)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Both functions use SECURITY DEFINER with auth checks';
  RAISE NOTICE '📝 Update DashToolRegistry to use these instead of SERVICE_ROLE_KEY';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Update DashToolRegistry.ts to use these RPC functions
-- 2. Remove SERVICE_ROLE_KEY from DashToolRegistry.ts
-- 3. Test tool execution with new secure functions
-- ============================================================================
