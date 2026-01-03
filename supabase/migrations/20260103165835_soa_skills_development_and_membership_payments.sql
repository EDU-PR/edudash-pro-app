-- ============================================================================
-- SOA Skills Development & Membership Payment System Migration
-- Date: 2026-01-03
-- Status: APPLIED
-- Purpose: 
--   1. Add skills_development and membership_org to organization_type enum
--   2. Create membership fee payment flow (bank transfer + POP + PayFast)
--   3. Enable EduDash Pro as payment intermediary for organizations
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add new organization types to the enum
-- ============================================================================

-- Add skills_development to organization_type enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'organization_type' AND e.enumlabel = 'skills_development'
  ) THEN
    ALTER TYPE organization_type ADD VALUE IF NOT EXISTS 'skills_development';
  END IF;
END $$;

-- Add membership_org to organization_type enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'organization_type' AND e.enumlabel = 'membership_org'
  ) THEN
    ALTER TYPE organization_type ADD VALUE IF NOT EXISTS 'membership_org';
  END IF;
END $$;

-- Add npo (non-profit organization) to organization_type enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'organization_type' AND e.enumlabel = 'npo'
  ) THEN
    ALTER TYPE organization_type ADD VALUE IF NOT EXISTS 'npo';
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: Add tier columns to membership_fee_structure
-- ============================================================================

ALTER TABLE membership_fee_structure 
ADD COLUMN IF NOT EXISTS tier_name TEXT,
ADD COLUMN IF NOT EXISTS tier_benefits JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tier_color TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- ============================================================================
-- SECTION 3: Membership POP Uploads (Similar to pop_uploads for preschools)
-- ============================================================================

CREATE TABLE IF NOT EXISTS membership_pop_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  member_fee_id UUID REFERENCES member_fees(id) ON DELETE SET NULL,
  
  -- Upload details
  upload_type TEXT NOT NULL DEFAULT 'proof_of_payment' CHECK (upload_type IN ('proof_of_payment', 'bank_confirmation', 'receipt')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  
  -- Payment details
  payment_amount DECIMAL(10,2),
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'cash_deposit', 'card', 'payfast', 'other')),
  bank_reference TEXT,
  
  -- Status workflow
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'requires_clarification')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Notes
  uploader_notes TEXT,
  reviewer_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_membership_pop_org ON membership_pop_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_membership_pop_member ON membership_pop_uploads(member_id);
CREATE INDEX IF NOT EXISTS idx_membership_pop_status ON membership_pop_uploads(status);
CREATE INDEX IF NOT EXISTS idx_membership_pop_fee ON membership_pop_uploads(member_fee_id);

COMMENT ON TABLE membership_pop_uploads IS 'Proof of payment uploads for membership fees (mirrors pop_uploads)';

-- Enable RLS
ALTER TABLE membership_pop_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "membership_pop_select" ON membership_pop_uploads;
CREATE POLICY "membership_pop_select" ON membership_pop_uploads
  FOR SELECT USING (
    -- Member can see own uploads
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.id = membership_pop_uploads.member_id AND om.user_id = auth.uid()
    )
    OR
    -- Org admins/treasurers can see all uploads
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = membership_pop_uploads.organization_id 
      AND om.user_id = auth.uid()
      AND om.member_type IN ('admin', 'national_admin', 'regional_manager', 'staff', 'youth_treasurer', 'women_treasurer')
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "membership_pop_insert" ON membership_pop_uploads;
CREATE POLICY "membership_pop_insert" ON membership_pop_uploads
  FOR INSERT WITH CHECK (
    -- Member can upload own POP
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.id = membership_pop_uploads.member_id AND om.user_id = auth.uid()
    )
    OR
    -- Admins can upload on behalf
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = membership_pop_uploads.organization_id 
      AND om.user_id = auth.uid()
      AND om.member_type IN ('admin', 'national_admin', 'regional_manager', 'staff')
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "membership_pop_update" ON membership_pop_uploads;
CREATE POLICY "membership_pop_update" ON membership_pop_uploads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = membership_pop_uploads.organization_id 
      AND om.user_id = auth.uid()
      AND om.member_type IN ('admin', 'national_admin', 'regional_manager', 'staff', 'youth_treasurer', 'women_treasurer')
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- SECTION 4: EduDash Pro as Payment Intermediary
-- ============================================================================

-- Platform collected payments - payments made TO EduDash Pro
CREATE TABLE IF NOT EXISTS platform_collected_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who paid
  payer_type TEXT NOT NULL CHECK (payer_type IN ('member', 'parent', 'student', 'organization')),
  payer_user_id UUID REFERENCES auth.users(id),
  payer_member_id UUID REFERENCES organization_members(id),
  payer_profile_id UUID REFERENCES profiles(id),
  
  -- What org this payment is for
  destination_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Payment details
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('payfast', 'bank_transfer', 'card', 'manual')),
  payment_reference TEXT,
  
  -- External payment info
  payfast_payment_id TEXT,
  payfast_pf_payment_id TEXT,
  bank_reference TEXT,
  
  -- What is being paid for
  payment_purpose TEXT NOT NULL CHECK (payment_purpose IN ('membership_fee', 'school_fee', 'course_fee', 'event_fee', 'donation', 'other')),
  related_fee_id UUID, -- Can be member_fees.id or student_fees.id
  related_invoice_id UUID REFERENCES member_invoices(id),
  description TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
  
  -- Disbursement to org
  disbursement_status TEXT DEFAULT 'pending' CHECK (disbursement_status IN ('pending', 'scheduled', 'processing', 'completed', 'failed')),
  disbursement_date DATE,
  disbursement_reference TEXT,
  
  -- Fees (EduDash Pro processing fee)
  platform_fee_amount DECIMAL(10,2) DEFAULT 0,
  platform_fee_percent DECIMAL(5,2) DEFAULT 2.5, -- 2.5% default
  net_amount DECIMAL(12,2), -- Amount to disburse to org
  
  -- Timestamps
  payment_date TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_payments_dest_org ON platform_collected_payments(destination_organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_payments_payer ON platform_collected_payments(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_payments_status ON platform_collected_payments(status);
CREATE INDEX IF NOT EXISTS idx_platform_payments_disbursement ON platform_collected_payments(disbursement_status);
CREATE INDEX IF NOT EXISTS idx_platform_payments_payfast ON platform_collected_payments(payfast_payment_id);

COMMENT ON TABLE platform_collected_payments IS 'Payments collected by EduDash Pro on behalf of organizations (intermediary model)';

-- Enable RLS
ALTER TABLE platform_collected_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "platform_payments_select" ON platform_collected_payments;
CREATE POLICY "platform_payments_select" ON platform_collected_payments
  FOR SELECT USING (
    -- Payer can see own payments
    payer_user_id = auth.uid()
    OR
    -- Org admins can see payments to their org
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = platform_collected_payments.destination_organization_id 
      AND om.user_id = auth.uid()
      AND om.member_type IN ('admin', 'national_admin', 'regional_manager', 'treasurer')
    )
    OR
    -- School principals can see payments
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = platform_collected_payments.destination_organization_id
      AND p.role = 'principal'
    )
    OR
    -- Super admin can see all
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "platform_payments_insert" ON platform_collected_payments;
CREATE POLICY "platform_payments_insert" ON platform_collected_payments
  FOR INSERT WITH CHECK (
    -- User can create payment for themselves
    payer_user_id = auth.uid()
    OR
    -- Super admin can create any payment
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- SECTION 5: Platform Disbursements (EduDash Pro paying out to orgs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Disbursement details
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  
  -- Bank account to pay to
  bank_account_id UUID REFERENCES organization_bank_accounts(id),
  bank_name TEXT,
  account_number_last4 TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  scheduled_date DATE,
  processed_at TIMESTAMPTZ,
  
  -- Reference
  reference TEXT,
  batch_id TEXT, -- For batch processing
  
  -- Payments included in this disbursement
  included_payment_ids UUID[] DEFAULT '{}',
  payment_count INTEGER DEFAULT 0,
  
  -- Notes
  notes TEXT,
  failure_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_disbursements_org ON platform_disbursements(organization_id);
CREATE INDEX IF NOT EXISTS idx_disbursements_status ON platform_disbursements(status);
CREATE INDEX IF NOT EXISTS idx_disbursements_scheduled ON platform_disbursements(scheduled_date);

COMMENT ON TABLE platform_disbursements IS 'Disbursements from EduDash Pro to organizations';

-- Enable RLS
ALTER TABLE platform_disbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disbursements_select" ON platform_disbursements;
CREATE POLICY "disbursements_select" ON platform_disbursements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = platform_disbursements.organization_id 
      AND om.user_id = auth.uid()
      AND om.member_type IN ('admin', 'national_admin', 'treasurer')
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.preschool_id = platform_disbursements.organization_id
      AND p.role = 'principal'
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- SECTION 6: Helper Functions
-- ============================================================================

-- Function to approve membership POP and update fee status
CREATE OR REPLACE FUNCTION approve_membership_pop(
  p_pop_id UUID,
  p_reviewer_notes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pop RECORD;
  v_fee_id UUID;
BEGIN
  -- Get POP details
  SELECT * INTO v_pop FROM membership_pop_uploads WHERE id = p_pop_id;
  
  IF v_pop IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'POP not found');
  END IF;
  
  -- Update POP status
  UPDATE membership_pop_uploads SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewer_notes = p_reviewer_notes,
    updated_at = now()
  WHERE id = p_pop_id;
  
  -- Update related fee to paid
  IF v_pop.member_fee_id IS NOT NULL THEN
    UPDATE member_fees SET
      status = 'paid',
      last_payment_date = COALESCE(v_pop.payment_date, CURRENT_DATE),
      last_payment_amount = v_pop.payment_amount,
      paid_amount = COALESCE(paid_amount, 0) + COALESCE(v_pop.payment_amount, final_amount),
      payment_count = payment_count + 1,
      updated_at = now()
    WHERE id = v_pop.member_fee_id;
    v_fee_id := v_pop.member_fee_id;
  ELSE
    -- Try to match to oldest pending fee for this member
    SELECT id INTO v_fee_id 
    FROM member_fees 
    WHERE member_id = v_pop.member_id 
    AND status IN ('pending', 'overdue', 'partial')
    ORDER BY due_date ASC
    LIMIT 1;
    
    IF v_fee_id IS NOT NULL THEN
      UPDATE member_fees SET
        status = 'paid',
        last_payment_date = COALESCE(v_pop.payment_date, CURRENT_DATE),
        last_payment_amount = v_pop.payment_amount,
        paid_amount = COALESCE(paid_amount, 0) + COALESCE(v_pop.payment_amount, final_amount),
        payment_count = payment_count + 1,
        updated_at = now()
      WHERE id = v_fee_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'pop_id', p_pop_id,
    'fee_id', v_fee_id
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION approve_membership_pop(UUID, TEXT) TO authenticated;

-- ============================================================================
-- SECTION 7: Seed SOA Fee Structures
-- ============================================================================

DO $$
DECLARE
  v_soa_id UUID;
BEGIN
  -- Try to find SOA organization
  SELECT id INTO v_soa_id FROM organizations 
  WHERE name ILIKE '%soil of africa%' OR name ILIKE '%SOA%'
  LIMIT 1;
  
  -- If found, seed fee structures
  IF v_soa_id IS NOT NULL THEN
    -- Community Tier (Free)
    INSERT INTO membership_fee_structure (
      organization_id, fee_name, fee_code, fee_type, amount, 
      description, tier_name, tier_benefits, tier_color, display_order,
      membership_tiers, is_active
    ) VALUES (
      v_soa_id, 'Community Membership', 'COMM-2026', 'annual', 0, 
      'Free community membership with basic access',
      'Community',
      '["Access to community events", "Monthly newsletter", "Online community access"]'::jsonb,
      '#6B7280', 1,
      ARRAY['community'], true
    ) ON CONFLICT (organization_id, fee_code) DO UPDATE SET 
      tier_name = EXCLUDED.tier_name,
      tier_benefits = EXCLUDED.tier_benefits;
    
    -- Active Tier (R250/year)
    INSERT INTO membership_fee_structure (
      organization_id, fee_name, fee_code, fee_type, amount, 
      description, tier_name, tier_benefits, tier_color, display_order,
      membership_tiers, is_active
    ) VALUES (
      v_soa_id, 'Active Membership', 'ACTIVE-2026', 'annual', 250, 
      'Full membership with skills development access',
      'Active',
      '["All Community benefits", "Skills development programs", "Networking events", "Mentorship matching", "Regional meetups"]'::jsonb,
      '#3B82F6', 2,
      ARRAY['active', 'standard'], true
    ) ON CONFLICT (organization_id, fee_code) DO UPDATE SET 
      tier_name = EXCLUDED.tier_name,
      tier_benefits = EXCLUDED.tier_benefits;
    
    -- VIP Tier (R1000/year)
    INSERT INTO membership_fee_structure (
      organization_id, fee_name, fee_code, fee_type, amount, 
      description, tier_name, tier_benefits, tier_color, display_order,
      membership_tiers, is_active
    ) VALUES (
      v_soa_id, 'VIP Membership', 'VIP-2026', 'annual', 1000, 
      'Premium membership with exclusive benefits',
      'VIP',
      '["All Active benefits", "Priority program placement", "1-on-1 career coaching", "VIP events access", "Sponsor networking", "Certificate programs"]'::jsonb,
      '#F59E0B', 3,
      ARRAY['vip', 'premium'], true
    ) ON CONFLICT (organization_id, fee_code) DO UPDATE SET 
      tier_name = EXCLUDED.tier_name,
      tier_benefits = EXCLUDED.tier_benefits;
    
    RAISE NOTICE 'SOA fee structures seeded successfully';
  END IF;
END $$;

-- ============================================================================
-- SECTION 8: Comments
-- ============================================================================

COMMENT ON COLUMN membership_fee_structure.tier_name IS 'User-friendly tier name: Community, Active, VIP';
COMMENT ON COLUMN membership_fee_structure.tier_benefits IS 'JSON array of benefits included in this tier';
COMMENT ON COLUMN platform_collected_payments.platform_fee_percent IS 'EduDash Pro processing fee percentage (default 2.5%)';
COMMENT ON COLUMN platform_collected_payments.net_amount IS 'Amount to be disbursed to organization after fees';
COMMENT ON COLUMN platform_disbursements.included_payment_ids IS 'Array of payment IDs included in this disbursement batch';
