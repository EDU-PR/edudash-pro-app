-- ============================================================================
-- Social Agent (Facebook Pages)
-- ============================================================================
-- Created: 2026-02-07
-- Purpose:
-- - Store Facebook Page connections (encrypted tokens)
-- - Store Social Agent settings per organization
-- - Store generated post drafts, approvals, schedules, and publish state
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Types
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_platform') THEN
    CREATE TYPE public.social_platform AS ENUM ('facebook_page');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_post_status') THEN
    CREATE TYPE public.social_post_status AS ENUM (
      'draft',
      'pending_approval',
      'scheduled',
      'publishing',
      'published',
      'failed',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_post_category') THEN
    CREATE TYPE public.social_post_category AS ENUM (
      'word_of_day',
      'study_tip',
      'parent_tip',
      'value_of_week',
      'school_update',
      'custom'
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2) Tables
-- ----------------------------------------------------------------------------

-- Facebook (and future) account connections.
-- Note: token_ciphertext is encrypted in Edge Functions using SOCIAL_TOKEN_ENCRYPTION_KEY.
CREATE TABLE IF NOT EXISTS public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  platform public.social_platform NOT NULL,
  page_id text NOT NULL,
  page_name text,
  token_ciphertext text NOT NULL,
  token_expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, platform, page_id)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_org ON public.social_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON public.social_connections(platform);

DROP TRIGGER IF EXISTS social_connections_updated_at ON public.social_connections;
CREATE TRIGGER social_connections_updated_at
BEFORE UPDATE ON public.social_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-organization agent settings.
CREATE TABLE IF NOT EXISTS public.social_agent_settings (
  organization_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  autopost_enabled boolean NOT NULL DEFAULT false,
  autopost_schedule text NOT NULL DEFAULT 'mon_wed_fri'
    CHECK (autopost_schedule IN ('mon_wed_fri', 'weekdays', 'daily', 'off')),
  autopost_time_local time NOT NULL DEFAULT '08:00:00',
  timezone text,
  default_category public.social_post_category NOT NULL DEFAULT 'study_tip',
  require_approval_for_media boolean NOT NULL DEFAULT true,
  require_approval_for_school_updates boolean NOT NULL DEFAULT true,
  brand_voice jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS social_agent_settings_updated_at ON public.social_agent_settings;
CREATE TRIGGER social_agent_settings_updated_at
BEFORE UPDATE ON public.social_agent_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Post drafts and publish state.
CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  connection_id uuid REFERENCES public.social_connections(id) ON DELETE SET NULL,
  platform public.social_platform NOT NULL DEFAULT 'facebook_page',
  category public.social_post_category NOT NULL DEFAULT 'custom',
  status public.social_post_status NOT NULL DEFAULT 'draft',
  content text NOT NULL,
  media jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_approval boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  error_message text,
  ai_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_org_status_created
ON public.social_posts(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_due
ON public.social_posts(scheduled_at)
WHERE status = 'scheduled';

DROP TRIGGER IF EXISTS social_posts_updated_at ON public.social_posts;
CREATE TRIGGER social_posts_updated_at
BEFORE UPDATE ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3) Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- Helper: admin-level roles scoped to an organization
-- (profiles.id may be auth.uid() OR profiles.auth_user_id may be auth.uid()).

DROP POLICY IF EXISTS social_connections_admin_select ON public.social_connections;
CREATE POLICY social_connections_admin_select
ON public.social_connections
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_connections.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

DROP POLICY IF EXISTS social_connections_admin_insert ON public.social_connections;
CREATE POLICY social_connections_admin_insert
ON public.social_connections
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_connections.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

DROP POLICY IF EXISTS social_connections_admin_update ON public.social_connections;
CREATE POLICY social_connections_admin_update
ON public.social_connections
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_connections.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_connections.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

DROP POLICY IF EXISTS social_connections_admin_delete ON public.social_connections;
CREATE POLICY social_connections_admin_delete
ON public.social_connections
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_connections.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

-- Settings policies
DROP POLICY IF EXISTS social_agent_settings_admin_select ON public.social_agent_settings;
CREATE POLICY social_agent_settings_admin_select
ON public.social_agent_settings
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_agent_settings.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

DROP POLICY IF EXISTS social_agent_settings_admin_upsert ON public.social_agent_settings;
CREATE POLICY social_agent_settings_admin_upsert
ON public.social_agent_settings
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_agent_settings.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_agent_settings.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

-- Posts policies
DROP POLICY IF EXISTS social_posts_admin_select ON public.social_posts;
CREATE POLICY social_posts_admin_select
ON public.social_posts
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_posts.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

DROP POLICY IF EXISTS social_posts_admin_modify ON public.social_posts;
DROP POLICY IF EXISTS social_posts_admin_insert ON public.social_posts;
CREATE POLICY social_posts_admin_insert
ON public.social_posts
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_posts.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

DROP POLICY IF EXISTS social_posts_admin_update ON public.social_posts;
CREATE POLICY social_posts_admin_update
ON public.social_posts
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_posts.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_posts.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

DROP POLICY IF EXISTS social_posts_admin_delete ON public.social_posts;
CREATE POLICY social_posts_admin_delete
ON public.social_posts
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = social_posts.organization_id
      AND p.role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  )
);

-- ----------------------------------------------------------------------------
-- 4) Scheduling Helper (claim due posts)
-- ----------------------------------------------------------------------------
-- Atomically claims due scheduled posts for publishing (avoids double-posting).
CREATE OR REPLACE FUNCTION public.claim_due_social_posts(p_limit integer DEFAULT 20)
RETURNS TABLE (
  post_id uuid,
  organization_id uuid,
  platform public.social_platform,
  page_id text,
  token_ciphertext text,
  content text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT sp.id, c.page_id, c.token_ciphertext
    FROM public.social_posts sp
    JOIN public.social_connections c ON c.id = sp.connection_id
    WHERE sp.status = 'scheduled'::public.social_post_status
      AND sp.scheduled_at IS NOT NULL
      AND sp.scheduled_at <= now()
      AND sp.connection_id IS NOT NULL
      AND c.is_active = true
    ORDER BY sp.scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.social_posts sp
    SET status = 'publishing'::public.social_post_status,
        updated_at = now()
    FROM due
    WHERE sp.id = due.id
    RETURNING
      sp.id AS post_id,
      sp.organization_id,
      sp.platform,
      due.page_id,
      due.token_ciphertext,
      sp.content
  )
  SELECT u.post_id, u.organization_id, u.platform, u.page_id, u.token_ciphertext, u.content
  FROM updated u;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5) Grants
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_agent_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;

GRANT EXECUTE ON FUNCTION public.claim_due_social_posts(integer) TO service_role;
