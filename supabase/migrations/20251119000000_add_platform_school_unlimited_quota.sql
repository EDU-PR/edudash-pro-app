-- Add unlimited quota bypass for platform schools
-- Community School and EduDash Pro Main School should never hit limits

CREATE OR REPLACE FUNCTION check_ai_usage_limit(
  p_user_id UUID,
  p_request_type VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_usage RECORD;
  v_limits RECORD;
  v_can_proceed BOOLEAN := false;
  v_remaining INTEGER := 0;
  v_limit INTEGER := 0;
  v_preschool_id UUID;
BEGIN
  -- Check if user belongs to a platform school (unlimited access)
  SELECT preschool_id INTO v_preschool_id
  FROM profiles
  WHERE id = p_user_id;
  
  -- BYPASS 1: Community School (platform demo)
  IF v_preschool_id = '00000000-0000-0000-0000-000000000001'::uuid THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', -1,
      'limit', -1,
      'current_tier', 'community_unlimited',
      'upgrade_available', false
    );
  END IF;
  
  -- BYPASS 2: EduDash Pro Main School (platform admin)
  IF v_preschool_id = '00000000-0000-0000-0000-000000000003'::uuid THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', -1,
      'limit', -1,
      'current_tier', 'platform_admin_unlimited',
      'upgrade_available', false
    );
  END IF;
  
  -- Get or create user usage record
  INSERT INTO user_ai_usage (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Reset counters if needed
  UPDATE user_ai_usage
  SET 
    exams_generated_this_month = 0,
    explanations_requested_this_month = 0,
    last_monthly_reset_at = NOW()
  WHERE user_id = p_user_id
    AND last_monthly_reset_at < (NOW() - INTERVAL '30 days');
  
  UPDATE user_ai_usage
  SET 
    chat_messages_today = 0,
    last_daily_reset_at = NOW()
  WHERE user_id = p_user_id
    AND last_daily_reset_at < (NOW() - INTERVAL '1 day');
  
  -- Get current usage
  SELECT * INTO v_usage
  FROM user_ai_usage
  WHERE user_id = p_user_id;
  
  -- Get tier limits
  SELECT * INTO v_limits
  FROM ai_usage_tiers
  WHERE tier_name = v_usage.current_tier
    AND is_active = true;
  
  -- Check limits based on request type
  IF p_request_type = 'exam_generation' THEN
    v_limit := v_limits.exams_per_month;
    v_remaining := v_limit - v_usage.exams_generated_this_month;
    v_can_proceed := v_usage.exams_generated_this_month < v_limit;
  ELSIF p_request_type = 'explanation' THEN
    v_limit := v_limits.explanations_per_month;
    v_remaining := v_limit - v_usage.explanations_requested_this_month;
    v_can_proceed := v_usage.explanations_requested_this_month < v_limit;
  ELSIF p_request_type = 'chat_message' THEN
    v_limit := v_limits.chat_messages_per_day;
    v_remaining := v_limit - v_usage.chat_messages_today;
    v_can_proceed := v_usage.chat_messages_today < v_limit;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_can_proceed,
    'remaining', v_remaining,
    'limit', v_limit,
    'current_tier', v_usage.current_tier,
    'upgrade_available', v_usage.current_tier IN ('free', 'trial')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_ai_usage_limit IS 'Checks if user can make an AI request based on their tier limits. Bypasses limits for platform schools (Community School, EduDash Pro Main School).';
