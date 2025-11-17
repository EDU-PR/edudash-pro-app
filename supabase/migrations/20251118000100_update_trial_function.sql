-- Update start_user_trial function to check trial_usage_log
DROP FUNCTION IF EXISTS start_user_trial(UUID, INT, TEXT);

CREATE OR REPLACE FUNCTION start_user_trial(
  target_user_id UUID,
  trial_days INT DEFAULT 7,
  plan_tier TEXT DEFAULT 'premium'
) RETURNS JSONB AS $$
DECLARE
  v_user_email TEXT;
  v_user_phone TEXT;
  v_has_used_trial BOOLEAN;
  v_trial_tier TEXT;
BEGIN
  -- Get user email and phone
  SELECT email, phone INTO v_user_email, v_user_phone
  FROM profiles
  WHERE id = target_user_id;

  -- Check if trial already used (by email, phone, or user_id)
  SELECT has_used_trial(v_user_email, v_user_phone, NULL) INTO v_has_used_trial;
  
  IF v_has_used_trial THEN
    RAISE EXCEPTION 'User has already used their trial period';
  END IF;

  -- Map plan_tier to tier_name_aligned enum
  v_trial_tier := CASE plan_tier
    WHEN 'premium' THEN 'parent_plus'
    WHEN 'starter' THEN 'parent_starter'
    ELSE 'parent_starter'
  END;

  -- Set trial in user_ai_tiers
  INSERT INTO user_ai_tiers (
    user_id,
    tier,
    assigned_reason,
    is_active,
    trial_ends_at,
    metadata
  ) VALUES (
    target_user_id,
    v_trial_tier,
    'Trial activation',
    true,
    NOW() + (trial_days || ' days')::INTERVAL,
    jsonb_build_object(
      'trial_started_at', NOW(),
      'trial_days', trial_days,
      'plan_tier', plan_tier
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier = v_trial_tier,
    assigned_reason = 'Trial activation',
    is_active = true,
    trial_ends_at = NOW() + (trial_days || ' days')::INTERVAL,
    metadata = jsonb_build_object(
      'trial_started_at', NOW(),
      'trial_days', trial_days,
      'plan_tier', plan_tier
    ),
    updated_at = NOW();

  -- Update user_ai_usage
  INSERT INTO user_ai_usage (user_id, current_tier)
  VALUES (target_user_id, v_trial_tier)
  ON CONFLICT (user_id) DO UPDATE SET
    current_tier = v_trial_tier,
    updated_at = NOW();

  -- Set is_trial flag in profiles
  UPDATE profiles
  SET is_trial = true
  WHERE id = target_user_id;

  -- Log trial activation permanently
  PERFORM log_trial_activation(
    target_user_id,
    v_user_email,
    v_user_phone,
    NULL, -- device_fingerprint (can be added from client)
    jsonb_build_object(
      'plan_tier', plan_tier,
      'trial_days', trial_days,
      'activation_source', 'start_user_trial'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'trial_tier', v_trial_tier,
    'trial_days', trial_days,
    'expires_at', NOW() + (trial_days || ' days')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION start_user_trial IS 'Start trial for user, checking trial_usage_log to prevent duplicate trials';
