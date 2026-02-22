-- Ensure daily media budget RPCs exist in environments where the table exists
-- but function deployment was skipped or partially applied.

create or replace function public.resolve_daily_media_limit(
  p_feature text,
  p_tier text default 'free'
)
returns bigint
language plpgsql
stable
as $$
declare
  normalized_feature text := lower(trim(coalesce(p_feature, '')));
  normalized_tier text := lower(trim(coalesce(p_tier, 'free')));
  free_like boolean := normalized_tier in ('free', 'trial');
begin
  if normalized_feature = 'auto_scan' then
    if free_like then
      return 3;
    end if;
    return 7;
  end if;

  if normalized_feature = 'voice_input_ms' then
    if free_like then
      return 600000; -- 10 minutes/day
    end if;
    return -1; -- unlimited
  end if;

  raise exception 'Unsupported media feature: %', p_feature;
end;
$$;

create or replace function public.get_daily_media_budget(
  p_feature text,
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

create or replace function public.consume_daily_media_budget(
  p_feature text,
  p_amount bigint default 1,
  p_tier text default 'free'
)
returns table (
  allowed boolean,
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
  v_amount bigint := greatest(0, coalesce(p_amount, 0));
  v_limit bigint;
  v_used bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
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
        and feature = v_feature
      for update;
  else
    select used_ms
      into v_used
      from public.daily_media_usage
      where user_id = v_user_id
        and usage_date = v_date
        and feature = v_feature
      for update;
  end if;

  v_used := coalesce(v_used, 0);

  if v_limit >= 0 and v_used + v_amount > v_limit then
    return query
      select
        false,
        v_feature,
        v_date,
        v_used,
        v_limit,
        greatest(0, v_limit - v_used);
    return;
  end if;

  if v_feature = 'auto_scan' then
    update public.daily_media_usage
      set used_count = least(2147483647, used_count + v_amount::integer),
          updated_at = timezone('utc', now())
      where user_id = v_user_id
        and usage_date = v_date
        and feature = v_feature
      returning used_count::bigint into v_used;
  else
    update public.daily_media_usage
      set used_ms = greatest(0, used_ms + v_amount),
          updated_at = timezone('utc', now())
      where user_id = v_user_id
        and usage_date = v_date
        and feature = v_feature
      returning used_ms into v_used;
  end if;

  return query
    select
      true,
      v_feature,
      v_date,
      coalesce(v_used, 0),
      v_limit,
      case
        when v_limit < 0 then -1
        else greatest(0, v_limit - coalesce(v_used, 0))
      end;
end;
$$;

revoke all on function public.get_daily_media_budget(text, text) from public;
grant execute on function public.get_daily_media_budget(text, text) to authenticated, service_role;

revoke all on function public.consume_daily_media_budget(text, bigint, text) from public;
grant execute on function public.consume_daily_media_budget(text, bigint, text) to authenticated, service_role;
