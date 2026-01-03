-- Unified Organization Join Requests System
-- Date: 2026-01-03
-- Purpose: Create a unified join_requests table that replaces fragmented invite systems
-- 
-- This migration consolidates:
-- - parent_join_requests
-- - teacher_invites 
-- - guardian_requests (partial - for new requests)
-- Into a single unified system with proper enum types

-- Step 1: Create enum for request types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'join_request_type') THEN
    CREATE TYPE join_request_type AS ENUM (
      'teacher_invite',     -- Principal invites teacher to join school
      'parent_join',        -- Parent requests to join organization
      'member_join',        -- General member joining membership org (SOA)
      'guardian_claim',     -- Parent claiming existing student
      'staff_invite',       -- Inviting administrative staff
      'learner_enroll'      -- Learner enrollment request
    );
  END IF;
END
$$;

-- Step 2: Create enum for request status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'join_request_status') THEN
    CREATE TYPE join_request_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'expired',
      'cancelled',
      'revoked'
    );
  END IF;
END
$$;

-- Step 3: Create unified join_requests table
CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request type and status
  request_type join_request_type NOT NULL,
  status join_request_status NOT NULL DEFAULT 'pending',
  
  -- Who is requesting/being invited
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email TEXT, -- For invites before user exists
  requester_phone TEXT, -- For phone-based invites
  
  -- Target organization/entity
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE, -- Legacy support
  
  -- For guardian claims - which student
  target_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  
  -- Invitation details
  invite_code TEXT UNIQUE,
  invite_token TEXT, -- Secure token for accepting invite
  invited_by UUID REFERENCES auth.users(id),
  
  -- Request metadata
  message TEXT,
  relationship TEXT, -- For guardian: 'mother', 'father', 'guardian', etc.
  requested_role TEXT DEFAULT 'parent', -- Role being requested
  
  -- Review/approval
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Expiration
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_requester CHECK (
    requester_id IS NOT NULL OR 
    requester_email IS NOT NULL OR 
    requester_phone IS NOT NULL
  ),
  CONSTRAINT valid_target CHECK (
    organization_id IS NOT NULL OR 
    preschool_id IS NOT NULL
  )
);

-- Step 4: Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_join_requests_requester_id 
  ON join_requests(requester_id) WHERE requester_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_join_requests_requester_email 
  ON join_requests(requester_email) WHERE requester_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_join_requests_organization_id 
  ON join_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_preschool_id 
  ON join_requests(preschool_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status 
  ON join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_type_status 
  ON join_requests(request_type, status);
CREATE INDEX IF NOT EXISTS idx_join_requests_invite_code 
  ON join_requests(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_join_requests_invite_token 
  ON join_requests(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_join_requests_expires_at 
  ON join_requests(expires_at) WHERE status = 'pending';

-- Step 5: Add comments
COMMENT ON TABLE join_requests IS 'Unified table for all organization join requests and invitations';
COMMENT ON COLUMN join_requests.request_type IS 'Type of join request: teacher_invite, parent_join, member_join, guardian_claim, staff_invite, learner_enroll';
COMMENT ON COLUMN join_requests.requester_id IS 'Auth user ID if requester has an account';
COMMENT ON COLUMN join_requests.requester_email IS 'Email for invites before user creates account';
COMMENT ON COLUMN join_requests.invite_code IS 'Short human-readable code for invite links (e.g., ABC123)';
COMMENT ON COLUMN join_requests.invite_token IS 'Secure token for accepting invitations';
COMMENT ON COLUMN join_requests.relationship IS 'For guardian claims: relationship to student';
COMMENT ON COLUMN join_requests.requested_role IS 'The role being requested (parent, teacher, member, etc.)';

-- Step 6: Enable RLS
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- Step 7: RLS Policies

-- Users can view their own requests
CREATE POLICY "Users can view own join requests"
  ON join_requests
  FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid() OR
    requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Users can create join requests for themselves
CREATE POLICY "Users can create own join requests"
  ON join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = auth.uid() OR
    requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Users can cancel their own pending requests
CREATE POLICY "Users can cancel own pending requests"
  ON join_requests
  FOR UPDATE
  TO authenticated
  USING (
    (requester_id = auth.uid() OR requester_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND status = 'pending'
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- Principals/admins can view requests for their organization
CREATE POLICY "Admins can view org join requests"
  ON join_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin', 'super_admin', 'national_admin', 'regional_admin')
        AND (
          p.organization_id = join_requests.organization_id
          OR p.preschool_id = join_requests.preschool_id
          OR p.role IN ('super_admin', 'national_admin')
        )
    )
  );

-- Principals/admins can create invites for their organization
CREATE POLICY "Admins can create invites"
  ON join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only for invite types
    request_type IN ('teacher_invite', 'staff_invite')
    AND invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin', 'super_admin', 'national_admin', 'regional_admin')
        AND (
          p.organization_id = join_requests.organization_id
          OR p.preschool_id = join_requests.preschool_id
          OR p.role IN ('super_admin', 'national_admin')
        )
    )
  );

-- Principals/admins can update (approve/reject) requests for their organization
CREATE POLICY "Admins can update org join requests"
  ON join_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin', 'super_admin', 'national_admin', 'regional_admin')
        AND (
          p.organization_id = join_requests.organization_id
          OR p.preschool_id = join_requests.preschool_id
          OR p.role IN ('super_admin', 'national_admin')
        )
    )
  )
  WITH CHECK (TRUE);

-- Service role has full access
CREATE POLICY "Service role full access to join_requests"
  ON join_requests
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Step 8: Function to generate secure invite token
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
BEGIN
  -- Generate a 48-character secure token
  SELECT encode(gen_random_bytes(36), 'base64') INTO token;
  -- Replace URL-unsafe characters
  token := replace(replace(token, '+', '-'), '/', '_');
  RETURN token;
END;
$$;

-- Step 9: Function to generate short invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude confusing chars (0,O,1,I)
  i INTEGER;
BEGIN
  code := '';
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- Step 10: Trigger to auto-generate tokens on insert
CREATE OR REPLACE FUNCTION set_invite_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate invite token if not provided
  IF NEW.invite_token IS NULL THEN
    NEW.invite_token := generate_invite_token();
  END IF;
  
  -- Generate invite code for invite types
  IF NEW.invite_code IS NULL AND NEW.request_type IN ('teacher_invite', 'staff_invite', 'member_join') THEN
    -- Try up to 10 times to generate unique code
    FOR i IN 1..10 LOOP
      NEW.invite_code := generate_invite_code();
      BEGIN
        -- Check if code exists
        PERFORM 1 FROM join_requests WHERE invite_code = NEW.invite_code;
        IF NOT FOUND THEN
          EXIT; -- Unique code found
        END IF;
      EXCEPTION WHEN OTHERS THEN
        EXIT; -- On error, proceed with current code
      END;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_invite_tokens ON join_requests;
CREATE TRIGGER tr_set_invite_tokens
  BEFORE INSERT ON join_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_invite_tokens();

-- Step 11: Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_join_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_join_requests_updated_at ON join_requests;
CREATE TRIGGER tr_join_requests_updated_at
  BEFORE UPDATE ON join_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_join_requests_updated_at();

-- Step 12: Function to handle request approval
CREATE OR REPLACE FUNCTION handle_join_request_approval()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only process if status changed to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Set review metadata
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, NOW());
    NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
    
    -- Handle based on request type
    CASE NEW.request_type
      WHEN 'teacher_invite' THEN
        -- Update teacher's profile with organization
        UPDATE profiles
        SET 
          organization_id = NEW.organization_id,
          preschool_id = COALESCE(NEW.preschool_id, NEW.organization_id),
          role = 'teacher',
          updated_at = NOW()
        WHERE id = NEW.requester_id;
        
      WHEN 'parent_join' THEN
        -- Update parent's profile with organization
        UPDATE profiles
        SET 
          organization_id = NEW.organization_id,
          preschool_id = COALESCE(NEW.preschool_id, NEW.organization_id),
          updated_at = NOW()
        WHERE id = NEW.requester_id;
        
      WHEN 'member_join' THEN
        -- For membership organizations, create/update member record
        -- This is handled by the organization membership system
        NULL;
        
      WHEN 'guardian_claim' THEN
        -- Link parent to student
        IF NEW.target_student_id IS NOT NULL THEN
          UPDATE students
          SET 
            parent_id = NEW.requester_id,
            updated_at = NOW()
          WHERE id = NEW.target_student_id
            AND parent_id IS NULL; -- Only if not already linked
        END IF;
        
      WHEN 'staff_invite' THEN
        -- Update staff profile
        UPDATE profiles
        SET 
          organization_id = NEW.organization_id,
          role = COALESCE(NEW.requested_role, 'admin'),
          updated_at = NOW()
        WHERE id = NEW.requester_id;
        
      WHEN 'learner_enroll' THEN
        -- Enrollment is handled separately
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_handle_join_request_approval ON join_requests;
CREATE TRIGGER tr_handle_join_request_approval
  BEFORE UPDATE ON join_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_join_request_approval();

-- Step 13: RPC to accept invite by token
CREATE OR REPLACE FUNCTION accept_join_request(
  p_invite_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request join_requests%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Find the request
  SELECT * INTO v_request
  FROM join_requests
  WHERE invite_token = p_invite_token
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > NOW())
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Verify the user matches the invite
  IF v_request.requester_id IS NOT NULL AND v_request.requester_id != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Invitation is for a different user');
  END IF;
  
  IF v_request.requester_email IS NOT NULL THEN
    IF v_request.requester_email != (SELECT email FROM auth.users WHERE id = v_user_id) THEN
      RETURN json_build_object('success', false, 'error', 'Invitation is for a different email address');
    END IF;
  END IF;
  
  -- Update requester_id if it was null (invite accepted by email)
  IF v_request.requester_id IS NULL THEN
    UPDATE join_requests SET requester_id = v_user_id WHERE id = v_request.id;
  END IF;
  
  -- Approve the request (trigger will handle the rest)
  UPDATE join_requests
  SET status = 'approved', reviewed_at = NOW()
  WHERE id = v_request.id;
  
  RETURN json_build_object(
    'success', true,
    'request_type', v_request.request_type,
    'organization_id', v_request.organization_id
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION accept_join_request(TEXT) TO authenticated;

-- Step 14: RPC to validate invite code (public)
CREATE OR REPLACE FUNCTION validate_join_invite_code(
  p_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request join_requests%ROWTYPE;
  v_org organizations%ROWTYPE;
BEGIN
  -- Find the request
  SELECT * INTO v_request
  FROM join_requests
  WHERE UPPER(invite_code) = UPPER(p_code)
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid or expired invite code');
  END IF;
  
  -- Get organization details
  SELECT * INTO v_org
  FROM organizations
  WHERE id = v_request.organization_id;
  
  RETURN json_build_object(
    'valid', true,
    'request_type', v_request.request_type,
    'organization_name', v_org.name,
    'organization_id', v_request.organization_id,
    'invite_token', v_request.invite_token
  );
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION validate_join_invite_code(TEXT) TO anon, authenticated;

-- Step 15: Function to expire old requests (for cron job)
CREATE OR REPLACE FUNCTION expire_old_join_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE join_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Unified join_requests system created successfully';
END
$$;
