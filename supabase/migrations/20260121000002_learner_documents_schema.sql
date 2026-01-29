-- Migration: Learner Documents Storage and Schema
-- Date: 2026-01-21
-- Description: Creates storage and tables for learner document uploads including:
--   - CV (Curriculum Vitae)
--   - SARS Documents (Tax related)
--   - Certificates (Educational, Professional)
--   - Bank Confirmation Letter
--   - ID Document (Identity document)
--   - Qualifications (Degrees, Diplomas, etc.)
--   - Other supporting documents

BEGIN;

-- ============================================================================
-- 1. CREATE LEARNER DOCUMENTS TABLE
-- ============================================================================

-- Drop existing table if it exists (for clean re-run)
DROP TABLE IF EXISTS public.learner_documents CASCADE;

-- Create learner_documents table
CREATE TABLE public.learner_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Document metadata
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'cv',
    'sars_document',
    'certificate',
    'bank_confirmation',
    'id_document',
    'qualification',
    'matric_certificate',
    'drivers_license',
    'passport',
    'reference_letter',
    'proof_of_address',
    'other'
  )),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- File info
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
  
  -- Status and verification
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  
  -- Expiry (for documents like ID, driver's license)
  expiry_date DATE,
  is_expired BOOLEAN NOT NULL DEFAULT false,
  
  -- Document specific metadata (JSON for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Visibility
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_learner_documents_learner_id ON public.learner_documents(learner_id);
CREATE INDEX idx_learner_documents_type ON public.learner_documents(document_type);
CREATE INDEX idx_learner_documents_status ON public.learner_documents(status);
CREATE INDEX idx_learner_documents_created ON public.learner_documents(created_at DESC);

-- Keep is_expired in sync with expiry_date
CREATE OR REPLACE FUNCTION set_learner_documents_is_expired()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_expired := NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS learner_documents_set_is_expired ON public.learner_documents;
CREATE TRIGGER learner_documents_set_is_expired
  BEFORE INSERT OR UPDATE ON public.learner_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_learner_documents_is_expired();

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_learner_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER learner_documents_updated_at
  BEFORE UPDATE ON public.learner_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_learner_documents_updated_at();

-- ============================================================================
-- 2. CREATE STORAGE BUCKET
-- ============================================================================

-- Create learner-documents bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'learner-documents',
  'learner-documents',
  FALSE, -- Private bucket - requires signed URLs
  20971520, -- 20MB limit (for high-res scans)
  ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/heic', 
    'image/heif', 
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 3. RLS POLICIES FOR TABLE
-- ============================================================================

-- Enable RLS on learner_documents table
ALTER TABLE public.learner_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "learner_documents_select_own" ON public.learner_documents;
DROP POLICY IF EXISTS "learner_documents_insert_own" ON public.learner_documents;
DROP POLICY IF EXISTS "learner_documents_update_own" ON public.learner_documents;
DROP POLICY IF EXISTS "learner_documents_delete_own" ON public.learner_documents;
DROP POLICY IF EXISTS "learner_documents_admin_all" ON public.learner_documents;

-- Learners can view their own documents
CREATE POLICY "learner_documents_select_own"
ON public.learner_documents
FOR SELECT
TO authenticated
USING (
  learner_id = auth.uid()
  OR is_public = true
);

-- Learners can insert their own documents
CREATE POLICY "learner_documents_insert_own"
ON public.learner_documents
FOR INSERT
TO authenticated
WITH CHECK (learner_id = auth.uid());

-- Learners can update their own documents
CREATE POLICY "learner_documents_update_own"
ON public.learner_documents
FOR UPDATE
TO authenticated
USING (learner_id = auth.uid())
WITH CHECK (learner_id = auth.uid());

-- Learners can delete their own documents
CREATE POLICY "learner_documents_delete_own"
ON public.learner_documents
FOR DELETE
TO authenticated
USING (learner_id = auth.uid());

-- Admins/Verifiers can view all documents (guard for missing columns)
DO $admin_policy$
DECLARE
  has_profiles BOOLEAN;
  has_profile_role BOOLEAN;
  has_org_members BOOLEAN;
  has_om_user_id BOOLEAN;
  has_om_member_type BOOLEAN;
  has_om_membership_status BOOLEAN;
  profile_clause TEXT := '';
  org_clause TEXT := '';
  policy_condition TEXT := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO has_profiles;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) INTO has_profile_role;

  IF has_profiles AND has_profile_role THEN
    profile_clause := 'EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''super_admin'', ''admin'', ''principal''))';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_members'
  ) INTO has_org_members;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'user_id'
  ) INTO has_om_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'member_type'
  ) INTO has_om_member_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'membership_status'
  ) INTO has_om_membership_status;

  IF has_org_members AND has_om_user_id AND has_om_member_type THEN
    org_clause := 'EXISTS (SELECT 1 FROM organization_members om WHERE om.user_id = auth.uid()';
    IF has_om_membership_status THEN
      org_clause := org_clause || ' AND om.membership_status = ''active''';
    END IF;
    org_clause := org_clause || ' AND om.member_type IN (''youth_president'', ''youth_secretary'', ''president'', ''secretary_general'', ''ceo'', ''national_admin''))';
  END IF;

  IF profile_clause = '' AND org_clause = '' THEN
    RAISE NOTICE 'Skipping learner_documents_admin_all policy: required columns missing';
    RETURN;
  END IF;

  policy_condition := profile_clause;
  IF policy_condition <> '' AND org_clause <> '' THEN
    policy_condition := policy_condition || ' OR ' || org_clause;
  ELSIF policy_condition = '' THEN
    policy_condition := org_clause;
  END IF;

  EXECUTE 'CREATE POLICY learner_documents_admin_all ON public.learner_documents FOR ALL TO authenticated USING (' || policy_condition || ')';
END;
$admin_policy$;

-- Service role has full access
CREATE POLICY "learner_documents_service_role"
ON public.learner_documents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 4. STORAGE RLS POLICIES
-- ============================================================================

DO $storage_policies$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';

      EXECUTE 'DROP POLICY IF EXISTS learner_docs_upload ON storage.objects';
      EXECUTE 'DROP POLICY IF EXISTS learner_docs_view_own ON storage.objects';
      EXECUTE 'DROP POLICY IF EXISTS learner_docs_update_own ON storage.objects';
      EXECUTE 'DROP POLICY IF EXISTS learner_docs_delete_own ON storage.objects';
      EXECUTE 'DROP POLICY IF EXISTS learner_docs_admin_view ON storage.objects';

      EXECUTE 'CREATE POLICY learner_docs_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''learner-documents'' AND (storage.foldername(name))[1] = auth.uid()::text)';
      EXECUTE 'CREATE POLICY learner_docs_view_own ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''learner-documents'' AND (storage.foldername(name))[1] = auth.uid()::text)';
      EXECUTE 'CREATE POLICY learner_docs_update_own ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = ''learner-documents'' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = ''learner-documents'' AND (storage.foldername(name))[1] = auth.uid()::text)';
      EXECUTE 'CREATE POLICY learner_docs_delete_own ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''learner-documents'' AND (storage.foldername(name))[1] = auth.uid()::text)';

      EXECUTE 'CREATE POLICY learner_docs_admin_view ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''learner-documents'' AND (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''super_admin'', ''admin'', ''principal'')) OR EXISTS (SELECT 1 FROM organization_members om WHERE om.user_id = auth.uid() AND om.member_type IN (''youth_president'', ''youth_secretary'', ''president'', ''secretary_general'', ''ceo'', ''national_admin''))))';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping storage.objects policies: insufficient privilege';
    END;
  ELSE
    RAISE NOTICE 'Skipping storage.objects policies: storage.objects table missing';
  END IF;
END;
$storage_policies$;

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Generate upload path for learner document
CREATE OR REPLACE FUNCTION generate_learner_document_path(
  p_learner_id UUID,
  p_doc_type TEXT,
  p_file_extension TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_path TEXT;
  v_timestamp TEXT;
  v_random TEXT;
BEGIN
  v_timestamp := EXTRACT(EPOCH FROM NOW())::TEXT;
  v_random := substr(md5(random()::text), 1, 8);
  
  -- Path format: learner_id/doc_type/timestamp-random.ext
  v_path := p_learner_id::TEXT || '/' || p_doc_type || '/' || v_timestamp || '-' || v_random || '.' || p_file_extension;
  
  RETURN v_path;
END;
$$;

-- Get learner document summary
CREATE OR REPLACE FUNCTION get_learner_document_summary(p_learner_id UUID)
RETURNS TABLE (
  document_type VARCHAR(50),
  count BIGINT,
  latest_upload TIMESTAMPTZ,
  has_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ld.document_type,
    COUNT(*)::BIGINT,
    MAX(ld.created_at),
    BOOL_OR(ld.status = 'verified')
  FROM public.learner_documents ld
  WHERE ld.learner_id = p_learner_id
    AND ld.is_active = true
  GROUP BY ld.document_type
  ORDER BY ld.document_type;
END;
$$;

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.learner_documents IS 'Stores learner document uploads including CV, SARS documents, certificates, ID documents, qualifications, etc.';

COMMENT ON COLUMN public.learner_documents.document_type IS 'Type of document: cv, sars_document, certificate, bank_confirmation, id_document, qualification, matric_certificate, drivers_license, passport, reference_letter, proof_of_address, other';

COMMENT ON COLUMN public.learner_documents.status IS 'Verification status: pending, verified, rejected, expired';

COMMENT ON COLUMN public.learner_documents.metadata IS 'Flexible JSON field for document-specific metadata like certificate issuer, qualification level, etc.';

COMMIT;
