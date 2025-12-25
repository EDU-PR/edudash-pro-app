-- Migration: Organization Document Vault
-- Purpose: Secure document storage with encryption, access control, and audit trail
-- Supports: President, Secretary General, and authorized members

-- ============================================================================
-- 1. CREATE DOCUMENT FOLDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES organization_document_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#3B82F6',
  -- Access level: who can see this folder by default
  default_access_level TEXT NOT NULL DEFAULT 'admin_only' 
    CHECK (default_access_level IN ('public', 'members', 'managers', 'executives', 'admin_only')),
  -- Folder path for hierarchical structure (e.g., /governance/policies)
  folder_path TEXT NOT NULL DEFAULT '/',
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, folder_path, name)
);

-- ============================================================================
-- 2. CREATE DOCUMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES organization_document_folders(id) ON DELETE SET NULL,
  
  -- Document info
  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL DEFAULT 'general' 
    CHECK (document_type IN ('general', 'policy', 'legal', 'financial', 'governance', 'disciplinary', 'template', 'certificate', 'report', 'confidential')),
  
  -- File storage
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER, -- in bytes
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- Path in Supabase storage
  
  -- Encryption (for sensitive documents)
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  encryption_key_id TEXT, -- Reference to encryption key (stored securely)
  encryption_algorithm TEXT DEFAULT 'AES-256-GCM',
  
  -- Version control
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID REFERENCES organization_documents(id),
  
  -- Access control
  access_level TEXT NOT NULL DEFAULT 'admin_only' 
    CHECK (access_level IN ('public', 'members', 'managers', 'executives', 'admin_only', 'custom')),
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Ownership
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  
  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 3. CREATE DOCUMENT ACCESS GRANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_document_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES organization_documents(id) ON DELETE CASCADE,
  -- Either grant to a specific user or a role/group
  grantee_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_role TEXT, -- 'regional_manager', 'branch_manager', etc.
  grantee_region_id UUID REFERENCES organization_regions(id) ON DELETE CASCADE,
  
  -- Permission level
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'download', 'edit', 'admin')),
  
  -- Time-limited access
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  
  -- Approval workflow
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  revoked_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure at least one grantee type is set
  CONSTRAINT valid_grantee CHECK (
    grantee_user_id IS NOT NULL OR 
    grantee_role IS NOT NULL OR 
    grantee_region_id IS NOT NULL
  )
);

-- ============================================================================
-- 4. CREATE DOCUMENT ACCESS REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_document_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES organization_documents(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Request details
  requested_permission TEXT NOT NULL DEFAULT 'view' CHECK (requested_permission IN ('view', 'download', 'edit')),
  reason TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  
  -- Response
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- If approved, the access grant
  access_grant_id UUID REFERENCES organization_document_access(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- ============================================================================
-- 5. CREATE DOCUMENT AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_document_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES organization_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Action type
  action TEXT NOT NULL CHECK (action IN (
    'view', 'download', 'upload', 'update', 'delete', 'restore',
    'share', 'revoke_access', 'request_access', 'approve_access', 'deny_access',
    'encrypt', 'decrypt', 'print', 'export'
  )),
  
  -- Details
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_doc_folders_org ON organization_document_folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_parent ON organization_document_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON organization_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON organization_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON organization_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_access ON organization_documents(access_level);
CREATE INDEX IF NOT EXISTS idx_doc_access_document ON organization_document_access(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_user ON organization_document_access(grantee_user_id);
CREATE INDEX IF NOT EXISTS idx_doc_requests_document ON organization_document_access_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_requests_requester ON organization_document_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_doc_requests_status ON organization_document_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_doc_audit_document ON organization_document_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_audit_user ON organization_document_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_audit_action ON organization_document_audit_log(action);

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE organization_document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_document_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_document_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_document_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. RLS POLICIES FOR FOLDERS
-- ============================================================================

-- Policy: Members can view folders they have access to
DROP POLICY IF EXISTS "members_view_folders" ON organization_document_folders;
CREATE POLICY "members_view_folders" ON organization_document_folders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_document_folders.organization_id
      AND om.membership_status = 'active'
      AND (
        organization_document_folders.default_access_level = 'public'
        OR organization_document_folders.default_access_level = 'members'
        OR (organization_document_folders.default_access_level = 'managers' AND om.role IN ('admin', 'national_admin', 'regional_manager', 'branch_manager'))
        OR (organization_document_folders.default_access_level = 'executives' AND om.role IN ('admin', 'national_admin'))
        OR (organization_document_folders.default_access_level = 'admin_only' AND om.role IN ('admin', 'national_admin'))
      )
    )
  );

-- Policy: Admins can create/update folders
DROP POLICY IF EXISTS "admins_manage_folders" ON organization_document_folders;
CREATE POLICY "admins_manage_folders" ON organization_document_folders
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_document_folders.organization_id
      AND om.role IN ('admin', 'national_admin')
      AND om.membership_status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_document_folders.organization_id
      AND om.role IN ('admin', 'national_admin')
      AND om.membership_status = 'active'
    )
  );

-- ============================================================================
-- 9. RLS POLICIES FOR DOCUMENTS
-- ============================================================================

-- Policy: Members can view documents based on access level
DROP POLICY IF EXISTS "members_view_documents" ON organization_documents;
CREATE POLICY "members_view_documents" ON organization_documents
  FOR SELECT TO authenticated
  USING (
    is_deleted = FALSE
    AND (
      -- Public documents
      access_level = 'public'
      -- Or user is a member with appropriate role
      OR EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_documents.organization_id
        AND om.membership_status = 'active'
        AND (
          access_level = 'members'
          OR (access_level = 'managers' AND om.role IN ('admin', 'national_admin', 'regional_manager', 'branch_manager'))
          OR (access_level = 'executives' AND om.role IN ('admin', 'national_admin'))
          OR (access_level = 'admin_only' AND om.role IN ('admin', 'national_admin'))
        )
      )
      -- Or user has explicit access grant
      OR EXISTS (
        SELECT 1 FROM organization_document_access oda
        WHERE oda.document_id = organization_documents.id
        AND oda.grantee_user_id = auth.uid()
        AND oda.revoked_at IS NULL
        AND (oda.valid_until IS NULL OR oda.valid_until > now())
      )
    )
  );

-- Policy: Admins can manage documents
DROP POLICY IF EXISTS "admins_manage_documents" ON organization_documents;
CREATE POLICY "admins_manage_documents" ON organization_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_documents.organization_id
      AND om.role IN ('admin', 'national_admin')
      AND om.membership_status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_documents.organization_id
      AND om.role IN ('admin', 'national_admin')
      AND om.membership_status = 'active'
    )
  );

-- ============================================================================
-- 10. RLS POLICIES FOR ACCESS GRANTS
-- ============================================================================

DROP POLICY IF EXISTS "admins_manage_access" ON organization_document_access;
CREATE POLICY "admins_manage_access" ON organization_document_access
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_documents od
      JOIN organization_members om ON om.organization_id = od.organization_id
      WHERE od.id = organization_document_access.document_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'national_admin')
      AND om.membership_status = 'active'
    )
  );

DROP POLICY IF EXISTS "users_view_own_access" ON organization_document_access;
CREATE POLICY "users_view_own_access" ON organization_document_access
  FOR SELECT TO authenticated
  USING (grantee_user_id = auth.uid());

-- ============================================================================
-- 11. RLS POLICIES FOR ACCESS REQUESTS
-- ============================================================================

DROP POLICY IF EXISTS "users_manage_own_requests" ON organization_document_access_requests;
CREATE POLICY "users_manage_own_requests" ON organization_document_access_requests
  FOR ALL TO authenticated
  USING (requester_id = auth.uid())
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "admins_review_requests" ON organization_document_access_requests;
CREATE POLICY "admins_review_requests" ON organization_document_access_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_documents od
      JOIN organization_members om ON om.organization_id = od.organization_id
      WHERE od.id = organization_document_access_requests.document_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'national_admin')
      AND om.membership_status = 'active'
    )
  );

-- ============================================================================
-- 12. RLS POLICIES FOR AUDIT LOG
-- ============================================================================

DROP POLICY IF EXISTS "admins_view_audit" ON organization_document_audit_log;
CREATE POLICY "admins_view_audit" ON organization_document_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_documents od
      JOIN organization_members om ON om.organization_id = od.organization_id
      WHERE od.id = organization_document_audit_log.document_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'national_admin')
      AND om.membership_status = 'active'
    )
  );

DROP POLICY IF EXISTS "users_view_own_audit" ON organization_document_audit_log;
CREATE POLICY "users_view_own_audit" ON organization_document_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Insert audit entries (service role or trigger)
DROP POLICY IF EXISTS "insert_audit" ON organization_document_audit_log;
CREATE POLICY "insert_audit" ON organization_document_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 13. HELPER FUNCTIONS
-- ============================================================================

-- Function to log document access
CREATE OR REPLACE FUNCTION log_document_access(
  p_document_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO organization_document_audit_log (document_id, user_id, action, details)
  VALUES (p_document_id, auth.uid(), p_action, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check document access
CREATE OR REPLACE FUNCTION check_document_access(
  p_document_id UUID,
  p_required_permission TEXT DEFAULT 'view'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_access BOOLEAN := FALSE;
  v_doc RECORD;
BEGIN
  -- Get document info
  SELECT * INTO v_doc FROM organization_documents WHERE id = p_document_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  
  -- Check if deleted
  IF v_doc.is_deleted THEN RETURN FALSE; END IF;
  
  -- Check member role-based access
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = v_doc.organization_id
    AND om.membership_status = 'active'
    AND (
      v_doc.access_level = 'public'
      OR v_doc.access_level = 'members'
      OR (v_doc.access_level = 'managers' AND om.role IN ('admin', 'national_admin', 'regional_manager', 'branch_manager'))
      OR (v_doc.access_level = 'executives' AND om.role IN ('admin', 'national_admin'))
      OR (v_doc.access_level = 'admin_only' AND om.role IN ('admin', 'national_admin'))
    )
  ) INTO v_has_access;
  
  IF v_has_access THEN RETURN TRUE; END IF;
  
  -- Check explicit access grants
  SELECT EXISTS (
    SELECT 1 FROM organization_document_access oda
    WHERE oda.document_id = p_document_id
    AND oda.grantee_user_id = auth.uid()
    AND oda.revoked_at IS NULL
    AND (oda.valid_until IS NULL OR oda.valid_until > now())
    AND (
      (p_required_permission = 'view')
      OR (p_required_permission = 'download' AND oda.permission IN ('download', 'edit', 'admin'))
      OR (p_required_permission = 'edit' AND oda.permission IN ('edit', 'admin'))
      OR (p_required_permission = 'admin' AND oda.permission = 'admin')
    )
  ) INTO v_has_access;
  
  RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 14. TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_updated_at ON organization_documents;
CREATE TRIGGER trigger_document_updated_at
  BEFORE UPDATE ON organization_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_updated_at();

DROP TRIGGER IF EXISTS trigger_folder_updated_at ON organization_document_folders;
CREATE TRIGGER trigger_folder_updated_at
  BEFORE UPDATE ON organization_document_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_document_updated_at();

-- ============================================================================
-- 15. CREATE STORAGE BUCKET
-- ============================================================================

-- Note: This needs to be run separately or via Supabase dashboard
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'organization-documents',
--   'organization-documents', 
--   false,
--   52428800, -- 50MB
--   ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
--         'application/vnd.oasis.opendocument.text', 'image/png', 'image/jpeg', 'application/zip']
-- );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE organization_document_folders IS 'Folder structure for organizing documents';
COMMENT ON TABLE organization_documents IS 'Secure document storage with encryption support';
COMMENT ON TABLE organization_document_access IS 'Explicit access grants for documents';
COMMENT ON TABLE organization_document_access_requests IS 'Access request workflow';
COMMENT ON TABLE organization_document_audit_log IS 'Audit trail for all document actions';
COMMENT ON FUNCTION log_document_access IS 'Logs document access for audit trail';
COMMENT ON FUNCTION check_document_access IS 'Checks if user has required permission for document';
