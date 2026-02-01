-- Add global Superadmin Dash AI autonomy control
-- Ensures only one platform owner can enable full autonomy

CREATE TABLE IF NOT EXISTS public.superadmin_ai_control (
  id integer PRIMARY KEY DEFAULT 1,
  owner_user_id uuid,
  autonomy_enabled boolean NOT NULL DEFAULT false,
  autonomy_mode text NOT NULL DEFAULT 'assistant',
  auto_execute_low boolean NOT NULL DEFAULT true,
  auto_execute_medium boolean NOT NULL DEFAULT false,
  auto_execute_high boolean NOT NULL DEFAULT false,
  require_confirm_navigation boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT superadmin_ai_control_singleton CHECK (id = 1),
  CONSTRAINT superadmin_ai_control_mode_check CHECK (autonomy_mode IN ('assistant', 'copilot', 'full'))
);

ALTER TABLE public.superadmin_ai_control ENABLE ROW LEVEL SECURITY;

-- Seed a default singleton row if none exists
INSERT INTO public.superadmin_ai_control (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM public.superadmin_ai_control WHERE id = 1);

-- Only super admins can read the control state
DROP POLICY IF EXISTS superadmin_ai_control_select ON public.superadmin_ai_control;
CREATE POLICY superadmin_ai_control_select
  ON public.superadmin_ai_control
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Only the platform owner can update; first super admin to claim must set owner_user_id to self
DROP POLICY IF EXISTS superadmin_ai_control_update ON public.superadmin_ai_control;
CREATE POLICY superadmin_ai_control_update
  ON public.superadmin_ai_control
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    AND (owner_user_id IS NULL OR owner_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_super_admin()
    AND owner_user_id = auth.uid()
  );
