-- ============================================================================
-- Extended Membership System Migration
-- ============================================================================
-- Adds comprehensive membership management features:
-- - Extended member profiles with ID cards, photos, QR codes
-- - Organization regions for geographic management
-- - Member invoices for billing
-- - Member events for activities and meetings
-- ============================================================================

-- ============================================================================
-- 1. Extend organization_members table with additional fields
-- ============================================================================

-- Add member_number column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'member_number'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN member_number VARCHAR(50);
  END IF;
END $$;

-- Add photo_url column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN photo_url TEXT;
  END IF;
END $$;

-- Add first_name column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN first_name VARCHAR(100);
  END IF;
END $$;

-- Add last_name column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN last_name VARCHAR(100);
  END IF;
END $$;

-- Add email column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN email VARCHAR(255);
  END IF;
END $$;

-- Add phone column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN phone VARCHAR(20);
  END IF;
END $$;

-- Add id_number column if not exists (SA ID or passport)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'id_number'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN id_number VARCHAR(20);
  END IF;
END $$;

-- Add date_of_birth column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN date_of_birth DATE;
  END IF;
END $$;

-- Add member_type column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'member_type'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN member_type VARCHAR(50) DEFAULT 'member';
  END IF;
END $$;

-- Add membership_tier column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'membership_tier'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN membership_tier VARCHAR(50) DEFAULT 'standard';
  END IF;
END $$;

-- Add membership_status column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'membership_status'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN membership_status VARCHAR(50) DEFAULT 'pending';
  END IF;
END $$;

-- Add region_id column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'region_id'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN region_id UUID;
  END IF;
END $$;

-- Add physical_address column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'physical_address'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN physical_address TEXT;
  END IF;
END $$;

-- Add city column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'city'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN city VARCHAR(100);
  END IF;
END $$;

-- Add province column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'province'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN province VARCHAR(100);
  END IF;
END $$;

-- Add postal_code column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN postal_code VARCHAR(20);
  END IF;
END $$;

-- Add emergency_contact_name column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'emergency_contact_name'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN emergency_contact_name VARCHAR(200);
  END IF;
END $$;

-- Add emergency_contact_phone column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'emergency_contact_phone'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN emergency_contact_phone VARCHAR(20);
  END IF;
END $$;

-- Add join_date column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'join_date'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN join_date DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Add expiry_date column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN expiry_date DATE;
  END IF;
END $$;

-- Add notes column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Add created_by column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Add qr_code_data column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'qr_code_data'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN qr_code_data TEXT;
  END IF;
END $$;

-- ============================================================================
-- 2. Create organization_regions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  province_code VARCHAR(10),
  description TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  manager_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Add index for region lookups
CREATE INDEX IF NOT EXISTS idx_org_regions_org_id ON public.organization_regions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_regions_code ON public.organization_regions(code);

-- Enable RLS
ALTER TABLE public.organization_regions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_regions
DROP POLICY IF EXISTS "Org members can view regions" ON public.organization_regions;
CREATE POLICY "Org members can view regions" ON public.organization_regions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND organization_id = organization_regions.organization_id
    )
  );

DROP POLICY IF EXISTS "Org admins can manage regions" ON public.organization_regions;
CREATE POLICY "Org admins can manage regions" ON public.organization_regions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND organization_id = organization_regions.organization_id
      AND role IN ('admin', 'principal', 'super_admin')
    )
  );

-- ============================================================================
-- 3. Create member_id_cards table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  card_number VARCHAR(50) NOT NULL,
  qr_code_data TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'expired', 'replacement_requested')),
  issue_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  card_template VARCHAR(50) DEFAULT 'default',
  verification_count INTEGER DEFAULT 0,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, card_number)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_id_cards_member ON public.member_id_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_id_cards_org ON public.member_id_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_id_cards_status ON public.member_id_cards(status);
CREATE INDEX IF NOT EXISTS idx_id_cards_qr ON public.member_id_cards(qr_code_data);

-- Enable RLS
ALTER TABLE public.member_id_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for member_id_cards
DROP POLICY IF EXISTS "Members can view own ID cards" ON public.member_id_cards;
CREATE POLICY "Members can view own ID cards" ON public.member_id_cards
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org admins can manage ID cards" ON public.member_id_cards;
CREATE POLICY "Org admins can manage ID cards" ON public.member_id_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND organization_id = member_id_cards.organization_id
      AND role IN ('admin', 'principal', 'super_admin')
    )
  );

-- ============================================================================
-- 4. Create member_invoices table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  description TEXT,
  line_items JSONB DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'ZAR',
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded')),
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, invoice_number)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_invoices_member ON public.member_invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.member_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.member_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.member_invoices(due_date);

-- Enable RLS
ALTER TABLE public.member_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for member_invoices
DROP POLICY IF EXISTS "Members can view own invoices" ON public.member_invoices;
CREATE POLICY "Members can view own invoices" ON public.member_invoices
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org admins can manage invoices" ON public.member_invoices;
CREATE POLICY "Org admins can manage invoices" ON public.member_invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND organization_id = member_invoices.organization_id
      AND role IN ('admin', 'principal', 'super_admin')
    )
  );

-- ============================================================================
-- 5. Create member_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  region_id UUID REFERENCES public.organization_regions(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'workshop', 'training', 'social', 'fundraiser', 'conference', 'other')),
  location TEXT,
  location_coordinates JSONB,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  is_virtual BOOLEAN DEFAULT false,
  virtual_link TEXT,
  max_attendees INTEGER,
  registration_required BOOLEAN DEFAULT false,
  registration_deadline TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'ongoing', 'completed', 'cancelled', 'postponed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_events_org ON public.member_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_region ON public.member_events(region_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON public.member_events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.member_events(status);

-- Enable RLS
ALTER TABLE public.member_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for member_events
DROP POLICY IF EXISTS "Org members can view events" ON public.member_events;
CREATE POLICY "Org members can view events" ON public.member_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND organization_id = member_events.organization_id
    )
  );

DROP POLICY IF EXISTS "Org admins can manage events" ON public.member_events;
CREATE POLICY "Org admins can manage events" ON public.member_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND organization_id = member_events.organization_id
      AND role IN ('admin', 'principal', 'super_admin')
    )
  );

-- ============================================================================
-- 6. Create event_attendees table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.member_events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'attended', 'cancelled', 'no_show')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  checked_in_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(event_id, member_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_attendees_event ON public.event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_member ON public.event_attendees(member_id);

-- Enable RLS
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_attendees
DROP POLICY IF EXISTS "Members can view own attendance" ON public.event_attendees;
CREATE POLICY "Members can view own attendance" ON public.event_attendees
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can register for events" ON public.event_attendees;
CREATE POLICY "Members can register for events" ON public.event_attendees
  FOR INSERT WITH CHECK (
    member_id IN (
      SELECT id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org admins can manage attendance" ON public.event_attendees;
CREATE POLICY "Org admins can manage attendance" ON public.event_attendees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.member_events e
      JOIN public.profiles p ON p.organization_id = e.organization_id
      WHERE e.id = event_attendees.event_id
      AND p.id = auth.uid()
      AND p.role IN ('admin', 'principal', 'super_admin')
    )
  );

-- ============================================================================
-- 7. Add foreign key from organization_members to regions (if column exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'region_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'organization_members' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.column_name = 'region_id'
  ) THEN
    ALTER TABLE public.organization_members 
    ADD CONSTRAINT fk_org_members_region 
    FOREIGN KEY (region_id) REFERENCES public.organization_regions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 8. Create helper functions
-- ============================================================================

-- Function to generate unique member number
CREATE OR REPLACE FUNCTION generate_member_number(org_id UUID, prefix TEXT DEFAULT 'MEM')
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  new_member_number TEXT;
BEGIN
  -- Get the next number for this organization
  SELECT COALESCE(MAX(
    CASE 
      WHEN member_number ~ ('^' || prefix || '-[0-9]+$') 
      THEN CAST(SUBSTRING(member_number FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM public.organization_members
  WHERE organization_id = org_id;
  
  new_member_number := prefix || '-' || LPAD(next_num::TEXT, 6, '0');
  RETURN new_member_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique card number
CREATE OR REPLACE FUNCTION generate_card_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  org_prefix TEXT;
  next_num INTEGER;
  new_card_number TEXT;
BEGIN
  -- Get org prefix from first 3 chars of org name or use ORG
  SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
  INTO org_prefix
  FROM public.organizations
  WHERE id = org_id;
  
  IF org_prefix IS NULL OR LENGTH(org_prefix) < 2 THEN
    org_prefix := 'ORG';
  END IF;
  
  -- Get next card number
  SELECT COALESCE(MAX(
    CASE 
      WHEN card_number ~ ('^' || org_prefix || '-[0-9]+$')
      THEN CAST(SUBSTRING(card_number FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM public.member_id_cards
  WHERE organization_id = org_id;
  
  new_card_number := org_prefix || '-' || LPAD(next_num::TEXT, 8, '0');
  RETURN new_card_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
  new_invoice_number TEXT;
BEGIN
  year_prefix := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-';
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^' || year_prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM public.member_invoices
  WHERE organization_id = org_id;
  
  new_invoice_number := year_prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add organization member
CREATE OR REPLACE FUNCTION add_organization_member(
  p_organization_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_member_type TEXT DEFAULT 'member',
  p_membership_tier TEXT DEFAULT 'standard',
  p_role TEXT DEFAULT 'member'
)
RETURNS UUID AS $$
DECLARE
  v_member_id UUID;
  v_member_number TEXT;
BEGIN
  -- Generate member number
  v_member_number := generate_member_number(p_organization_id);
  
  -- Insert the member
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    first_name,
    last_name,
    email,
    phone,
    member_type,
    membership_tier,
    membership_status,
    member_number,
    role,
    seat_status,
    join_date
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_member_type,
    p_membership_tier,
    'active',
    v_member_number,
    p_role,
    'active',
    CURRENT_DATE
  )
  RETURNING id INTO v_member_id;
  
  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_member_number(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_card_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_organization_member(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 9. Create updated_at triggers
-- ============================================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to new tables
DROP TRIGGER IF EXISTS update_organization_regions_updated_at ON public.organization_regions;
CREATE TRIGGER update_organization_regions_updated_at
  BEFORE UPDATE ON public.organization_regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_id_cards_updated_at ON public.member_id_cards;
CREATE TRIGGER update_member_id_cards_updated_at
  BEFORE UPDATE ON public.member_id_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_invoices_updated_at ON public.member_invoices;
CREATE TRIGGER update_member_invoices_updated_at
  BEFORE UPDATE ON public.member_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_events_updated_at ON public.member_events;
CREATE TRIGGER update_member_events_updated_at
  BEFORE UPDATE ON public.member_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. Add indexes for new columns on organization_members
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_members_member_number ON public.organization_members(member_number);
CREATE INDEX IF NOT EXISTS idx_org_members_member_type ON public.organization_members(member_type);
CREATE INDEX IF NOT EXISTS idx_org_members_membership_status ON public.organization_members(membership_status);
CREATE INDEX IF NOT EXISTS idx_org_members_membership_tier ON public.organization_members(membership_tier);
CREATE INDEX IF NOT EXISTS idx_org_members_region ON public.organization_members(region_id);
CREATE INDEX IF NOT EXISTS idx_org_members_email ON public.organization_members(email);

-- ============================================================================
-- Migration complete!
-- ============================================================================
