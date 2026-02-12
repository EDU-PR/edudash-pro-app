-- Fix users audit trigger FK mismatch between auth.uid() and audit_logs.user_id -> public.users(id)
--
-- Problem:
-- audit_user_changes() writes audit_logs.user_id = auth.uid(), but auth.uid() is an auth.users id.
-- audit_logs.user_id references public.users(id), so writes can fail with
-- audit_logs_user_id_fkey when the actor has no matching public.users row.
--
-- Fix:
-- Resolve actor to public.users.id via id/auth_user_id mapping. If unresolved (or FK race),
-- write audit row with NULL user_id so business operations are never blocked by audit logging.

CREATE OR REPLACE FUNCTION public.audit_user_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_actor_user_id uuid;
BEGIN
  IF v_auth_uid IS NOT NULL THEN
    SELECT u.id
    INTO v_actor_user_id
    FROM public.users u
    WHERE u.id = v_auth_uid OR u.auth_user_id = v_auth_uid
    ORDER BY CASE
      WHEN u.id = v_auth_uid THEN 0
      WHEN u.auth_user_id = v_auth_uid THEN 1
      ELSE 2
    END,
    u.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  BEGIN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values,
      ip_address,
      created_at
    ) VALUES (
      v_actor_user_id,
      TG_OP,
      'users',
      COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
      inet_client_addr(),
      now()
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      INSERT INTO public.audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        ip_address,
        created_at
      ) VALUES (
        NULL,
        TG_OP,
        'users',
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
        inet_client_addr(),
        now()
      );
    WHEN OTHERS THEN
      -- Never block primary user-table operations due to audit insert failures.
      NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
