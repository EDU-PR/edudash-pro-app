-- Add subscription fields to schools (for K-12 tier management)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_start_date date,
  ADD COLUMN IF NOT EXISTS subscription_end_date date;

-- Superadmin-only helper to update subscription fields across entities
CREATE OR REPLACE FUNCTION public.superadmin_update_entity_subscription(
  p_entity_type text,
  p_entity_id uuid,
  p_subscription_tier text,
  p_subscription_status text DEFAULT 'active',
  p_subscription_plan_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND p.role IN ('superadmin','super_admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin AND current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only super admins can update subscriptions';
  END IF;

  IF p_entity_type = 'preschool' THEN
    UPDATE public.preschools
    SET
      subscription_tier = p_subscription_tier,
      subscription_status = p_subscription_status,
      subscription_plan_id = COALESCE(p_subscription_plan_id, subscription_plan_id),
      updated_at = NOW()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'organization' THEN
    UPDATE public.organizations
    SET
      subscription_tier = p_subscription_tier,
      plan_tier = COALESCE(p_subscription_tier, plan_tier),
      subscription_status = p_subscription_status,
      updated_at = NOW()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'school' THEN
    UPDATE public.schools
    SET
      subscription_tier = p_subscription_tier,
      subscription_status = p_subscription_status,
      updated_at = NOW()
    WHERE id = p_entity_id;
  ELSE
    RAISE EXCEPTION 'Unknown entity type: %', p_entity_type;
  END IF;

  RETURN FOUND;
END;
$$;
