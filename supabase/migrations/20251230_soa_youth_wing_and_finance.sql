-- ============================================
-- SOA Youth Wing and Sub-Structures Migration
-- Date: 2024-12-30
-- Purpose: Add Youth Wing hierarchy, Women's League, and financial tracking
-- ============================================

-- ============================================================================
-- SECTION 1: Add Wing/Chapter Support to Organization Members
-- ============================================================================

-- Add wing column to organization_members
ALTER TABLE organization_members 
ADD COLUMN IF NOT EXISTS wing TEXT DEFAULT 'main';

-- Add constraint for wing values (drop first if exists)
DO $$ 
BEGIN
  ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_wing_check;
  ALTER TABLE organization_members ADD CONSTRAINT organization_members_wing_check 
    CHECK (wing IN ('main', 'youth', 'women', 'veterans'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Update member_type constraint to include sub-structure roles
ALTER TABLE organization_members 
DROP CONSTRAINT IF EXISTS organization_members_member_type_check;

ALTER TABLE organization_members 
ADD CONSTRAINT organization_members_member_type_check 
CHECK (member_type IN (
  -- Main structure
  'learner', 'mentor', 'facilitator', 'staff', 'admin', 
  'regional_manager', 'national_admin',
  -- Youth Wing
  'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
  'youth_coordinator', 'youth_facilitator', 'youth_mentor', 'youth_member',
  -- Women's League
  'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
  'women_coordinator', 'women_facilitator', 'women_mentor', 'women_member',
  -- Veterans League (future)
  'veterans_president', 'veterans_coordinator', 'veterans_member'
));

-- Add age restriction fields for youth wing
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS birth_year INTEGER,
ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;

-- Add appointed_by tracking
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS appointed_by UUID REFERENCES organization_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS appointed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_org_members_wing ON organization_members(wing);
CREATE INDEX IF NOT EXISTS idx_org_members_birth_year ON organization_members(birth_year);
CREATE INDEX IF NOT EXISTS idx_org_members_appointed_by ON organization_members(appointed_by);

COMMENT ON COLUMN organization_members.wing IS 'Organization wing/chapter: main, youth, women, veterans';
COMMENT ON COLUMN organization_members.appointed_by IS 'Member who appointed this member';

-- ============================================================================
-- SECTION 2: Organization Sub-Structures (Wings) Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_wings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Wing identification
  wing_code TEXT NOT NULL CHECK (wing_code IN ('youth', 'women', 'veterans')),
  name TEXT NOT NULL,
  description TEXT,
  motto TEXT,
  
  -- Leadership (references to organization_members)
  president_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  deputy_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  secretary_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  treasurer_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  
  -- Age restrictions (for youth wing: 18-35)
  min_age INTEGER,
  max_age INTEGER,
  
  -- Financial allocation
  annual_budget DECIMAL(12,2) DEFAULT 0,
  monthly_allocation DECIMAL(10,2) DEFAULT 0,
  current_balance DECIMAL(12,2) DEFAULT 0,
  
  -- Contact
  email TEXT,
  phone TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  established_date DATE,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT unique_org_wing UNIQUE (organization_id, wing_code)
);

CREATE INDEX IF NOT EXISTS idx_org_wings_organization ON organization_wings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_wings_code ON organization_wings(wing_code);
CREATE INDEX IF NOT EXISTS idx_org_wings_president ON organization_wings(president_id);

COMMENT ON TABLE organization_wings IS 'Sub-structures within organizations (Youth Wing, Women''s League, Veterans)';

-- ============================================================================
-- SECTION 3: Wing Regional Coordinators
-- ============================================================================

CREATE TABLE IF NOT EXISTS wing_regional_coordinators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wing_id UUID NOT NULL REFERENCES organization_wings(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES organization_regions(id) ON DELETE CASCADE,
  coordinator_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  
  -- Financial
  monthly_float DECIMAL(10,2) DEFAULT 10000,
  current_balance DECIMAL(10,2) DEFAULT 0,
  spending_limit DECIMAL(10,2) DEFAULT 1000,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  appointed_date DATE DEFAULT CURRENT_DATE,
  appointed_by UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  
  -- Contact override
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_wing_region UNIQUE (wing_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_wing_coords_wing ON wing_regional_coordinators(wing_id);
CREATE INDEX IF NOT EXISTS idx_wing_coords_region ON wing_regional_coordinators(region_id);
CREATE INDEX IF NOT EXISTS idx_wing_coords_coordinator ON wing_regional_coordinators(coordinator_id);

COMMENT ON TABLE wing_regional_coordinators IS 'Regional coordinators for each wing (Youth Coordinator per province)';

-- ============================================================================
-- SECTION 4: Organization Bank Accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Account details
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN (
    'main_operating', 'membership_fees', 'programmes', 
    'regional_float', 'youth_wing', 'women_league', 'veterans_league', 'petty_cash'
  )),
  bank_name TEXT NOT NULL,
  account_number_masked TEXT, -- Last 4 digits only for display
  branch_code TEXT,
  swift_code TEXT,
  
  -- Linked entities (null for main account)
  region_id UUID REFERENCES organization_regions(id) ON DELETE SET NULL,
  wing_id UUID REFERENCES organization_wings(id) ON DELETE SET NULL,
  
  -- Financial limits
  spending_limit_per_transaction DECIMAL(12,2),
  spending_limit_daily DECIMAL(12,2),
  spending_limit_monthly DECIMAL(12,2),
  float_amount DECIMAL(12,2),
  current_balance DECIMAL(12,2) DEFAULT 0,
  
  -- Signatories (stored as array of member IDs)
  signatories JSONB DEFAULT '[]'::jsonb,
  required_signatures INTEGER DEFAULT 2,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_org ON organization_bank_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON organization_bank_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_region ON organization_bank_accounts(region_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_wing ON organization_bank_accounts(wing_id);

COMMENT ON TABLE organization_bank_accounts IS 'Organization bank accounts including sub-accounts for regions and wings';

-- ============================================================================
-- SECTION 5: Financial Transactions (Organization Level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Account reference
  account_id UUID REFERENCES organization_bank_accounts(id) ON DELETE SET NULL,
  region_id UUID REFERENCES organization_regions(id) ON DELETE SET NULL,
  wing_id UUID REFERENCES organization_wings(id) ON DELETE SET NULL,
  
  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'income', 'expense', 'transfer_in', 'transfer_out', 
    'allocation', 'refund', 'adjustment', 'membership_fee'
  )),
  category TEXT NOT NULL,
  subcategory TEXT,
  
  -- Amounts
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  vat_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Description
  description TEXT NOT NULL,
  reference_number TEXT,
  external_reference TEXT, -- Bank reference
  invoice_number TEXT,
  
  -- Linked member (for membership fees)
  member_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  
  -- Supporting documents
  receipt_url TEXT,
  invoice_url TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Approval workflow
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'draft', 'pending', 'submitted', 'approved', 'rejected', 'paid', 'cancelled', 'reconciled'
  )),
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Payment details
  payment_method TEXT CHECK (payment_method IN (
    'eft', 'cash', 'cheque', 'card', 'mobile_money', 'payfast', 'other'
  )),
  payment_date DATE,
  payee_name TEXT,
  payee_account TEXT,
  
  -- Reconciliation
  reconciled BOOLEAN DEFAULT false,
  reconciled_by UUID REFERENCES auth.users(id),
  reconciled_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_transactions_org ON organization_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_transactions_account ON organization_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_org_transactions_region ON organization_transactions(region_id);
CREATE INDEX IF NOT EXISTS idx_org_transactions_wing ON organization_transactions(wing_id);
CREATE INDEX IF NOT EXISTS idx_org_transactions_member ON organization_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_org_transactions_status ON organization_transactions(status);
CREATE INDEX IF NOT EXISTS idx_org_transactions_type ON organization_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_org_transactions_date ON organization_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_org_transactions_category ON organization_transactions(category);
CREATE INDEX IF NOT EXISTS idx_org_transactions_payment_date ON organization_transactions(payment_date);

COMMENT ON TABLE organization_transactions IS 'All financial transactions for the organization and sub-structures';

-- ============================================================================
-- SECTION 6: Budget Allocations
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Budget period
  fiscal_year INTEGER NOT NULL,
  period_type TEXT DEFAULT 'annual' CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Allocation target
  region_id UUID REFERENCES organization_regions(id) ON DELETE SET NULL,
  wing_id UUID REFERENCES organization_wings(id) ON DELETE SET NULL,
  department TEXT,
  category TEXT NOT NULL,
  
  -- Amounts
  budgeted_amount DECIMAL(12,2) NOT NULL,
  allocated_amount DECIMAL(12,2) DEFAULT 0,
  spent_amount DECIMAL(12,2) DEFAULT 0,
  committed_amount DECIMAL(12,2) DEFAULT 0, -- Approved but not yet paid
  
  -- Computed remaining
  remaining_amount DECIMAL(12,2) GENERATED ALWAYS AS (budgeted_amount - spent_amount - committed_amount) STORED,
  utilization_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN budgeted_amount > 0 THEN (spent_amount / budgeted_amount * 100) ELSE 0 END
  ) STORED,
  
  -- Notes
  notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'approved', 'active', 'frozen', 'closed')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_budgets_org ON organization_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_budgets_year ON organization_budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budgets_region ON organization_budgets(region_id);
CREATE INDEX IF NOT EXISTS idx_budgets_wing ON organization_budgets(wing_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON organization_budgets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON organization_budgets(category);

COMMENT ON TABLE organization_budgets IS 'Budget allocations by region, wing, department, and category';

-- ============================================================================
-- SECTION 7: Membership Fee Structure
-- ============================================================================

CREATE TABLE IF NOT EXISTS membership_fee_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Fee details
  fee_name TEXT NOT NULL,
  fee_code TEXT NOT NULL,
  fee_type TEXT NOT NULL CHECK (fee_type IN (
    'registration', 'annual', 'monthly', 'programme', 'event', 'id_card', 'replacement_card'
  )),
  description TEXT,
  
  -- Applicable to
  member_types TEXT[] DEFAULT ARRAY['learner'],
  wings TEXT[] DEFAULT ARRAY['main'],
  membership_tiers TEXT[] DEFAULT ARRAY['standard'],
  regions TEXT[], -- NULL means all regions
  
  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  
  -- VAT
  includes_vat BOOLEAN DEFAULT false,
  vat_percent DECIMAL(5,2) DEFAULT 15,
  
  -- Validity
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_to DATE,
  
  -- Discounts
  early_bird_discount_percent DECIMAL(5,2) DEFAULT 0,
  early_bird_deadline_days INTEGER DEFAULT 30, -- Days before due
  pensioner_discount_percent DECIMAL(5,2) DEFAULT 0,
  student_discount_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Payment options
  allow_installments BOOLEAN DEFAULT false,
  installment_count INTEGER DEFAULT 1,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_mandatory BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT unique_fee_code UNIQUE (organization_id, fee_code)
);

CREATE INDEX IF NOT EXISTS idx_fee_structure_org ON membership_fee_structure(organization_id);
CREATE INDEX IF NOT EXISTS idx_fee_structure_type ON membership_fee_structure(fee_type);
CREATE INDEX IF NOT EXISTS idx_fee_structure_active ON membership_fee_structure(is_active);

COMMENT ON TABLE membership_fee_structure IS 'Fee structure defining costs for different member types and wings';

-- ============================================================================
-- SECTION 8: Member Fee Records (Individual member fees)
-- ============================================================================

CREATE TABLE IF NOT EXISTS member_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES membership_fee_structure(id) ON DELETE SET NULL,
  
  -- Fee details
  fee_type TEXT NOT NULL,
  fee_name TEXT NOT NULL,
  description TEXT,
  
  -- Period
  period_start DATE,
  period_end DATE,
  due_date DATE NOT NULL,
  
  -- Amounts
  original_amount DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_reason TEXT,
  final_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) GENERATED ALWAYS AS (final_amount - paid_amount) STORED,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'partial', 'paid', 'overdue', 'waived', 'cancelled', 'refunded'
  )),
  
  -- Payment tracking
  last_payment_date DATE,
  last_payment_amount DECIMAL(10,2),
  payment_count INTEGER DEFAULT 0,
  
  -- Reminders
  reminder_sent_count INTEGER DEFAULT 0,
  last_reminder_sent_at TIMESTAMPTZ,
  
  -- Linked transaction
  transaction_id UUID REFERENCES organization_transactions(id) ON DELETE SET NULL,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_member_fees_org ON member_fees(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_fees_member ON member_fees(member_id);
CREATE INDEX IF NOT EXISTS idx_member_fees_status ON member_fees(status);
CREATE INDEX IF NOT EXISTS idx_member_fees_due_date ON member_fees(due_date);
CREATE INDEX IF NOT EXISTS idx_member_fees_type ON member_fees(fee_type);

COMMENT ON TABLE member_fees IS 'Individual fee records for each member';

-- ============================================================================
-- SECTION 9: Petty Cash Management
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_petty_cash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Location
  region_id UUID REFERENCES organization_regions(id) ON DELETE SET NULL,
  wing_id UUID REFERENCES organization_wings(id) ON DELETE SET NULL,
  custodian_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  
  -- Amounts
  float_amount DECIMAL(10,2) NOT NULL DEFAULT 5000,
  current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_replenishment_date DATE,
  last_replenishment_amount DECIMAL(10,2),
  
  -- Limits
  max_single_expense DECIMAL(10,2) DEFAULT 500,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_org ON organization_petty_cash(organization_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_region ON organization_petty_cash(region_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_wing ON organization_petty_cash(wing_id);

-- ============================================================================
-- SECTION 10: Role Hierarchy Function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_appointable_roles(appointer_role TEXT, appointer_wing TEXT DEFAULT 'main')
RETURNS TEXT[] AS $$
BEGIN
  -- National Admin can appoint ALL roles across all wings
  IF appointer_role = 'national_admin' THEN
    RETURN ARRAY[
      -- Main structure
      'regional_manager', 'admin', 'staff', 'facilitator', 'mentor', 'learner',
      -- Youth Wing leadership
      'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
      'youth_coordinator', 'youth_facilitator', 'youth_mentor', 'youth_member',
      -- Women's League leadership
      'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
      'women_coordinator', 'women_facilitator', 'women_mentor', 'women_member',
      -- Veterans
      'veterans_president', 'veterans_coordinator', 'veterans_member'
    ];
  END IF;
  
  -- Regional Manager (main structure only)
  IF appointer_role = 'regional_manager' AND appointer_wing = 'main' THEN
    RETURN ARRAY['facilitator', 'mentor', 'learner'];
  END IF;
  
  -- Youth President can appoint youth wing roles
  IF appointer_role = 'youth_president' THEN
    RETURN ARRAY[
      'youth_deputy', 'youth_secretary', 'youth_treasurer',
      'youth_coordinator', 'youth_facilitator', 'youth_mentor', 'youth_member'
    ];
  END IF;
  
  -- Youth Deputy can appoint operational youth roles
  IF appointer_role = 'youth_deputy' THEN
    RETURN ARRAY['youth_coordinator', 'youth_facilitator', 'youth_mentor', 'youth_member'];
  END IF;
  
  -- Youth Coordinator (regional level)
  IF appointer_role = 'youth_coordinator' THEN
    RETURN ARRAY['youth_facilitator', 'youth_mentor', 'youth_member'];
  END IF;
  
  -- Women's President can appoint women's league roles
  IF appointer_role = 'women_president' THEN
    RETURN ARRAY[
      'women_deputy', 'women_secretary', 'women_treasurer',
      'women_coordinator', 'women_facilitator', 'women_mentor', 'women_member'
    ];
  END IF;
  
  -- Women's Deputy
  IF appointer_role = 'women_deputy' THEN
    RETURN ARRAY['women_coordinator', 'women_facilitator', 'women_mentor', 'women_member'];
  END IF;
  
  -- Women's Coordinator (regional level)
  IF appointer_role = 'women_coordinator' THEN
    RETURN ARRAY['women_facilitator', 'women_mentor', 'women_member'];
  END IF;
  
  -- Veterans President
  IF appointer_role = 'veterans_president' THEN
    RETURN ARRAY['veterans_coordinator', 'veterans_member'];
  END IF;
  
  -- Veterans Coordinator
  IF appointer_role = 'veterans_coordinator' THEN
    RETURN ARRAY['veterans_member'];
  END IF;
  
  -- Default: no appointment rights
  RETURN ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_appointable_roles IS 'Returns list of roles that can be appointed by a given role';

-- ============================================================================
-- SECTION 11: Financial Spending Limits Function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_spending_limit(member_role TEXT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN CASE member_role
    -- National Executive
    WHEN 'national_admin' THEN 100000.00
    WHEN 'admin' THEN 10000.00
    WHEN 'staff' THEN 2000.00
    
    -- Regional level
    WHEN 'regional_manager' THEN 5000.00
    
    -- Youth Wing
    WHEN 'youth_president' THEN 5000.00
    WHEN 'youth_deputy' THEN 3000.00
    WHEN 'youth_secretary' THEN 1000.00
    WHEN 'youth_treasurer' THEN 2000.00
    WHEN 'youth_coordinator' THEN 1000.00
    WHEN 'youth_facilitator' THEN 500.00
    
    -- Women's League
    WHEN 'women_president' THEN 5000.00
    WHEN 'women_deputy' THEN 3000.00
    WHEN 'women_secretary' THEN 1000.00
    WHEN 'women_treasurer' THEN 2000.00
    WHEN 'women_coordinator' THEN 1000.00
    WHEN 'women_facilitator' THEN 500.00
    
    -- Veterans
    WHEN 'veterans_president' THEN 3000.00
    WHEN 'veterans_coordinator' THEN 1000.00
    
    -- Others have no spending authority
    ELSE 0.00
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_spending_limit IS 'Returns maximum single transaction amount for a role (in ZAR)';

-- ============================================================================
-- SECTION 12: Check if user can approve transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION can_approve_transaction(
  approver_member_id UUID,
  transaction_amount DECIMAL,
  transaction_wing_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  approver_role TEXT;
  approver_wing TEXT;
  spending_limit DECIMAL;
BEGIN
  -- Get approver details
  SELECT member_type, wing INTO approver_role, approver_wing
  FROM organization_members
  WHERE id = approver_member_id;
  
  IF approver_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get spending limit
  spending_limit := get_spending_limit(approver_role);
  
  -- Check if amount is within limit
  IF transaction_amount > spending_limit THEN
    RETURN false;
  END IF;
  
  -- For wing transactions, check if approver belongs to that wing or is national_admin
  IF transaction_wing_id IS NOT NULL AND approver_role != 'national_admin' THEN
    -- Wing presidents/treasurers can approve their wing's transactions
    IF approver_wing != (SELECT wing_code FROM organization_wings WHERE id = transaction_wing_id) THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_approve_transaction IS 'Check if a member can approve a transaction based on role and amount';

-- ============================================================================
-- SECTION 13: Update Trigger for Budget Spent Amount
-- ============================================================================

CREATE OR REPLACE FUNCTION update_budget_spent()
RETURNS TRIGGER AS $$
BEGIN
  -- When a transaction is marked as paid, update the relevant budget
  IF NEW.status = 'paid' AND NEW.transaction_type = 'expense' THEN
    UPDATE organization_budgets
    SET spent_amount = spent_amount + NEW.amount,
        updated_at = now()
    WHERE organization_id = NEW.organization_id
      AND fiscal_year = EXTRACT(YEAR FROM NEW.payment_date)
      AND category = NEW.category
      AND status = 'active'
      AND (region_id = NEW.region_id OR (region_id IS NULL AND NEW.region_id IS NULL))
      AND (wing_id = NEW.wing_id OR (wing_id IS NULL AND NEW.wing_id IS NULL));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_budget_spent ON organization_transactions;
CREATE TRIGGER trg_update_budget_spent
  AFTER UPDATE ON organization_transactions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_budget_spent();

-- ============================================================================
-- SECTION 14: RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE organization_wings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wing_regional_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_petty_cash ENABLE ROW LEVEL SECURITY;

-- Organization Wings policies
DROP POLICY IF EXISTS "org_wings_select" ON organization_wings;
CREATE POLICY "org_wings_select" ON organization_wings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_wings.organization_id
    )
  );

DROP POLICY IF EXISTS "org_wings_manage" ON organization_wings;
CREATE POLICY "org_wings_manage" ON organization_wings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_wings.organization_id
        AND om.member_type = 'national_admin'
    )
  );

-- Transactions policies
DROP POLICY IF EXISTS "org_transactions_select" ON organization_transactions;
CREATE POLICY "org_transactions_select" ON organization_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_transactions.organization_id
        AND om.member_type IN ('national_admin', 'admin', 'regional_manager',
          'youth_president', 'youth_treasurer', 'women_president', 'women_treasurer')
    )
    OR submitted_by = auth.uid()
  );

DROP POLICY IF EXISTS "org_transactions_insert" ON organization_transactions;
CREATE POLICY "org_transactions_insert" ON organization_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_transactions.organization_id
        AND om.member_type IN ('national_admin', 'admin', 'staff', 'regional_manager',
          'youth_president', 'youth_deputy', 'youth_treasurer', 'youth_coordinator',
          'women_president', 'women_deputy', 'women_treasurer', 'women_coordinator')
    )
  );

-- Member fees policies
DROP POLICY IF EXISTS "member_fees_select" ON member_fees;
CREATE POLICY "member_fees_select" ON member_fees
  FOR SELECT TO authenticated
  USING (
    -- Own fees
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.id = member_fees.member_id
    )
    -- Or admin/finance roles
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = member_fees.organization_id
        AND om.member_type IN ('national_admin', 'admin', 'regional_manager',
          'youth_president', 'youth_treasurer', 'women_president', 'women_treasurer')
    )
  );

-- ============================================================================
-- SECTION 15: Default Fee Structure for SOA
-- ============================================================================

-- This can be run after organization creation
-- INSERT INTO membership_fee_structure (organization_id, fee_name, fee_code, fee_type, member_types, wings, amount)
-- SELECT 
--   id,
--   'Annual Membership Fee',
--   'ANNUAL_MAIN',
--   'annual',
--   ARRAY['learner', 'mentor', 'facilitator'],
--   ARRAY['main'],
--   250.00
-- FROM organizations WHERE slug = 'soil-of-africa'
-- ON CONFLICT (organization_id, fee_code) DO NOTHING;

COMMENT ON TABLE membership_fee_structure IS 'Default: R250 annual for main, R150 for youth, R200 for women';
