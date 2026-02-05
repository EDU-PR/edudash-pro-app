-- Superadmin AI usage visibility helpers

CREATE OR REPLACE FUNCTION public.admin_get_ai_usage_summary()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  role text,
  current_tier text,
  chat_messages_this_month integer,
  chat_messages_today integer,
  last_monthly_reset_at timestamptz,
  last_daily_reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    u.user_id,
    NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), '') AS full_name,
    p.email,
    p.role,
    u.current_tier::text,
    COALESCE(u.chat_messages_this_month, 0) AS chat_messages_this_month,
    COALESCE(u.chat_messages_today, 0) AS chat_messages_today,
    u.last_monthly_reset_at,
    u.last_daily_reset_at
  FROM user_ai_usage u
  LEFT JOIN profiles p ON p.id = u.user_id
  ORDER BY COALESCE(u.chat_messages_this_month, 0) DESC,
           COALESCE(u.chat_messages_today, 0) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_image_uploads_today()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  uploads_today integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    (storage.foldername(o.name))[1]::uuid AS user_id,
    NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), '') AS full_name,
    p.email,
    COUNT(*)::int AS uploads_today
  FROM storage.objects o
  LEFT JOIN profiles p
    ON p.id = (storage.foldername(o.name))[1]::uuid
  WHERE o.bucket_id = 'attachments'
    AND o.created_at::date = CURRENT_DATE
    AND (storage.foldername(o.name))[1] ~* '^[0-9a-f-]{36}$'
    AND (
      COALESCE(o.metadata->>'mimetype','') LIKE 'image/%'
      OR o.name ~* '\\.(jpg|jpeg|png|gif|webp|bmp)$'
    )
  GROUP BY user_id, full_name, p.email
  ORDER BY uploads_today DESC;
END;
$function$;
