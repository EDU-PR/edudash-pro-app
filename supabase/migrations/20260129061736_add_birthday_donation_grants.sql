BEGIN;

GRANT SELECT ON public.birthday_donation_days TO authenticated;
GRANT SELECT ON public.birthday_donations TO authenticated;

COMMIT;
