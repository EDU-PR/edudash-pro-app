-- Fix existing members' wing assignment based on their member_type
-- This ensures all members have the correct wing set based on their member_type

BEGIN;

-- Update wing for youth wing members
UPDATE organization_members
SET 
  wing = 'youth',
  updated_at = NOW()
WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
  AND member_type LIKE 'youth_%'
  AND (wing IS NULL OR wing != 'youth');

-- Update wing for women's wing members
UPDATE organization_members
SET 
  wing = 'women',
  updated_at = NOW()
WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
  AND member_type LIKE 'women_%'
  AND (wing IS NULL OR wing != 'women');

-- Update wing for veterans wing members
UPDATE organization_members
SET 
  wing = 'veterans',
  updated_at = NOW()
WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
  AND member_type LIKE 'veterans_%'
  AND (wing IS NULL OR wing != 'veterans');

-- Set wing to 'main' for generic member types (learner, facilitator, mentor, volunteer, staff, etc.)
-- that don't have a wing prefix
UPDATE organization_members
SET 
  wing = 'main',
  updated_at = NOW()
WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
  AND (
    member_type IN ('learner', 'facilitator', 'mentor', 'volunteer', 'staff', 'admin', 'executive', 'regional_manager', 'president', 'deputy_president', 'secretary_general', 'treasurer', 'ceo', 'national_admin', 'national_coordinator', 'board_member')
    OR (member_type IS NOT NULL AND member_type NOT LIKE 'youth_%' AND member_type NOT LIKE 'women_%' AND member_type NOT LIKE 'veterans_%')
  )
  AND (wing IS NULL OR wing != 'main');

-- Verify the updates
DO $$
DECLARE
  v_youth_count INTEGER;
  v_women_count INTEGER;
  v_veterans_count INTEGER;
  v_main_count INTEGER;
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_youth_count
  FROM organization_members
  WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
    AND member_type LIKE 'youth_%'
    AND wing = 'youth';
  
  SELECT COUNT(*) INTO v_women_count
  FROM organization_members
  WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
    AND member_type LIKE 'women_%'
    AND wing = 'women';
  
  SELECT COUNT(*) INTO v_veterans_count
  FROM organization_members
  WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
    AND member_type LIKE 'veterans_%'
    AND wing = 'veterans';
  
  SELECT COUNT(*) INTO v_main_count
  FROM organization_members
  WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
    AND wing = 'main';
  
  SELECT COUNT(*) INTO v_null_count
  FROM organization_members
  WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
    AND wing IS NULL;
  
  RAISE NOTICE 'Wing assignment summary:';
  RAISE NOTICE '  Youth wing: % members', v_youth_count;
  RAISE NOTICE '  Women wing: % members', v_women_count;
  RAISE NOTICE '  Veterans wing: % members', v_veterans_count;
  RAISE NOTICE '  Main wing: % members', v_main_count;
  RAISE NOTICE '  Null wing: % members', v_null_count;
END $$;

COMMIT;
