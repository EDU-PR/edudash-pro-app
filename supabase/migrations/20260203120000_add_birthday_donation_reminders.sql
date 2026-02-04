BEGIN;

CREATE TABLE IF NOT EXISTS public.birthday_donation_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donation_date date NOT NULL,
  birthday_student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payer_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_birthday_donation_reminders_org_date
  ON public.birthday_donation_reminders(organization_id, donation_date);

CREATE INDEX IF NOT EXISTS idx_birthday_donation_reminders_birthday_student
  ON public.birthday_donation_reminders(birthday_student_id);

CREATE INDEX IF NOT EXISTS idx_birthday_donation_reminders_payer_student
  ON public.birthday_donation_reminders(payer_student_id);

CREATE INDEX IF NOT EXISTS idx_birthday_donation_reminders_recipient
  ON public.birthday_donation_reminders(recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_birthday_donation_reminders_sent_at
  ON public.birthday_donation_reminders(sent_at DESC);

ALTER TABLE public.birthday_donation_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS birthday_donation_reminders_select ON public.birthday_donation_reminders;
CREATE POLICY birthday_donation_reminders_select ON public.birthday_donation_reminders
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_donation_reminders.organization_id
      AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'superadmin', 'super_admin', 'staff')
  )
);

DROP POLICY IF EXISTS birthday_donation_reminders_insert ON public.birthday_donation_reminders;
CREATE POLICY birthday_donation_reminders_insert ON public.birthday_donation_reminders
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_donation_reminders.organization_id
      AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'superadmin', 'super_admin', 'staff')
  )
);

GRANT SELECT, INSERT ON public.birthday_donation_reminders TO authenticated;

COMMIT;
