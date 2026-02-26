-- Safety re-apply for daily media budget RPC ambiguity fix.
-- Ensures get_daily_media_budget / consume_daily_media_budget always qualify u.usage_date.
-- Resolves Postgres 42702: column reference "usage_date" is ambiguous.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_daily_media_budget(
  p_feature text,
  p_tier text DEFAULT 'free'
)
RETURNS TABLE (
  feature text,
  usage_date date,
  used bigint,
  limit_value bigint,
  remaining bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_date date := (timezone('utc', now()))::date;
  v_feature text := lower(trim(coalesce(p_feature, '')));
  v_limit bigint;
  v_used bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_feature NOT IN ('auto_scan', 'voice_input_ms') THEN
    RAISE EXCEPTION 'Unsupported media feature: %', p_feature;
  END IF;

  INSERT INTO public.daily_media_usage (user_id, usage_date, feature, used_count, used_ms)
  VALUES (v_user_id, v_date, v_feature, 0, 0)
  ON CONFLICT (user_id, usage_date, feature) DO NOTHING;

  v_limit := public.resolve_daily_media_limit(v_feature, p_tier);

  IF v_feature = 'auto_scan' THEN
    SELECT u.used_count::bigint INTO v_used
    FROM public.daily_media_usage u
    WHERE u.user_id = v_user_id
      AND u.usage_date = v_date
      AND u.feature = v_feature;
  ELSE
    SELECT u.used_ms INTO v_used
    FROM public.daily_media_usage u
    WHERE u.user_id = v_user_id
      AND u.usage_date = v_date
      AND u.feature = v_feature;
  END IF;

  v_used := coalesce(v_used, 0);

  RETURN QUERY
  SELECT
    v_feature,
    v_date,
    v_used,
    v_limit,
    CASE WHEN v_limit < 0 THEN -1 ELSE greatest(0, v_limit - v_used) END;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_daily_media_budget(
  p_feature text,
  p_amount bigint DEFAULT 1,
  p_tier text DEFAULT 'free'
)
RETURNS TABLE (
  allowed boolean,
  feature text,
  usage_date date,
  used bigint,
  limit_value bigint,
  remaining bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_date date := (timezone('utc', now()))::date;
  v_feature text := lower(trim(coalesce(p_feature, '')));
  v_amount bigint := greatest(0, coalesce(p_amount, 0));
  v_limit bigint;
  v_used bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_feature NOT IN ('auto_scan', 'voice_input_ms') THEN
    RAISE EXCEPTION 'Unsupported media feature: %', p_feature;
  END IF;

  INSERT INTO public.daily_media_usage (user_id, usage_date, feature, used_count, used_ms)
  VALUES (v_user_id, v_date, v_feature, 0, 0)
  ON CONFLICT (user_id, usage_date, feature) DO NOTHING;

  v_limit := public.resolve_daily_media_limit(v_feature, p_tier);

  IF v_feature = 'auto_scan' THEN
    SELECT u.used_count::bigint INTO v_used
    FROM public.daily_media_usage u
    WHERE u.user_id = v_user_id
      AND u.usage_date = v_date
      AND u.feature = v_feature
    FOR UPDATE;
  ELSE
    SELECT u.used_ms INTO v_used
    FROM public.daily_media_usage u
    WHERE u.user_id = v_user_id
      AND u.usage_date = v_date
      AND u.feature = v_feature
    FOR UPDATE;
  END IF;

  v_used := coalesce(v_used, 0);

  IF v_limit >= 0 AND v_used + v_amount > v_limit THEN
    RETURN QUERY
    SELECT
      false,
      v_feature,
      v_date,
      v_used,
      v_limit,
      greatest(0, v_limit - v_used);
    RETURN;
  END IF;

  IF v_feature = 'auto_scan' THEN
    UPDATE public.daily_media_usage u
    SET used_count = least(2147483647, u.used_count + v_amount::integer),
        updated_at = timezone('utc', now())
    WHERE u.user_id = v_user_id
      AND u.usage_date = v_date
      AND u.feature = v_feature
    RETURNING u.used_count::bigint INTO v_used;
  ELSE
    UPDATE public.daily_media_usage u
    SET used_ms = greatest(0, u.used_ms + v_amount),
        updated_at = timezone('utc', now())
    WHERE u.user_id = v_user_id
      AND u.usage_date = v_date
      AND u.feature = v_feature
    RETURNING u.used_ms INTO v_used;
  END IF;

  RETURN QUERY
  SELECT
    true,
    v_feature,
    v_date,
    coalesce(v_used, 0),
    v_limit,
    CASE WHEN v_limit < 0 THEN -1 ELSE greatest(0, v_limit - coalesce(v_used, 0)) END;
END;
$$;

COMMIT;
