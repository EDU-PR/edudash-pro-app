-- Add get_user_subscription_tier RPC for subscription checks
-- Safe for service role / edge function usage

create or replace function public.get_user_subscription_tier(user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := user_id;
  v_tier text;
begin
  if v_user_id is null then
    v_user_id := auth.uid();
  end if;

  if v_user_id is null then
    return 'free';
  end if;

  -- 1) Prefer explicit user AI tier when present
  begin
    select tier::text into v_tier
    from public.user_ai_tiers
    where user_id = v_user_id
    order by created_at desc
    limit 1;
  exception when undefined_table then
    v_tier := null;
  end;

  if v_tier is not null and v_tier <> '' then
    return v_tier;
  end if;

  -- 2) Fallback to profile subscription tier
  select subscription_tier into v_tier
  from public.profiles
  where id = v_user_id;

  if v_tier is not null and v_tier <> '' then
    return v_tier;
  end if;

  -- 3) Fallback to linked school subscription tier
  select s.subscription_tier into v_tier
  from public.preschools s
  join public.profiles p on p.preschool_id = s.id
  where p.id = v_user_id;

  if v_tier is not null and v_tier <> '' then
    return v_tier;
  end if;

  return 'free';
end;
$$;

grant execute on function public.get_user_subscription_tier(uuid) to anon, authenticated, service_role;
