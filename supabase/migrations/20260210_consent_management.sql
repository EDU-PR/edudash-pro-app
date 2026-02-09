-- =============================================================================
-- POPIA / COPPA / GDPR Consent Management Layer
-- Migration: 20260210_consent_management
--
-- Creates:
--   1. consent_records table — stores every consent action with audit trail
--   2. data_subject_requests table — POPIA §23-25, GDPR Art 15-22 rights
--   3. data_retention_policies table — configurable retention per data category
--   4. Adds consent columns to profiles
--   5. Extends audit_event_type enum with consent events
--   6. RLS policies for tenant isolation
--   7. Indexes for performance
-- =============================================================================

-- 1. Consent purpose enum
DO $$ BEGIN
  CREATE TYPE public.consent_purpose AS ENUM (
    'terms_of_service',
    'privacy_policy',
    'data_processing',
    'ai_data_usage',
    'marketing_communications',
    'analytics_tracking',
    'push_notifications',
    'media_upload',
    'parental_consent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Consent status enum
DO $$ BEGIN
  CREATE TYPE public.consent_status AS ENUM (
    'granted',
    'denied',
    'withdrawn',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Data subject request type enum
DO $$ BEGIN
  CREATE TYPE public.data_subject_request_type AS ENUM (
    'access',
    'rectification',
    'erasure',
    'portability',
    'restriction',
    'objection'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Data subject request status enum
DO $$ BEGIN
  CREATE TYPE public.data_subject_request_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'denied'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- consent_records — every consent action with full audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.consent_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose       public.consent_purpose NOT NULL,
  status        public.consent_status NOT NULL DEFAULT 'granted',
  version       TEXT NOT NULL DEFAULT '1.0',       -- policy version accepted
  granted_at    TIMESTAMPTZ,
  withdrawn_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,                       -- auto-expiry for time-limited consents
  ip_address    INET,
  user_agent    TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,         -- verification details, guardian info, etc.
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active consent per purpose per user (soft-unique: latest wins)
  CONSTRAINT consent_records_user_purpose_unique
    UNIQUE (user_id, purpose, version)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_consent_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consent_records_updated_at ON public.consent_records;
CREATE TRIGGER consent_records_updated_at
  BEFORE UPDATE ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.update_consent_records_updated_at();

-- =============================================================================
-- data_subject_requests — POPIA §23-25 / GDPR Art 15-22
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type    public.data_subject_request_type NOT NULL,
  status          public.data_subject_request_status NOT NULL DEFAULT 'pending',
  reason          TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,                  -- must acknowledge within 72h (GDPR)
  completed_at    TIMESTAMPTZ,
  response_data   JSONB DEFAULT '{}'::jsonb,    -- for access/portability: exported data summary
  processed_by    UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_data_subject_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS data_subject_requests_updated_at ON public.data_subject_requests;
CREATE TRIGGER data_subject_requests_updated_at
  BEFORE UPDATE ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_data_subject_requests_updated_at();

-- =============================================================================
-- data_retention_policies — configurable retention per data category
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category              TEXT NOT NULL UNIQUE,         -- e.g. 'homework_submissions', 'chat_messages'
  description           TEXT NOT NULL,
  retention_period_days INTEGER NOT NULL DEFAULT 365,  -- POPIA: reasonable retention
  legal_basis           TEXT NOT NULL DEFAULT 'legitimate_interest',
  auto_delete_enabled   BOOLEAN NOT NULL DEFAULT false,
  organization_id       UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Add consent fields to profiles table
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_version TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parental_consent_given BOOLEAN DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parental_consent_given_by UUID REFERENCES auth.users(id);
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parental_consent_given_at TIMESTAMPTZ;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coppa_verified BOOLEAN DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_processing_consent BOOLEAN DEFAULT false;
END $$;

-- =============================================================================
-- Extend audit_event_type enum with consent events
-- =============================================================================
DO $$ BEGIN
  ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'consent_granted';
  ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'consent_withdrawn';
  ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'consent_expired';
  ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'parental_consent_verified';
  ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'data_subject_request_submitted';
  ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'data_subject_request_completed';
  ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'data_erasure_executed';
  ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'privacy_settings_updated';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_consent_records_user_id
  ON public.consent_records(user_id);

CREATE INDEX IF NOT EXISTS idx_consent_records_user_purpose
  ON public.consent_records(user_id, purpose);

CREATE INDEX IF NOT EXISTS idx_consent_records_status
  ON public.consent_records(status) WHERE status = 'granted';

CREATE INDEX IF NOT EXISTS idx_consent_records_expires
  ON public.consent_records(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_user_id
  ON public.data_subject_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_status
  ON public.data_subject_requests(status) WHERE status IN ('pending', 'processing');

-- =============================================================================
-- RLS Policies — users can only see/manage their own consent records
-- =============================================================================
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- consent_records: users see their own
CREATE POLICY consent_records_select_own ON public.consent_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY consent_records_insert_own ON public.consent_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY consent_records_update_own ON public.consent_records
  FOR UPDATE USING (auth.uid() = user_id);

-- Parents can grant consent for their children (guardian_profile_id link)
CREATE POLICY consent_records_parent_insert ON public.consent_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = consent_records.user_id
        AND profiles.guardian_profile_id = (
          SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
        )
    )
  );

-- data_subject_requests: users see their own
CREATE POLICY data_subject_requests_select_own ON public.data_subject_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY data_subject_requests_insert_own ON public.data_subject_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- data_retention_policies: read-only for authenticated users
CREATE POLICY data_retention_policies_select_all ON public.data_retention_policies
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- Seed default retention policies
-- =============================================================================
INSERT INTO public.data_retention_policies (category, description, retention_period_days, legal_basis, auto_delete_enabled)
VALUES
  ('homework_submissions',  'Student homework submissions and grades',         730, 'legitimate_interest', false),
  ('chat_messages',         'Parent-teacher messaging history',                365, 'legitimate_interest', false),
  ('attendance_records',    'Student attendance logs',                         1095, 'legal_obligation',   false),
  ('ai_usage_logs',         'AI grading and lesson generation request logs',    180, 'consent',            true),
  ('push_notification_logs','Push notification delivery logs',                   90, 'legitimate_interest', true),
  ('audit_logs',            'System audit trail',                              1825, 'legal_obligation',   false),
  ('analytics_events',      'User interaction and analytics events',            365, 'consent',            true),
  ('media_uploads',         'Photos, videos, audio uploaded by users',          730, 'consent',            false),
  ('session_data',          'Auth session and refresh token data',               30, 'legitimate_interest', true)
ON CONFLICT (category) DO NOTHING;

-- =============================================================================
-- Helper function: check if user has active consent for a purpose
-- =============================================================================
CREATE OR REPLACE FUNCTION public.has_active_consent(
  p_user_id UUID,
  p_purpose public.consent_purpose
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.consent_records
    WHERE user_id = p_user_id
      AND purpose = p_purpose
      AND status = 'granted'
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper function: get all active consents for a user
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_consents(p_user_id UUID)
RETURNS TABLE (
  purpose public.consent_purpose,
  status public.consent_status,
  version TEXT,
  granted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (cr.purpose)
    cr.purpose,
    cr.status,
    cr.version,
    cr.granted_at,
    cr.expires_at
  FROM public.consent_records cr
  WHERE cr.user_id = p_user_id
  ORDER BY cr.purpose, cr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.consent_records IS 'POPIA/COPPA/GDPR consent records with full audit trail';
COMMENT ON TABLE public.data_subject_requests IS 'Data subject access/erasure/portability requests per POPIA §23-25, GDPR Art 15-22';
COMMENT ON TABLE public.data_retention_policies IS 'Configurable data retention periods per category with legal basis';
