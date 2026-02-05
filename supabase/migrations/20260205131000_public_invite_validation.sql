-- Ensure invite code validation is available to web/anon clients
-- Safe redefinition based on current production logic
create or replace function public.validate_invitation_code(p_code text, p_email text default null::text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_invitation public.school_invitation_codes%rowtype;
  v_school_name text;
  v_school_slug text;
  v_result jsonb;
begin
  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('valid', false, 'error', 'Missing invitation code');
  end if;

  -- Find invitation code (case-insensitive)
  select * into v_invitation
  from public.school_invitation_codes
  where upper(code) = upper(btrim(p_code));

  if not found then
    return jsonb_build_object('valid', false, 'error', 'Invalid or expired invitation code');
  end if;

  -- Get school/org name (support both preschools and organizations as "school_id")
  select name, slug into v_school_name, v_school_slug
  from public.preschools
  where id = v_invitation.preschool_id;

  if v_school_name is null then
    select name, slug into v_school_name, v_school_slug
    from public.organizations
    where id = v_invitation.preschool_id;
  end if;

  v_result := jsonb_build_object(
    'valid', true,
    'invitation_type', v_invitation.invitation_type,
    'is_active', coalesce(v_invitation.is_active, false),
    'current_uses', coalesce(v_invitation.current_uses, 0),
    'max_uses', v_invitation.max_uses,
    'expires_at', v_invitation.expires_at,
    'school_name', coalesce(v_school_name, 'Unknown'),
    'school_slug', v_school_slug,
    'school_id', v_invitation.preschool_id
  );

  if not coalesce(v_invitation.is_active, false) then
    return jsonb_build_object('valid', false, 'error', 'This invitation code is no longer active');
  end if;

  if v_invitation.expires_at is not null and v_invitation.expires_at <= now() then
    return jsonb_build_object('valid', false, 'error', 'This invitation code has expired');
  end if;

  if v_invitation.max_uses is not null and v_invitation.max_uses > 0
     and coalesce(v_invitation.current_uses, 0) >= v_invitation.max_uses then
    return jsonb_build_object('valid', false, 'error', 'This invitation code has reached its maximum uses');
  end if;

  return v_result;
end;
$$;

grant execute on function public.validate_invitation_code(text, text) to anon, authenticated;
