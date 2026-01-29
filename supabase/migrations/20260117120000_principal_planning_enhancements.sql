-- Principal Planning Enhancements Migration
-- Excursions, Meetings, Activity Templates, and improved financial tracking
-- Date: 2026-01-17

-- ================================================================
-- PART 1: SCHOOL EXCURSIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS school_excursions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Excursion details
  title TEXT NOT NULL,
  description TEXT,
  destination TEXT NOT NULL,
  destination_address TEXT,
  destination_contact TEXT,
  
  -- Dates and times
  excursion_date DATE NOT NULL,
  departure_time TIME,
  return_time TIME,
  
  -- Planning
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  theme_id UUID REFERENCES curriculum_themes(id) ON DELETE SET NULL,
  age_groups TEXT[] DEFAULT ARRAY['3-6'],
  class_ids UUID[] DEFAULT '{}', -- Which classes are included
  max_participants INTEGER,
  
  -- Budget
  estimated_cost_per_child DECIMAL(10,2) DEFAULT 0,
  total_budget DECIMAL(10,2) DEFAULT 0,
  transport_cost DECIMAL(10,2) DEFAULT 0,
  venue_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Requirements
  consent_required BOOLEAN DEFAULT true,
  consent_deadline DATE,
  items_to_bring TEXT[] DEFAULT '{}',
  special_requirements TEXT,
  
  -- Educational value
  learning_objectives TEXT[] DEFAULT '{}',
  developmental_domains TEXT[] DEFAULT '{}', -- cognitive, physical, social, emotional, language
  curriculum_links TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'cancelled', 'completed')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_excursions_preschool_date 
ON school_excursions(preschool_id, excursion_date DESC);

CREATE INDEX IF NOT EXISTS idx_excursions_status 
ON school_excursions(preschool_id, status);

-- ================================================================
-- PART 2: SCHOOL MEETINGS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS school_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Meeting details
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN (
    'staff', 'parent', 'governing_body', 'pta', 'curriculum', 
    'safety', 'budget', 'training', 'one_on_one', 'other'
  )),
  
  -- Date and time
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  duration_minutes INTEGER DEFAULT 60,
  
  -- Location
  location TEXT, -- e.g., "Staff Room", "Hall", "Online"
  is_virtual BOOLEAN DEFAULT false,
  virtual_link TEXT,
  
  -- Participants
  invited_roles TEXT[] DEFAULT '{}', -- ['teacher', 'parent', 'principal']
  invited_user_ids UUID[] DEFAULT '{}', -- Specific users
  class_ids UUID[] DEFAULT '{}', -- For parent meetings about specific classes
  
  -- Agenda and documents
  agenda_items JSONB DEFAULT '[]', -- [{title, duration_minutes, presenter}]
  attachments JSONB DEFAULT '[]', -- [{name, url, type}]
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
  
  -- Follow-up
  minutes TEXT, -- Meeting minutes
  action_items JSONB DEFAULT '[]', -- [{task, assignee_id, due_date, status}]
  next_meeting_date DATE,
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- e.g., "FREQ=WEEKLY;BYDAY=MO" (iCal format)
  recurrence_end_date DATE,
  parent_meeting_id UUID REFERENCES school_meetings(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_preschool_date 
ON school_meetings(preschool_id, meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_meetings_type 
ON school_meetings(preschool_id, meeting_type);

-- ================================================================
-- PART 3: ACTIVITY TEMPLATES TABLE (ECD Activity Library)
-- ================================================================

CREATE TABLE IF NOT EXISTS activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE, -- NULL = global template
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Activity details
  title TEXT NOT NULL,
  description TEXT,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'art', 'music', 'movement', 'story', 'dramatic_play', 'sensory',
    'outdoor', 'construction', 'science', 'math', 'literacy', 'life_skills', 'other'
  )),
  
  -- ECD specifics
  age_groups TEXT[] DEFAULT ARRAY['3-6'],
  developmental_domains TEXT[] DEFAULT '{}', -- cognitive, physical, social, emotional, language
  learning_objectives TEXT[] DEFAULT '{}',
  
  -- Resources
  materials_needed TEXT[] DEFAULT '{}',
  space_required TEXT, -- e.g., "indoor", "outdoor", "large space"
  duration_minutes INTEGER DEFAULT 30,
  group_size TEXT, -- "individual", "small_group", "large_group", "whole_class"
  
  -- Instructions
  setup_instructions TEXT,
  activity_steps JSONB DEFAULT '[]', -- [{step_number, description, duration}]
  extension_activities TEXT[] DEFAULT '{}',
  simplification_tips TEXT,
  
  -- Curriculum alignment
  caps_alignment TEXT, -- SA CAPS curriculum reference
  theme_tags TEXT[] DEFAULT '{}', -- e.g., ['weather', 'animals', 'community']
  
  -- Assessment
  observation_points TEXT[] DEFAULT '{}', -- What to observe during activity
  assessment_criteria TEXT,
  
  -- Status
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_templates_type 
ON activity_templates(activity_type);

CREATE INDEX IF NOT EXISTS idx_activity_templates_domains 
ON activity_templates USING GIN(developmental_domains);

CREATE INDEX IF NOT EXISTS idx_activity_templates_theme_tags 
ON activity_templates USING GIN(theme_tags);

-- ================================================================
-- PART 4: FINANCIAL SUMMARY VIEW FOR PRINCIPALS
-- ================================================================

DO $view$
DECLARE
  has_preschools BOOLEAN;
  has_preschools_name BOOLEAN;
  has_preschools_is_active BOOLEAN;
  has_registration_requests BOOLEAN;
  has_rr_org BOOLEAN;
  has_rr_amount BOOLEAN;
  has_rr_payment_verified BOOLEAN;
  has_rr_status BOOLEAN;
  has_student_fees BOOLEAN;
  has_sf_amount BOOLEAN;
  has_sf_status BOOLEAN;
  has_sf_paid_date BOOLEAN;
  has_sf_student_id BOOLEAN;
  has_students BOOLEAN;
  has_students_preschool_id BOOLEAN;
  has_payments BOOLEAN;
  has_pay_amount BOOLEAN;
  has_pay_preschool_id BOOLEAN;
  has_pay_status BOOLEAN;
  has_pay_created_at BOOLEAN;
  has_pop_uploads BOOLEAN;
  has_pu_preschool_id BOOLEAN;
  has_pu_status BOOLEAN;
  has_petty_cash BOOLEAN;
  has_pct_school_id BOOLEAN;
  has_pct_amount BOOLEAN;
  has_pct_type BOOLEAN;
  has_pct_status BOOLEAN;
  has_pct_created_at BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'preschools'
  ) INTO has_preschools;

  IF NOT has_preschools THEN
    RAISE NOTICE 'Skipping principal_financial_summary: preschools table missing';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'preschools' AND column_name = 'name'
  ) INTO has_preschools_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'preschools' AND column_name = 'is_active'
  ) INTO has_preschools_is_active;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'registration_requests'
  ) INTO has_registration_requests;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registration_requests' AND column_name = 'organization_id'
  ) INTO has_rr_org;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registration_requests' AND column_name = 'registration_fee_amount'
  ) INTO has_rr_amount;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registration_requests' AND column_name = 'payment_verified'
  ) INTO has_rr_payment_verified;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registration_requests' AND column_name = 'status'
  ) INTO has_rr_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_fees'
  ) INTO has_student_fees;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_fees' AND column_name = 'amount'
  ) INTO has_sf_amount;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_fees' AND column_name = 'status'
  ) INTO has_sf_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_fees' AND column_name = 'paid_date'
  ) INTO has_sf_paid_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_fees' AND column_name = 'student_id'
  ) INTO has_sf_student_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'students'
  ) INTO has_students;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'preschool_id'
  ) INTO has_students_preschool_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) INTO has_payments;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount'
  ) INTO has_pay_amount;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'preschool_id'
  ) INTO has_pay_preschool_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'status'
  ) INTO has_pay_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'created_at'
  ) INTO has_pay_created_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pop_uploads'
  ) INTO has_pop_uploads;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pop_uploads' AND column_name = 'preschool_id'
  ) INTO has_pu_preschool_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pop_uploads' AND column_name = 'status'
  ) INTO has_pu_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'petty_cash_transactions'
  ) INTO has_petty_cash;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'petty_cash_transactions' AND column_name = 'school_id'
  ) INTO has_pct_school_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'petty_cash_transactions' AND column_name = 'amount'
  ) INTO has_pct_amount;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'petty_cash_transactions' AND column_name = 'type'
  ) INTO has_pct_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'petty_cash_transactions' AND column_name = 'status'
  ) INTO has_pct_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'petty_cash_transactions' AND column_name = 'created_at'
  ) INTO has_pct_created_at;

  IF NOT (
    has_preschools_name AND has_preschools_is_active
    AND has_registration_requests AND has_rr_org AND has_rr_amount AND has_rr_payment_verified AND has_rr_status
    AND has_student_fees AND has_sf_amount AND has_sf_status AND has_sf_paid_date AND has_sf_student_id
    AND has_students AND has_students_preschool_id
    AND has_payments AND has_pay_amount AND has_pay_preschool_id AND has_pay_status AND has_pay_created_at
    AND has_pop_uploads AND has_pu_preschool_id AND has_pu_status
    AND has_petty_cash AND has_pct_school_id AND has_pct_amount AND has_pct_type AND has_pct_status AND has_pct_created_at
  ) THEN
    RAISE NOTICE 'Skipping principal_financial_summary: required tables/columns missing';
    RETURN;
  END IF;

  EXECUTE $sql$
    CREATE OR REPLACE VIEW principal_financial_summary AS
    SELECT 
      p.id AS preschool_id,
      p.name AS preschool_name,
      
      -- Registration fees
      COALESCE((
        SELECT SUM(COALESCE(registration_fee_amount, 0))
        FROM registration_requests rr
        WHERE rr.organization_id = p.id 
        AND rr.payment_verified = true 
        AND rr.status = 'approved'
      ), 0) AS registration_fees_collected,
      
      COALESCE((
        SELECT COUNT(*)
        FROM registration_requests rr
        WHERE rr.organization_id = p.id 
        AND rr.registration_fee_amount > 0
        AND (rr.payment_verified = false OR rr.payment_verified IS NULL)
        AND rr.status NOT IN ('rejected', 'cancelled')
      ), 0) AS pending_registration_fees,
      
      -- Monthly school fees (from student_fees)
      COALESCE((
        SELECT SUM(sf.amount)
        FROM student_fees sf
        JOIN students s ON s.id = sf.student_id
        WHERE s.preschool_id = p.id
        AND sf.status = 'paid'
        AND EXTRACT(MONTH FROM sf.paid_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM sf.paid_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      ), 0) AS monthly_fees_collected,
      
      COALESCE((
        SELECT SUM(sf.amount)
        FROM student_fees sf
        JOIN students s ON s.id = sf.student_id
        WHERE s.preschool_id = p.id
        AND sf.status IN ('pending', 'overdue')
      ), 0) AS outstanding_school_fees,
      
      -- Payments received (general)
      COALESCE((
        SELECT SUM(pay.amount)
        FROM payments pay
        WHERE pay.preschool_id = p.id
        AND pay.status IN ('completed', 'approved')
        AND EXTRACT(MONTH FROM pay.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM pay.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      ), 0) AS payments_this_month,
      
      -- POP uploads pending review
      COALESCE((
        SELECT COUNT(*)
        FROM pop_uploads pu
        WHERE pu.preschool_id = p.id
        AND pu.status = 'pending'
      ), 0) AS pending_pop_reviews,
      
      -- Expenses (petty cash)
      COALESCE((
        SELECT SUM(ABS(pct.amount))
        FROM petty_cash_transactions pct
        WHERE pct.school_id = p.id
        AND pct.type = 'expense'
        AND pct.status IN ('approved', 'completed')
        AND EXTRACT(MONTH FROM pct.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM pct.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      ), 0) AS expenses_this_month
    
    FROM preschools p
    WHERE p.is_active = true
  $sql$;

  EXECUTE 'GRANT SELECT ON principal_financial_summary TO authenticated';
END;
$view$;

-- ================================================================
-- PART 5: RLS POLICIES
-- ================================================================

-- School Excursions
ALTER TABLE school_excursions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "principals_manage_excursions" ON school_excursions;
CREATE POLICY "principals_manage_excursions" ON school_excursions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = school_excursions.preschool_id
    )
  );

DROP POLICY IF EXISTS "teachers_view_excursions" ON school_excursions;
CREATE POLICY "teachers_view_excursions" ON school_excursions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = school_excursions.preschool_id
    )
  );

-- School Meetings
ALTER TABLE school_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "principals_manage_meetings" ON school_meetings;
CREATE POLICY "principals_manage_meetings" ON school_meetings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = school_meetings.preschool_id
    )
  );

DROP POLICY IF EXISTS "staff_view_meetings" ON school_meetings;
CREATE POLICY "staff_view_meetings" ON school_meetings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = school_meetings.preschool_id
    )
  );

-- Activity Templates
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_view_global_templates" ON activity_templates;
CREATE POLICY "anyone_view_global_templates" ON activity_templates
  FOR SELECT USING (
    preschool_id IS NULL AND is_published = true
  );

DROP POLICY IF EXISTS "school_manage_own_templates" ON activity_templates;
CREATE POLICY "school_manage_own_templates" ON activity_templates
  FOR ALL USING (
    preschool_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = activity_templates.preschool_id
    )
  );

-- ================================================================
-- PART 6: HELPER FUNCTIONS
-- ================================================================

-- Function to get upcoming excursions for a school
CREATE OR REPLACE FUNCTION get_upcoming_excursions(p_preschool_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  title TEXT,
  destination TEXT,
  excursion_date DATE,
  status TEXT,
  participant_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.destination,
    e.excursion_date,
    e.status,
    COALESCE(array_length(e.class_ids, 1), 0)::BIGINT AS participant_count
  FROM school_excursions e
  WHERE e.preschool_id = p_preschool_id
    AND e.excursion_date >= CURRENT_DATE
    AND e.status NOT IN ('cancelled', 'completed')
  ORDER BY e.excursion_date ASC
  LIMIT p_limit;
END;
$$;

-- Function to get upcoming meetings for a user
CREATE OR REPLACE FUNCTION get_upcoming_meetings(p_user_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  title TEXT,
  meeting_type TEXT,
  meeting_date DATE,
  start_time TIME,
  location TEXT,
  is_virtual BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_preschool_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get user's preschool and role
  SELECT COALESCE(organization_id, preschool_id), role 
  INTO v_preschool_id, v_user_role
  FROM profiles WHERE id = p_user_id;
  
  RETURN QUERY
  SELECT 
    m.id,
    m.title,
    m.meeting_type,
    m.meeting_date,
    m.start_time,
    m.location,
    m.is_virtual
  FROM school_meetings m
  WHERE m.preschool_id = v_preschool_id
    AND m.meeting_date >= CURRENT_DATE
    AND m.status IN ('scheduled', 'in_progress')
    AND (
      v_user_role IN ('principal', 'principal_admin', 'super_admin')
      OR v_user_role = ANY(m.invited_roles)
      OR p_user_id = ANY(m.invited_user_ids)
    )
  ORDER BY m.meeting_date ASC, m.start_time ASC
  LIMIT p_limit;
END;
$$;

-- ================================================================
-- PART 7: SEED GLOBAL ACTIVITY TEMPLATES
-- ================================================================

-- Insert some starter activity templates (global, available to all schools)
INSERT INTO activity_templates (
  title, description, activity_type, age_groups, developmental_domains,
  learning_objectives, materials_needed, duration_minutes, group_size,
  activity_steps, theme_tags, is_published
) VALUES
(
  'Rainbow Colour Sorting',
  'Children sort objects by colour into matching rainbow containers',
  'math',
  ARRAY['3-4', '4-5'],
  ARRAY['cognitive', 'physical'],
  ARRAY['Identify and name basic colours', 'Develop fine motor skills', 'Practice sorting and categorisation'],
  ARRAY['Coloured containers or bowls', 'Mixed small objects in various colours', 'Colour cards'],
  30,
  'small_group',
  '[{"step_number": 1, "description": "Introduce the colours using colour cards", "duration": 5}, {"step_number": 2, "description": "Show how to sort objects by colour", "duration": 5}, {"step_number": 3, "description": "Let children sort independently", "duration": 15}, {"step_number": 4, "description": "Review and count sorted objects together", "duration": 5}]'::jsonb,
  ARRAY['colours', 'sorting', 'math'],
  true
),
(
  'Weather Chart Morning Routine',
  'Daily weather observation and recording activity',
  'science',
  ARRAY['3-6'],
  ARRAY['cognitive', 'language'],
  ARRAY['Observe and describe weather conditions', 'Use weather vocabulary', 'Develop daily routine awareness'],
  ARRAY['Weather chart', 'Weather symbols/cards', 'Markers or velcro pieces'],
  15,
  'whole_class',
  '[{"step_number": 1, "description": "Look outside and discuss what you see", "duration": 3}, {"step_number": 2, "description": "Choose the correct weather symbol", "duration": 3}, {"step_number": 3, "description": "Sing a weather song", "duration": 5}, {"step_number": 4, "description": "Discuss appropriate clothing for the weather", "duration": 4}]'::jsonb,
  ARRAY['weather', 'morning routine', 'seasons'],
  true
),
(
  'Story Time with Puppets',
  'Interactive storytelling using hand puppets to engage children',
  'story',
  ARRAY['3-6'],
  ARRAY['language', 'social', 'emotional'],
  ARRAY['Develop listening skills', 'Expand vocabulary', 'Understand story sequence', 'Express emotions through characters'],
  ARRAY['Hand puppets', 'Story book', 'Props related to story'],
  20,
  'whole_class',
  '[{"step_number": 1, "description": "Introduce the puppets and characters", "duration": 3}, {"step_number": 2, "description": "Tell the story using puppets", "duration": 10}, {"step_number": 3, "description": "Ask prediction and comprehension questions", "duration": 5}, {"step_number": 4, "description": "Let children interact with puppets", "duration": 2}]'::jsonb,
  ARRAY['literacy', 'drama', 'imagination'],
  true
),
(
  'Obstacle Course Adventure',
  'Indoor/outdoor gross motor activity with various movement challenges',
  'movement',
  ARRAY['3-6'],
  ARRAY['physical', 'cognitive'],
  ARRAY['Develop gross motor skills', 'Practice balance and coordination', 'Follow multi-step instructions', 'Build confidence'],
  ARRAY['Cones', 'Hoops', 'Balance beam or tape line', 'Tunnel or chairs with blanket', 'Soft balls'],
  30,
  'small_group',
  '[{"step_number": 1, "description": "Set up the obstacle course stations", "duration": 5}, {"step_number": 2, "description": "Demonstrate each station", "duration": 5}, {"step_number": 3, "description": "Children complete course taking turns", "duration": 15}, {"step_number": 4, "description": "Cool down and discuss favourite parts", "duration": 5}]'::jsonb,
  ARRAY['movement', 'outdoor', 'gross motor'],
  true
),
(
  'Playdough Creations',
  'Open-ended sensory and creative activity with playdough',
  'sensory',
  ARRAY['3-6'],
  ARRAY['physical', 'cognitive', 'emotional'],
  ARRAY['Develop fine motor strength', 'Express creativity', 'Learn shapes and textures', 'Practice turn-taking with tools'],
  ARRAY['Playdough (various colours)', 'Rolling pins', 'Cookie cutters', 'Plastic knives', 'Textured items for imprints'],
  30,
  'small_group',
  '[{"step_number": 1, "description": "Introduce materials and set expectations", "duration": 3}, {"step_number": 2, "description": "Free exploration with playdough", "duration": 20}, {"step_number": 3, "description": "Share creations with group", "duration": 5}, {"step_number": 4, "description": "Clean up together", "duration": 2}]'::jsonb,
  ARRAY['sensory', 'creative', 'fine motor'],
  true
)
ON CONFLICT DO NOTHING;
