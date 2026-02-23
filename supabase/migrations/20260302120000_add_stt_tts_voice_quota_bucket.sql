-- Add dedicated voice (STT/TTS) quota bucket so voice requests don't drain chat quota.
-- Maps stt/tts request types to transcriptions_per_month in check_ai_usage_limit and increment_ai_usage.

ALTER TABLE public.ai_usage_tiers
  ADD COLUMN IF NOT EXISTS transcriptions_per_month integer;

UPDATE public.ai_usage_tiers
SET transcriptions_per_month = CASE
    WHEN transcriptions_per_month IS NOT NULL THEN transcriptions_per_month
    WHEN tier_name IN ('free', 'trial') THEN 10
    WHEN tier_name IN ('parent_starter', 'teacher_starter', 'school_starter') THEN 30
    WHEN tier_name IN ('parent_plus', 'teacher_pro', 'school_premium', 'school_pro') THEN 120
    WHEN tier_name = 'school_enterprise' THEN 999999
    ELSE 20
  END
WHERE transcriptions_per_month IS NULL;

ALTER TABLE public.ai_usage_tiers
  ALTER COLUMN transcriptions_per_month SET NOT NULL;

ALTER TABLE public.user_ai_usage
  ADD COLUMN IF NOT EXISTS transcriptions_this_month integer DEFAULT 0;

UPDATE public.user_ai_usage
SET transcriptions_this_month = COALESCE(transcriptions_this_month, 0);

ALTER TABLE public.user_ai_usage
  ALTER COLUMN transcriptions_this_month SET NOT NULL;

-- Update check_ai_usage_limit to map stt/tts to transcription bucket and add monthly reset
CREATE OR REPLACE FUNCTION public.check_ai_usage_limit(
  p_user_id uuid,
  p_request_type character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_usage RECORD;
  v_limits RECORD;
  v_profile RECORD;
  v_membership RECORD;

  v_can_proceed BOOLEAN := false;
  v_remaining INTEGER := 0;
  v_limit INTEGER := 0;

  v_effective_tier text;
  v_profile_tier text;
  v_school_tier text;
  v_request_type text := lower(coalesce(trim(p_request_type), 'chat_message'));

  v_school_id uuid;
BEGIN
  SELECT
    p.id,
    p.auth_user_id,
    lower(coalesce(p.role, '')) AS role,
    lower(coalesce(p.subscription_tier::text, '')) AS subscription_tier,
    p.preschool_id,
    p.organization_id,
    coalesce(p.preschool_id, p.organization_id) AS school_id
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id OR p.auth_user_id = p_user_id
  ORDER BY CASE WHEN p.id = p_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  v_school_id := v_profile.school_id;

  IF v_school_id IS NULL THEN
    SELECT
      om.organization_id,
      lower(coalesce(om.membership_status, '')) AS membership_status
    INTO v_membership
    FROM public.organization_members om
    WHERE om.user_id = p_user_id
    ORDER BY
      CASE WHEN lower(coalesce(om.membership_status, '')) = 'active' THEN 0 ELSE 1 END,
      om.updated_at DESC NULLS LAST,
      om.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_membership.organization_id IS NOT NULL THEN
      v_school_id := v_membership.organization_id;
    END IF;
  END IF;

  IF v_school_id = '00000000-0000-0000-0000-000000000001'::uuid THEN
    RETURN jsonb_build_object(
      'allowed', true, 'remaining', -1, 'limit', -1,
      'current_tier', 'community_unlimited', 'upgrade_available', false, 'request_type', v_request_type
    );
  END IF;

  IF v_school_id = '00000000-0000-0000-0000-000000000003'::uuid THEN
    RETURN jsonb_build_object(
      'allowed', true, 'remaining', -1, 'limit', -1,
      'current_tier', 'platform_admin_unlimited', 'upgrade_available', false, 'request_type', v_request_type
    );
  END IF;

  INSERT INTO public.user_ai_usage (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_ai_usage
  SET
    exams_generated_this_month = 0,
    explanations_requested_this_month = 0,
    chat_messages_this_month = 0,
    images_generated_this_month = 0,
    transcriptions_this_month = 0,
    last_monthly_reset_at = NOW()
  WHERE user_id = p_user_id
    AND last_monthly_reset_at < (NOW() - INTERVAL '30 days');

  UPDATE public.user_ai_usage
  SET chat_messages_today = 0, last_daily_reset_at = NOW()
  WHERE user_id = p_user_id
    AND last_daily_reset_at < (NOW() - INTERVAL '1 day');

  SELECT * INTO v_usage FROM public.user_ai_usage WHERE user_id = p_user_id;

  v_profile_tier := coalesce(v_profile.subscription_tier, '');

  IF v_school_id IS NOT NULL THEN
    SELECT lower(sp.tier::text) INTO v_school_tier
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.school_id = v_school_id AND s.status IN ('active', 'trialing')
    ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END, s.created_at DESC
    LIMIT 1;
  END IF;

  IF v_school_tier IS NULL AND v_school_id IS NOT NULL THEN
    SELECT lower(coalesce(o.subscription_tier::text, o.plan_tier::text, '')) INTO v_school_tier
    FROM public.organizations o WHERE o.id = v_school_id LIMIT 1;
    IF v_school_tier = '' THEN v_school_tier := NULL; END IF;
  END IF;

  IF v_school_tier IS NULL AND v_profile.organization_id IS NOT NULL AND v_profile.preschool_id IS NULL THEN
    SELECT lower(coalesce(pr.subscription_tier::text, '')) INTO v_school_tier
    FROM public.profiles p2
    JOIN public.preschools pr ON pr.id = p2.preschool_id
    WHERE p2.organization_id = v_profile.organization_id AND p2.preschool_id IS NOT NULL
    ORDER BY p2.created_at DESC NULLS LAST LIMIT 1;
    IF v_school_tier = '' THEN v_school_tier := NULL; END IF;
  END IF;

  IF v_profile_tier LIKE 'parent_%' THEN
    v_effective_tier := v_profile_tier;
  ELSIF v_school_tier IS NOT NULL THEN
    v_effective_tier := v_school_tier;
  ELSIF v_profile_tier <> '' THEN
    v_effective_tier := v_profile_tier;
  ELSE
    v_effective_tier := lower(coalesce(v_usage.current_tier::text, 'free'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ai_usage_tiers t WHERE t.tier_name::text = v_effective_tier AND t.is_active = true) THEN
    IF EXISTS (SELECT 1 FROM public.ai_usage_tiers t WHERE t.tier_name::text = lower(coalesce(v_usage.current_tier::text, '')) AND t.is_active = true) THEN
      v_effective_tier := lower(v_usage.current_tier::text);
    ELSE
      v_effective_tier := 'free';
    END IF;
  END IF;

  IF coalesce(v_usage.current_tier::text, '') <> v_effective_tier THEN
    UPDATE public.user_ai_usage SET current_tier = v_effective_tier::public.tier_name_aligned, updated_at = NOW() WHERE user_id = p_user_id;
    SELECT * INTO v_usage FROM public.user_ai_usage WHERE user_id = p_user_id;
  END IF;

  SELECT * INTO v_limits FROM public.ai_usage_tiers WHERE tier_name::text = v_effective_tier AND is_active = true LIMIT 1;

  -- Map stt/tts to transcription bucket
  IF v_request_type IN ('dash_conversation', 'dash_ai', 'lesson_generation', 'homework_generation', 'grading',
    'agent_plan', 'agent_reflection', 'web_search', 'image_analysis', 'document_analysis', 'voice_chat', 'chat') THEN
    v_request_type := 'chat_message';
  ELSIF v_request_type IN ('exam', 'exam_prep') THEN
    v_request_type := 'exam_generation';
  ELSIF v_request_type IN ('homework_help', 'tutor_help', 'tutor_session') THEN
    v_request_type := 'explanation';
  ELSIF v_request_type IN ('generate_image') THEN
    v_request_type := 'image_generation';
  ELSIF v_request_type IN ('stt', 'tts', 'transcription', 'transcribe') THEN
    v_request_type := 'transcription';
  ELSIF v_request_type NOT IN ('chat_message', 'exam_generation', 'explanation', 'image_generation', 'transcription') THEN
    v_request_type := 'chat_message';
  END IF;

  IF v_request_type = 'exam_generation' THEN
    v_limit := v_limits.exams_per_month;
    v_remaining := v_limit - v_usage.exams_generated_this_month;
    v_can_proceed := v_usage.exams_generated_this_month < v_limit;
  ELSIF v_request_type = 'explanation' THEN
    v_limit := v_limits.explanations_per_month;
    v_remaining := v_limit - v_usage.explanations_requested_this_month;
    v_can_proceed := v_usage.explanations_requested_this_month < v_limit;
  ELSIF v_request_type = 'image_generation' THEN
    v_limit := v_limits.images_per_month;
    v_remaining := v_limit - v_usage.images_generated_this_month;
    v_can_proceed := v_usage.images_generated_this_month < v_limit;
  ELSIF v_request_type = 'transcription' THEN
    v_limit := v_limits.transcriptions_per_month;
    v_remaining := v_limit - v_usage.transcriptions_this_month;
    v_can_proceed := v_usage.transcriptions_this_month < v_limit;
  ELSE
    v_limit := v_limits.chat_messages_per_month;
    v_remaining := v_limit - v_usage.chat_messages_this_month;
    v_can_proceed := v_usage.chat_messages_this_month < v_limit;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_can_proceed, 'remaining', GREATEST(v_remaining, 0), 'limit', v_limit,
    'current_tier', v_effective_tier, 'upgrade_available', v_effective_tier IN ('free', 'trial'), 'request_type', v_request_type
  );
END;
$function$;

-- Update increment_ai_usage to handle stt/tts/transcription
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
DECLARE
  v_request_type text := lower(coalesce(trim(p_request_type), 'chat_message'));
BEGIN
  IF v_request_type IN ('dash_conversation', 'dash_ai', 'lesson_generation', 'homework_generation', 'grading',
    'agent_plan', 'agent_reflection', 'web_search', 'image_analysis', 'document_analysis', 'voice_chat', 'chat') THEN
    v_request_type := 'chat_message';
  ELSIF v_request_type IN ('exam', 'exam_prep') THEN
    v_request_type := 'exam_generation';
  ELSIF v_request_type IN ('homework_help', 'tutor_help', 'tutor_session') THEN
    v_request_type := 'explanation';
  ELSIF v_request_type IN ('generate_image') THEN
    v_request_type := 'image_generation';
  ELSIF v_request_type IN ('stt', 'tts', 'transcribe') THEN
    v_request_type := 'transcription';
  ELSIF v_request_type NOT IN ('chat_message', 'exam_generation', 'explanation', 'image_generation', 'transcription') THEN
    v_request_type := 'chat_message';
  END IF;

  IF p_status = 'success' THEN
    IF v_request_type = 'exam_generation' THEN
      UPDATE public.user_ai_usage SET exams_generated_this_month = exams_generated_this_month + 1, total_exams_generated = total_exams_generated + 1, updated_at = NOW() WHERE user_id = p_user_id;
    ELSIF v_request_type = 'explanation' THEN
      UPDATE public.user_ai_usage SET explanations_requested_this_month = explanations_requested_this_month + 1, total_explanations_requested = total_explanations_requested + 1, updated_at = NOW() WHERE user_id = p_user_id;
    ELSIF v_request_type = 'image_generation' THEN
      UPDATE public.user_ai_usage SET images_generated_this_month = images_generated_this_month + 1, total_images_generated = total_images_generated + 1, updated_at = NOW() WHERE user_id = p_user_id;
    ELSIF v_request_type = 'transcription' THEN
      UPDATE public.user_ai_usage SET transcriptions_this_month = transcriptions_this_month + 1, updated_at = NOW() WHERE user_id = p_user_id;
    ELSE
      UPDATE public.user_ai_usage SET chat_messages_today = chat_messages_today + 1, chat_messages_this_month = chat_messages_this_month + 1, total_chat_messages = total_chat_messages + 1, updated_at = NOW() WHERE user_id = p_user_id;
    END IF;
  END IF;

  INSERT INTO public.ai_request_log (user_id, request_type, status, metadata)
  VALUES (p_user_id, v_request_type, p_status, coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('original_request_type', p_request_type));
END;
$function$;
