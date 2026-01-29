BEGIN;

CREATE TABLE IF NOT EXISTS public.birthday_donation_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donation_date date NOT NULL,
  birthday_count integer NOT NULL DEFAULT 0 CHECK (birthday_count >= 0 AND birthday_count <= 2),
  expected_amount numeric(10,2) NOT NULL DEFAULT 25,
  total_received numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, donation_date)
);

CREATE INDEX IF NOT EXISTS idx_birthday_donation_days_org_date
  ON public.birthday_donation_days(organization_id, donation_date);

CREATE TABLE IF NOT EXISTS public.birthday_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donation_date date NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  payment_method text,
  note text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_birthday_donations_org_date
  ON public.birthday_donations(organization_id, donation_date);

CREATE INDEX IF NOT EXISTS idx_birthday_donations_recorded_by
  ON public.birthday_donations(recorded_by);

CREATE OR REPLACE FUNCTION public.set_birthday_donation_day_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_birthday_donation_days_meta ON public.birthday_donation_days;
CREATE TRIGGER trg_birthday_donation_days_meta
BEFORE INSERT OR UPDATE ON public.birthday_donation_days
FOR EACH ROW EXECUTE FUNCTION public.set_birthday_donation_day_meta();

CREATE OR REPLACE FUNCTION public.record_birthday_donation(
  org_id uuid,
  donation_day date,
  donation_amount numeric,
  donation_method text DEFAULT NULL,
  donation_note text DEFAULT NULL,
  recorded_by_user uuid DEFAULT NULL
)
RETURNS public.birthday_donation_days
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  birthday_count integer := 0;
  target_recorded_by uuid := COALESCE(recorded_by_user, auth.uid());
  day_row public.birthday_donation_days;
BEGIN
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Organization is required';
  END IF;

  IF donation_day IS NULL THEN
    RAISE EXCEPTION 'Donation date is required';
  END IF;

  IF donation_amount IS NULL OR donation_amount <= 0 THEN
    RAISE EXCEPTION 'Donation amount must be greater than zero';
  END IF;

  SELECT COUNT(*)::int INTO birthday_count
  FROM public.students
  WHERE (organization_id = org_id OR preschool_id = org_id)
    AND is_active IS TRUE
    AND date_of_birth IS NOT NULL
    AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM donation_day)
    AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM donation_day);

  IF birthday_count < 1 THEN
    RAISE EXCEPTION 'No birthdays found for this date';
  END IF;

  IF birthday_count > 2 THEN
    RAISE EXCEPTION 'Birthday count exceeds the daily limit of 2';
  END IF;

  INSERT INTO public.birthday_donations (
    organization_id,
    donation_date,
    amount,
    payment_method,
    note,
    recorded_by
  ) VALUES (
    org_id,
    donation_day,
    donation_amount,
    donation_method,
    donation_note,
    target_recorded_by
  );

  INSERT INTO public.birthday_donation_days (
    organization_id,
    donation_date,
    birthday_count,
    expected_amount,
    total_received,
    created_by,
    updated_by
  ) VALUES (
    org_id,
    donation_day,
    birthday_count,
    25,
    donation_amount,
    target_recorded_by,
    target_recorded_by
  )
  ON CONFLICT (organization_id, donation_date)
  DO UPDATE SET
    birthday_count = EXCLUDED.birthday_count,
    total_received = birthday_donation_days.total_received + EXCLUDED.total_received,
    updated_by = target_recorded_by,
    updated_at = now();

  SELECT * INTO day_row
  FROM public.birthday_donation_days
  WHERE organization_id = org_id
    AND donation_date = donation_day;

  RETURN day_row;
END;
$$;

ALTER TABLE public.birthday_donation_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS birthday_donation_days_select ON public.birthday_donation_days;
CREATE POLICY birthday_donation_days_select ON public.birthday_donation_days
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_donation_days.organization_id
      AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'superadmin', 'super_admin', 'staff')
  )
);

DROP POLICY IF EXISTS birthday_donations_select ON public.birthday_donations;
CREATE POLICY birthday_donations_select ON public.birthday_donations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_donations.organization_id
      AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'superadmin', 'super_admin', 'staff')
  )
);

GRANT SELECT ON public.birthday_donation_days TO authenticated;
GRANT SELECT ON public.birthday_donations TO authenticated;

COMMIT;
