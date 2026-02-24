-- Backward-safe signature/validation for media budget RPCs.

create or replace function public.get_daily_media_budget(
  p_feature text default null,
  p_tier text default 'free'
)
returns table (
  feature text,
  usage_date date,
  used bigint,
  limit_value bigint,
  remaining bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date := (timezone('utc', now()))::date;
  v_feature text := lower(trim(coalesce(p_feature, '')));
  v_limit bigint;
  v_used bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_feature = '' then
    raise exception 'p_feature parameter is required';
  end if;

  if v_feature not in ('auto_scan', 'voice_input_ms') then
    raise exception 'Unsupported media feature: %', p_feature;
  end if;

  insert into public.daily_media_usage (user_id, usage_date, feature, used_count, used_ms)
  values (v_user_id, v_date, v_feature, 0, 0)
  on conflict (user_id, usage_date, feature) do nothing;

  v_limit := public.resolve_daily_media_limit(v_feature, p_tier);

  if v_feature = 'auto_scan' then
    select used_count::bigint
      into v_used
      from public.daily_media_usage
      where user_id = v_user_id
        and usage_date = v_date
        and feature = v_feature;
  else
    select used_ms
      into v_used
      from public.daily_media_usage
      where user_id = v_user_id
        and usage_date = v_date
        and feature = v_feature;
  end if;

  v_used := coalesce(v_used, 0);

  return query
    select
      v_feature,
      v_date,
      v_used,
      v_limit,
      case
        when v_limit < 0 then -1
        else greatest(0, v_limit - v_used)
      end;
end;
$$;

revoke all on function public.get_daily_media_budget(text, text) from public;
grant execute on function public.get_daily_media_budget(text, text) to authenticated, service_role;
