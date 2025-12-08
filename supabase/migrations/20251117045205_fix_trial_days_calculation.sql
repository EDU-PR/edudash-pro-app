-- Fix Trial Days Calculation
-- Issue: EXTRACT(DAY FROM ...) only gets the day component, not the full difference
-- Solution: Use EXTRACT(EPOCH FROM ...) / 86400 to get total days
-- Date: 2025-11-17

CREATE OR REPLACE FUNCTION get_my_trial_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
  org_subscription RECORD;
  result json;
  days_left INTEGER;
BEGIN
  -- Get current user's profile
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'is_trial', false,
      'message', 'User profile not found'
    );
  END IF;
  
  -- Check if user is linked to an organization
  IF user_profile.preschool_id IS NOT NULL THEN
    -- Organization-level trial (existing logic)
    SELECT * INTO org_subscription
    FROM subscriptions
    WHERE preschool_id = user_profile.preschool_id
    LIMIT 1;
    
    IF FOUND AND org_subscription.is_trial THEN
      -- Calculate days remaining (full days, not just day component)
      -- CEIL ensures we round up partial days
      days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (org_subscription.trial_end_date - NOW())) / 86400)::INTEGER);
      
      RETURN json_build_object(
        'is_trial', true,
        'trial_type', 'organization',
        'trial_end_date', org_subscription.trial_end_date,
        'days_remaining', days_left,
        'plan_tier', org_subscription.plan_tier,
        'plan_name', 'Premium'
      );
    END IF;
  END IF;
  
  -- Check for user-level trial (independent users)
  IF user_profile.is_trial THEN
    -- Check if trial is still active
    IF user_profile.trial_end_date > NOW() THEN
      -- Calculate days remaining (full days, not just day component)
      days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (user_profile.trial_end_date - NOW())) / 86400)::INTEGER);
      
      RETURN json_build_object(
        'is_trial', true,
        'trial_type', 'personal',
        'trial_end_date', user_profile.trial_end_date,
        'days_remaining', days_left,
        'plan_tier', user_profile.trial_plan_tier,
        'plan_name', 'Premium'
      );
    ELSE
      -- Trial expired - mark as ended
      UPDATE profiles
      SET is_trial = FALSE
      WHERE id = auth.uid();
      
      RETURN json_build_object(
        'is_trial', false,
        'trial_expired', true,
        'message', 'Trial period ended'
      );
    END IF;
  END IF;
  
  -- No active trial
  RETURN json_build_object(
    'is_trial', false,
    'message', 'No active trial'
  );
END;
$$;

COMMENT ON FUNCTION get_my_trial_status IS 
  'Returns trial status for current user with accurate days remaining calculation';
