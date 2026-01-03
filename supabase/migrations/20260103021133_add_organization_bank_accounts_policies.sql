-- ============================================================================
-- Migration: Add RLS policies for organization_bank_accounts
-- 
-- Fixes 400 error when principals try to manage bank accounts.
-- RLS was enabled but no policies were created.
-- ============================================================================

-- Drop existing policies if any (clean slate)
DROP POLICY IF EXISTS "bank_accounts_select" ON organization_bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_insert" ON organization_bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_update" ON organization_bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_delete" ON organization_bank_accounts;

-- SELECT: All members of an organization can view bank accounts
-- This includes parents and teachers who need to see banking info for payments
CREATE POLICY "bank_accounts_select" ON organization_bank_accounts
  FOR SELECT TO authenticated
  USING (
    -- SOA organization members (any member can view bank details for payments)
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_bank_accounts.organization_id
    )
    -- OR anyone who belongs to a preschool can view its bank details
    -- (parents, teachers, principals - all need to see payment info)
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.preschool_id = organization_bank_accounts.organization_id
    )
  );

-- INSERT: Admin roles can add bank accounts
CREATE POLICY "bank_accounts_insert" ON organization_bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    -- SOA organization admins
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_bank_accounts.organization_id
        AND om.member_type IN ('national_admin', 'admin')
    )
    -- OR principals/admins of preschools
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.preschool_id = organization_bank_accounts.organization_id
        AND p.role IN ('principal', 'principal_admin', 'super_admin')
    )
  );

-- UPDATE: Admin roles can update bank accounts
CREATE POLICY "bank_accounts_update" ON organization_bank_accounts
  FOR UPDATE TO authenticated
  USING (
    -- SOA organization admins
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_bank_accounts.organization_id
        AND om.member_type IN ('national_admin', 'admin')
    )
    -- OR principals/admins of preschools
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.preschool_id = organization_bank_accounts.organization_id
        AND p.role IN ('principal', 'principal_admin', 'super_admin')
    )
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_bank_accounts.organization_id
        AND om.member_type IN ('national_admin', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.preschool_id = organization_bank_accounts.organization_id
        AND p.role IN ('principal', 'principal_admin', 'super_admin')
    )
  );

-- DELETE: Only top-level admins can delete bank accounts
CREATE POLICY "bank_accounts_delete" ON organization_bank_accounts
  FOR DELETE TO authenticated
  USING (
    -- SOA national admins only
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_bank_accounts.organization_id
        AND om.member_type = 'national_admin'
    )
    -- OR principals of preschools
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.preschool_id = organization_bank_accounts.organization_id
        AND p.role IN ('principal', 'principal_admin', 'super_admin')
    )
  );

-- ============================================================================
-- Also add account_type values for preschool use cases
-- ============================================================================

-- Add preschool-specific account types to the check constraint
ALTER TABLE organization_bank_accounts 
  DROP CONSTRAINT IF EXISTS organization_bank_accounts_account_type_check;

ALTER TABLE organization_bank_accounts 
  ADD CONSTRAINT organization_bank_accounts_account_type_check 
  CHECK (account_type IN (
    -- Original SOA types
    'main_operating', 'membership_fees', 'programmes', 
    'regional_float', 'youth_wing', 'women_league', 'veterans_league', 'petty_cash',
    -- Preschool/school types
    'cheque', 'savings', 'current', 'business', 'school_fees', 'donations', 'transmission'
  ));

COMMENT ON TABLE organization_bank_accounts IS 'Bank accounts for organizations (SOA) and preschools. Used for payment collection and fee management.';
