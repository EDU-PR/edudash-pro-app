-- Sync marketing_campaigns to promotional_campaigns for registration promo usage
-- This keeps principal-created promo codes usable in the registration/pricing flows.

create or replace function public.sync_marketing_campaign_to_promotional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mapped_discount_type text;
  mapped_discount_value numeric(10,2);
  normalized_code text;
begin
  if tg_op = 'DELETE' then
    if old.promo_code is not null then
      update public.promotional_campaigns
      set
        is_active = false,
        end_date = now(),
        updated_at = now()
      where code = upper(old.promo_code);
    end if;
    return old;
  end if;

  if new.promo_code is null then
    return new;
  end if;

  normalized_code := upper(new.promo_code);

  -- If promo code changed, deactivate the old one
  if tg_op = 'UPDATE' and old.promo_code is not null and upper(old.promo_code) <> normalized_code then
    update public.promotional_campaigns
    set
      is_active = false,
      end_date = now(),
      updated_at = now()
    where code = upper(old.promo_code);
  end if;

  mapped_discount_type := case new.discount_type::text
    when 'percentage' then 'percentage'
    when 'fixed_amount' then 'fixed_amount'
    when 'waive_registration' then 'fixed_price'
    when 'first_month_free' then 'fixed_price'
    else 'fixed_amount'
  end;

  mapped_discount_value := case new.discount_type::text
    when 'waive_registration' then 0
    when 'first_month_free' then 0
    else coalesce(new.discount_value, 0)
  end;

  insert into public.promotional_campaigns (
    code,
    name,
    description,
    user_type,
    tier_filter,
    discount_type,
    discount_value,
    promo_duration_months,
    start_date,
    end_date,
    max_uses,
    current_uses,
    is_active,
    created_by,
    applies_to_registration,
    product_type,
    created_at,
    updated_at
  ) values (
    normalized_code,
    new.name,
    new.description,
    'parent',
    null,
    mapped_discount_type,
    mapped_discount_value,
    1,
    new.start_date::timestamptz,
    new.end_date::timestamptz,
    new.max_redemptions,
    coalesce(new.current_redemptions, 0),
    coalesce(new.active, true),
    null,
    true,
    'registration',
    now(),
    now()
  )
  on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    discount_type = excluded.discount_type,
    discount_value = excluded.discount_value,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    max_uses = excluded.max_uses,
    current_uses = excluded.current_uses,
    is_active = excluded.is_active,
    applies_to_registration = true,
    product_type = 'registration',
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_marketing_campaign_to_promotional on public.marketing_campaigns;
create trigger trg_sync_marketing_campaign_to_promotional
after insert or update or delete on public.marketing_campaigns
for each row execute function public.sync_marketing_campaign_to_promotional();
