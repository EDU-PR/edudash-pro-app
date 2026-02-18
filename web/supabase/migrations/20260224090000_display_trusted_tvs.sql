-- Persistent trusted-TV pairing tokens for Room Display.
-- TVs can pair once and keep loading /display data for months without daily link rotation.

CREATE TABLE IF NOT EXISTS public.display_trusted_tvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  class_id uuid,
  token_hash text NOT NULL UNIQUE,
  token_hint text,
  pair_source text NOT NULL DEFAULT 'token',
  device_name text,
  user_agent text,
  paired_by uuid,
  paired_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.display_trusted_tvs IS 'Persistent trusted TV pairings for room display endpoints.';
COMMENT ON COLUMN public.display_trusted_tvs.token_hash IS 'SHA256 hash of pairing token. Raw token is never stored.';

ALTER TABLE public.display_trusted_tvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "display_trusted_tvs_read_own_org"
  ON public.display_trusted_tvs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "display_trusted_tvs_update_own_org"
  ON public.display_trusted_tvs
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS display_trusted_tvs_org_id_idx
  ON public.display_trusted_tvs (org_id);

CREATE INDEX IF NOT EXISTS display_trusted_tvs_expires_at_idx
  ON public.display_trusted_tvs (expires_at);

CREATE INDEX IF NOT EXISTS display_trusted_tvs_last_seen_at_idx
  ON public.display_trusted_tvs (last_seen_at);
