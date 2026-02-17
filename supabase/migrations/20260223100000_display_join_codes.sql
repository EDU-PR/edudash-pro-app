-- Display join codes: short codes (e.g. 6 chars) so TV can open room display without pasting long URL.
-- Link API creates a row; data API resolves code to org+token server-side (service role).

CREATE TABLE IF NOT EXISTS public.display_join_codes (
  code text PRIMARY KEY,
  org_id uuid NOT NULL,
  token text NOT NULL,
  class_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.display_join_codes IS 'Short-lived codes for room display; TV can enter code instead of long URL.';

-- Only authenticated users can insert for their own org (enforced in API).
-- No public SELECT; data API uses service role to resolve code.
ALTER TABLE public.display_join_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "display_join_codes_insert_own_org"
  ON public.display_join_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
    )
  );

-- Service role (used by API route) bypasses RLS for SELECT.
-- Optional: delete expired rows periodically via cron or on next insert.

CREATE INDEX IF NOT EXISTS display_join_codes_expires_at
  ON public.display_join_codes (expires_at);
