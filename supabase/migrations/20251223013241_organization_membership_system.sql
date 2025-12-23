-- ============================================
-- Soil of Africa Organization Membership System
-- Date: 2025-12-23
-- Purpose: Complete membership management with regions, ID cards, resources, finance
-- ============================================

-- ============================================================================
-- SECTION 1: Organization Regions (Provincial Management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  province_code TEXT,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  coordinates JSONB,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_region_code UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_regions_organization_id ON organization_regions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_regions_code ON organization_regions(code);
CREATE INDEX IF NOT EXISTS idx_org_regions_province ON organization_regions(province_code);

COMMENT ON TABLE organization_regions IS 'Provincial/regional divisions within an organization';

-- ============================================================================
-- SECTION 2: Organization Members (Central Member Registry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_id UUID REFERENCES organization_regions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Member identification
  member_number TEXT NOT NULL,
  member_type TEXT NOT NULL CHECK (member_type IN ('learner', 'mentor', 'facilitator', 'staff', 'admin', 'regional_manager', 'national_admin')),
  
  -- Personal details (for non-registered users or additional info)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  id_number TEXT,
  date_of_birth DATE,
  gender TEXT,
  nationality TEXT DEFAULT 'South African',
  
  -- Contact
  email TEXT,
  phone TEXT,
  alt_phone TEXT,
  physical_address TEXT,
  postal_address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  
  -- Emergency contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Membership details
  membership_tier TEXT DEFAULT 'standard' CHECK (membership_tier IN ('standard', 'premium', 'vip', 'honorary')),
  membership_status TEXT DEFAULT 'pending' CHECK (membership_status IN ('pending', 'active', 'suspended', 'expired', 'cancelled')),
  joined_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  
  -- Photo and documents
  photo_url TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  skills JSONB DEFAULT '[]'::jsonb,
  interests JSONB DEFAULT '[]'::jsonb,
  qualifications JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT unique_member_number UNIQUE (organization_id, member_number)
);

CREATE INDEX IF NOT EXISTS idx_org_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_region_id ON organization_members(region_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_member_number ON organization_members(member_number);
CREATE INDEX IF NOT EXISTS idx_org_members_member_type ON organization_members(member_type);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(membership_status);
CREATE INDEX IF NOT EXISTS idx_org_members_email ON organization_members(email);

COMMENT ON TABLE organization_members IS 'Central registry of all organization members';

-- ============================================================================
-- SECTION 3: Member ID Cards
-- ============================================================================

CREATE TABLE IF NOT EXISTS member_id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Card details
  card_number TEXT NOT NULL,
  qr_code_data TEXT NOT NULL,
  barcode_data TEXT,
  
  -- Card status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'expired', 'replacement_requested')),
  issue_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  
  -- Card design
  card_template TEXT DEFAULT 'standard',
  custom_design JSONB DEFAULT '{}'::jsonb,
  
  -- Printing
  print_requested BOOLEAN DEFAULT false,
  print_requested_at TIMESTAMPTZ,
  printed BOOLEAN DEFAULT false,
  printed_at TIMESTAMPTZ,
  delivery_address TEXT,
  
  -- Verification
  last_verified_at TIMESTAMPTZ,
  verification_count INTEGER DEFAULT 0,
  
  -- Replacement tracking
  replaced_card_id UUID REFERENCES member_id_cards(id),
  replacement_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_card_number UNIQUE (organization_id, card_number)
);

CREATE INDEX IF NOT EXISTS idx_id_cards_member_id ON member_id_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_id_cards_organization_id ON member_id_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_id_cards_card_number ON member_id_cards(card_number);
CREATE INDEX IF NOT EXISTS idx_id_cards_qr_code ON member_id_cards(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_id_cards_status ON member_id_cards(status);

COMMENT ON TABLE member_id_cards IS 'Digital and physical ID cards for members';

-- ============================================================================
-- SECTION 4: Resource Hub
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES resource_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_category_slug UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_id UUID REFERENCES organization_regions(id) ON DELETE SET NULL,
  category_id UUID REFERENCES resource_categories(id) ON DELETE SET NULL,
  
  -- Resource details
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'video', 'audio', 'image', 'link', 'template', 'course_material', 'assessment', 'other')),
  
  -- File/URL
  file_url TEXT,
  file_size BIGINT,
  file_type TEXT,
  thumbnail_url TEXT,
  external_url TEXT,
  
  -- Access control
  visibility TEXT DEFAULT 'organization' CHECK (visibility IN ('public', 'organization', 'region', 'role_specific', 'private')),
  allowed_roles TEXT[] DEFAULT ARRAY['learner', 'mentor', 'facilitator', 'staff', 'admin']::text[],
  allowed_member_tiers TEXT[] DEFAULT ARRAY['standard', 'premium', 'vip', 'honorary']::text[],
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::text[],
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  
  -- Publishing
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_organization_id ON resources(organization_id);
CREATE INDEX IF NOT EXISTS idx_resources_region_id ON resources(region_id);
CREATE INDEX IF NOT EXISTS idx_resources_category_id ON resources(category_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_visibility ON resources(visibility);
CREATE INDEX IF NOT EXISTS idx_resources_published ON resources(is_published);
CREATE INDEX IF NOT EXISTS idx_resources_tags ON resources USING GIN(tags);

COMMENT ON TABLE resources IS 'Central resource repository for the organization';

-- ============================================================================
-- SECTION 5: Financial Management
-- ============================================================================

-- Fee structures
CREATE TABLE IF NOT EXISTS membership_fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('membership', 'course', 'learnership', 'certification', 'material', 'event', 'other')),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  billing_cycle TEXT CHECK (billing_cycle IN ('once', 'monthly', 'quarterly', 'annually')),
  applicable_member_types TEXT[] DEFAULT ARRAY['learner']::text[],
  applicable_tiers TEXT[] DEFAULT ARRAY['standard', 'premium', 'vip']::text[],
  is_active BOOLEAN DEFAULT true,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Member invoices
CREATE TABLE IF NOT EXISTS member_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  
  -- Invoice details
  description TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded')),
  
  -- Dates
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_invoice_number UNIQUE (organization_id, invoice_number)
);

-- Payments
CREATE TABLE IF NOT EXISTS member_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES member_invoices(id) ON DELETE SET NULL,
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  payment_method TEXT CHECK (payment_method IN ('cash', 'eft', 'card', 'payfast', 'debit_order', 'other')),
  payment_reference TEXT,
  
  -- External payment info
  payment_provider TEXT,
  provider_transaction_id TEXT,
  provider_response JSONB,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
  
  -- Dates
  payment_date DATE DEFAULT CURRENT_DATE,
  processed_at TIMESTAMPTZ,
  
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_invoices_organization ON member_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_invoices_member ON member_invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_member_invoices_status ON member_invoices(status);
CREATE INDEX IF NOT EXISTS idx_member_payments_organization ON member_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_payments_member ON member_payments(member_id);
CREATE INDEX IF NOT EXISTS idx_member_payments_status ON member_payments(status);

-- ============================================================================
-- SECTION 6: Calendar & Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_id UUID REFERENCES organization_regions(id) ON DELETE SET NULL,
  
  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('meeting', 'training', 'workshop', 'assessment', 'ceremony', 'social', 'deadline', 'other')),
  
  -- Timing
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  
  -- Location
  location_type TEXT CHECK (location_type IN ('physical', 'online', 'hybrid')),
  physical_location TEXT,
  online_meeting_url TEXT,
  online_meeting_details JSONB,
  
  -- Attendance
  max_attendees INTEGER,
  registration_required BOOLEAN DEFAULT false,
  registration_deadline TIMESTAMPTZ,
  
  -- Visibility
  visibility TEXT DEFAULT 'organization' CHECK (visibility IN ('public', 'organization', 'region', 'invited')),
  allowed_member_types TEXT[],
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  parent_event_id UUID REFERENCES organization_events(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled', 'postponed')),
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES organization_events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'no_show', 'cancelled')),
  registered_at TIMESTAMPTZ DEFAULT now(),
  attended_at TIMESTAMPTZ,
  notes TEXT,
  CONSTRAINT unique_event_registration UNIQUE (event_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_org_events_organization ON organization_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_events_region ON organization_events(region_id);
CREATE INDEX IF NOT EXISTS idx_org_events_start ON organization_events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_org_events_type ON organization_events(event_type);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_member ON event_registrations(member_id);

-- ============================================================================
-- SECTION 7: Activity & Audit Logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS member_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  activity_type TEXT NOT NULL,
  activity_category TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_organization ON member_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_member ON member_activity_log(member_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON member_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON member_activity_log(created_at DESC);

-- ============================================================================
-- SECTION 8: Functions
-- ============================================================================

-- Generate unique member number
CREATE OR REPLACE FUNCTION generate_member_number(
  p_organization_id UUID,
  p_region_code TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_org_code TEXT;
  v_year TEXT;
  v_sequence INTEGER;
  v_member_number TEXT;
BEGIN
  -- Get organization code (first 3 letters)
  SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
  INTO v_org_code
  FROM organizations
  WHERE id = p_organization_id;
  
  -- Get current year
  v_year := TO_CHAR(CURRENT_DATE, 'YY');
  
  -- Get next sequence number
  SELECT COALESCE(MAX(
    CAST(NULLIF(REGEXP_REPLACE(member_number, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM organization_members
  WHERE organization_id = p_organization_id
    AND member_number LIKE v_org_code || '%' || v_year || '%';
  
  -- Build member number: SOA-GP-24-00001
  IF p_region_code IS NOT NULL THEN
    v_member_number := v_org_code || '-' || p_region_code || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
  ELSE
    v_member_number := v_org_code || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
  END IF;
  
  RETURN v_member_number;
END;
$$ LANGUAGE plpgsql;

-- Generate unique card number
CREATE OR REPLACE FUNCTION generate_card_number(
  p_organization_id UUID,
  p_member_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_member_number TEXT;
  v_card_sequence INTEGER;
BEGIN
  SELECT member_number INTO v_member_number
  FROM organization_members
  WHERE id = p_member_id;
  
  SELECT COUNT(*) + 1 INTO v_card_sequence
  FROM member_id_cards
  WHERE member_id = p_member_id;
  
  RETURN v_member_number || '-C' || LPAD(v_card_sequence::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql;

-- Generate QR code data for verification
CREATE OR REPLACE FUNCTION generate_qr_verification_data(
  p_member_id UUID,
  p_card_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_data JSONB;
  v_member RECORD;
BEGIN
  SELECT 
    om.member_number,
    om.first_name,
    om.last_name,
    om.member_type,
    om.membership_status,
    mic.card_number,
    mic.expiry_date,
    o.name as org_name
  INTO v_member
  FROM organization_members om
  JOIN member_id_cards mic ON mic.member_id = om.id
  JOIN organizations o ON o.id = om.organization_id
  WHERE om.id = p_member_id AND mic.id = p_card_id;
  
  v_data := jsonb_build_object(
    'v', '1',
    'mid', p_member_id,
    'cid', p_card_id,
    'mn', v_member.member_number,
    'cn', v_member.card_number,
    'n', v_member.first_name || ' ' || v_member.last_name,
    't', v_member.member_type,
    'exp', v_member.expiry_date,
    'org', v_member.org_name,
    'ts', EXTRACT(EPOCH FROM now())::BIGINT
  );
  
  RETURN encode(convert_to(v_data::TEXT, 'UTF8'), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_organization_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_sequence INTEGER;
BEGIN
  v_prefix := 'INV';
  v_year := TO_CHAR(CURRENT_DATE, 'YYYYMM');
  
  SELECT COALESCE(MAX(
    CAST(RIGHT(invoice_number, 5) AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM member_invoices
  WHERE organization_id = p_organization_id
    AND invoice_number LIKE v_prefix || '-' || v_year || '%';
  
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 9: Triggers
-- ============================================================================

-- Auto-generate member number on insert
CREATE OR REPLACE FUNCTION trigger_generate_member_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_number IS NULL OR NEW.member_number = '' THEN
    SELECT generate_member_number(
      NEW.organization_id,
      (SELECT code FROM organization_regions WHERE id = NEW.region_id)
    ) INTO NEW.member_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_member_number
  BEFORE INSERT ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_member_number();

-- Auto-update timestamps
CREATE TRIGGER update_org_regions_updated_at
  BEFORE UPDATE ON organization_regions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_id_cards_updated_at
  BEFORE UPDATE ON member_id_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_events_updated_at
  BEFORE UPDATE ON organization_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 10: RLS Policies
-- ============================================================================

ALTER TABLE organization_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_activity_log ENABLE ROW LEVEL SECURITY;

-- Organization members can view their organization's data
CREATE POLICY "Members can view own org regions"
  ON organization_regions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Members can view own org members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Members can view own ID card"
  ON member_id_cards FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM organization_members WHERE user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'regional_manager', 'national_admin')
    )
  );

CREATE POLICY "Members can view org resources"
  ON resources FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND is_published = true
  );

CREATE POLICY "Members can view org events"
  ON organization_events FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Admins can manage organization data
CREATE POLICY "Admins can manage regions"
  ON organization_regions FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'principal', 'regional_manager', 'national_admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage members"
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'principal', 'regional_manager', 'national_admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage ID cards"
  ON member_id_cards FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'principal', 'regional_manager', 'national_admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage resources"
  ON resources FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'principal', 'facilitator', 'regional_manager', 'national_admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage events"
  ON organization_events FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'principal', 'facilitator', 'regional_manager', 'national_admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage invoices"
  ON member_invoices FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'principal', 'regional_manager', 'national_admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage payments"
  ON member_payments FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'principal', 'regional_manager', 'national_admin', 'super_admin')
    )
  );

-- Members can view their own invoices
CREATE POLICY "Members can view own invoices"
  ON member_invoices FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Members can register for events
CREATE POLICY "Members can register for events"
  ON event_registrations FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can view own registrations"
  ON event_registrations FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- SECTION 11: Insert default resource categories
-- ============================================================================

-- This will be done via application after organization is created
COMMENT ON TABLE resource_categories IS 'Default categories: Training Materials, Policies, Templates, Forms, Media, Announcements';

-- ============================================================================
-- End of Migration
-- ============================================================================
