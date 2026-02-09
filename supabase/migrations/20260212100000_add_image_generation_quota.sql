-- Add image generation quotas and generated-image storage bucket.

ALTER TABLE public.ai_usage_tiers
  ADD COLUMN IF NOT EXISTS images_per_month integer;

UPDATE public.ai_usage_tiers
SET images_per_month = CASE
    WHEN images_per_month IS NOT NULL THEN images_per_month
    WHEN tier_name IN ('free', 'trial') THEN 3
    WHEN tier_name IN ('parent_starter', 'teacher_starter', 'school_starter') THEN 80
    WHEN tier_name IN ('parent_plus', 'teacher_pro', 'school_premium', 'school_pro') THEN 300
    WHEN tier_name = 'school_enterprise' THEN 1200
    ELSE 30
  END
WHERE images_per_month IS NULL;

ALTER TABLE public.ai_usage_tiers
  ALTER COLUMN images_per_month SET NOT NULL;

ALTER TABLE public.user_ai_usage
  ADD COLUMN IF NOT EXISTS images_generated_this_month integer DEFAULT 0;

ALTER TABLE public.user_ai_usage
  ADD COLUMN IF NOT EXISTS total_images_generated integer DEFAULT 0;

UPDATE public.user_ai_usage
SET
  images_generated_this_month = COALESCE(images_generated_this_month, 0),
  total_images_generated = COALESCE(total_images_generated, 0);

ALTER TABLE public.user_ai_usage
  ALTER COLUMN images_generated_this_month SET NOT NULL;

ALTER TABLE public.user_ai_usage
  ALTER COLUMN total_images_generated SET NOT NULL;

CREATE OR REPLACE FUNCTION public.check_ai_usage_limit(p_user_id uuid, p_request_type character varying)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  -- Reset counters if needed (monthly)
  UPDATE user_ai_usage
  SET
    exams_generated_this_month = 0,
    explanations_requested_this_month = 0,
    chat_messages_this_month = 0,
    images_generated_this_month = 0,
    last_monthly_reset_at = NOW()
  WHERE user_id = p_user_id
    AND last_monthly_reset_at < (NOW() - INTERVAL '30 days');

  -- Reset daily chat counter (still tracked for analytics)
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
    v_limit := v_limits.chat_messages_per_month;
    v_remaining := v_limit - v_usage.chat_messages_this_month;
    v_can_proceed := v_usage.chat_messages_this_month < v_limit;
  ELSIF p_request_type = 'image_generation' THEN
    v_limit := v_limits.images_per_month;
    v_remaining := v_limit - v_usage.images_generated_this_month;
    v_can_proceed := v_usage.images_generated_this_month < v_limit;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_can_proceed,
    'remaining', v_remaining,
    'limit', v_limit,
    'current_tier', v_usage.current_tier,
    'upgrade_available', v_usage.current_tier IN ('free', 'trial')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_user_id uuid,
  p_request_type character varying,
  p_status character varying DEFAULT 'success'::character varying,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Increment appropriate counter
  IF p_request_type = 'exam_generation' AND p_status = 'success' THEN
    UPDATE user_ai_usage
    SET
      exams_generated_this_month = exams_generated_this_month + 1,
      total_exams_generated = total_exams_generated + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_request_type = 'explanation' AND p_status = 'success' THEN
    UPDATE user_ai_usage
    SET
      explanations_requested_this_month = explanations_requested_this_month + 1,
      total_explanations_requested = total_explanations_requested + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_request_type = 'chat_message' AND p_status = 'success' THEN
    UPDATE user_ai_usage
    SET
      chat_messages_today = chat_messages_today + 1,
      chat_messages_this_month = chat_messages_this_month + 1,
      total_chat_messages = total_chat_messages + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_request_type = 'image_generation' AND p_status = 'success' THEN
    UPDATE user_ai_usage
    SET
      images_generated_this_month = images_generated_this_month + 1,
      total_images_generated = total_images_generated + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Log the request
  INSERT INTO ai_request_log (user_id, request_type, status, metadata)
  VALUES (p_user_id, p_request_type, p_status, p_metadata);
END;
$function$;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'Skipping dash-generated-images storage setup: storage.objects missing';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'dash-generated-images',
      'dash-generated-images',
      false,
      6291456,
      ARRAY['image/png', 'image/jpeg', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE
    SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping bucket upsert: insufficient privilege';
  END;

  BEGIN
    DROP POLICY IF EXISTS dash_generated_images_insert_own ON storage.objects;
    DROP POLICY IF EXISTS dash_generated_images_select_own ON storage.objects;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage policy drop: insufficient privilege';
  END;

  BEGIN
    CREATE POLICY dash_generated_images_insert_own
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'dash-generated-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping insert policy create: insufficient privilege';
  END;

  BEGIN
    CREATE POLICY dash_generated_images_select_own
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'dash-generated-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping select policy create: insufficient privilege';
  END;
END $$;
