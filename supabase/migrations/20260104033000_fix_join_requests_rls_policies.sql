-- Add/Fix RLS policies for join_requests table
-- Date: 2026-01-04
-- Purpose: Fix 403/400 errors on join_requests table
-- Uses simplified subqueries that don't reference join_requests columns in the WHERE

-- First, drop any existing policies
DROP POLICY IF EXISTS "Users can view own join requests" ON join_requests;
DROP POLICY IF EXISTS "Users can create own join requests" ON join_requests;
DROP POLICY IF EXISTS "Users can cancel own pending requests" ON join_requests;
DROP POLICY IF EXISTS "Admins can view org join requests" ON join_requests;
DROP POLICY IF EXISTS "Admins can view all org join requests" ON join_requests;
DROP POLICY IF EXISTS "Admins can create invites" ON join_requests;
DROP POLICY IF EXISTS "Admins can process requests" ON join_requests;
DROP POLICY IF EXISTS "Admins can update org join requests" ON join_requests;
DROP POLICY IF EXISTS "Members can view org invite codes" ON join_requests;
DROP POLICY IF EXISTS "Service role full access to join_requests" ON join_requests;
DROP POLICY IF EXISTS "org_admins_manage_member_join_requests" ON join_requests;

-- =============================================================================
-- USER POLICIES
-- =============================================================================

-- Policy 1: Users can view their own requests
CREATE POLICY "Users can view own join requests"
  ON join_requests
  FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid() 
    OR requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy 2: Users can create join requests for themselves
CREATE POLICY "Users can create own join requests"
  ON join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = auth.uid() 
    OR requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy 3: Users can cancel their own pending requests
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

-- =============================================================================
-- ADMIN POLICIES (Simplified - don't reference join_requests in subquery WHERE)
-- =============================================================================

-- Policy 4: Organization admins can view ALL requests for their organization
-- Uses IN subquery instead of correlated EXISTS to avoid evaluation issues
CREATE POLICY "Admins can view all org join requests"
  ON join_requests
  FOR SELECT
  TO authenticated
  USING (
    -- Super/national admins can see everything
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'national_admin')
    )
    OR
    -- Org admins can see their org's requests
    organization_id IN (
      SELECT p.organization_id FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin', 'regional_admin', 'youth_president')
        AND p.organization_id IS NOT NULL
    )
    OR
    -- Preschool admins can see their preschool's requests
    preschool_id IN (
      SELECT p.preschool_id FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin')
        AND p.preschool_id IS NOT NULL
    )
  );

-- Policy 5: Organization admins can create invites
CREATE POLICY "Admins can create invites"
  ON join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super/national admins can create for any org
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'national_admin')
    )
    OR
    -- Org admins can create for their org
    organization_id IN (
      SELECT p.organization_id FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin', 'regional_admin', 'youth_president')
        AND p.organization_id IS NOT NULL
    )
    OR
    -- Preschool admins can create for their preschool
    preschool_id IN (
      SELECT p.preschool_id FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin')
        AND p.preschool_id IS NOT NULL
    )
  );

-- Policy 6: Organization admins can process (update) requests
CREATE POLICY "Admins can process requests"
  ON join_requests
  FOR UPDATE
  TO authenticated
  USING (
    -- Super/national admins can update any request
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'national_admin')
    )
    OR
    -- Org admins can update their org's requests
    organization_id IN (
      SELECT p.organization_id FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin', 'regional_admin', 'youth_president')
        AND p.organization_id IS NOT NULL
    )
    OR
    -- Preschool admins can update their preschool's requests
    preschool_id IN (
      SELECT p.preschool_id FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin')
        AND p.preschool_id IS NOT NULL
    )
  )
  WITH CHECK (
    status IN ('approved', 'rejected', 'cancelled', 'expired', 'revoked')
  );

-- =============================================================================
-- MEMBER POLICIES
-- =============================================================================

-- Policy 7: Organization members can view invite codes for their org
CREATE POLICY "Members can view org invite codes"
  ON join_requests
  FOR SELECT
  TO authenticated
  USING (
    invite_code IS NOT NULL
    AND organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- =============================================================================
-- SERVICE ROLE POLICY
-- =============================================================================

-- Policy 8: Service role has full access (for Edge Functions)
CREATE POLICY "Service role full access to join_requests"
  ON join_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
