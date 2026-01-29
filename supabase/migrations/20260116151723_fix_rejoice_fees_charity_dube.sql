-- Migration: Fix Rejoice's fees for charitydube217@gmail.com
-- ============================================================================
-- Issue: Parent has 2 children but could only register one (Rejoice, 4+ years old)
-- This migration:
-- 1. Finds Rejoice (child of charitydube217@gmail.com) 
-- 2. Ensures they have the correct monthly fee structure (4-6 years = R680/month)
-- 3. Updates any existing fees to the correct amount
-- ============================================================================

DO $$
DECLARE
  v_parent_id UUID;
  v_student_id UUID;
  v_student_dob DATE;
  v_student_age INT;
  v_preschool_id UUID;
  v_fee_structure_id UUID;
  v_correct_amount DECIMAL(10,2);
BEGIN
  -- Step 1: Find the parent profile by email
  SELECT id, preschool_id INTO v_parent_id, v_preschool_id
  FROM profiles
  WHERE email = 'charitydube217@gmail.com'
  LIMIT 1;
  
  IF v_parent_id IS NULL THEN
    RAISE NOTICE 'Parent charitydube217@gmail.com not found - migration skipped';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found parent: % with preschool_id: %', v_parent_id, v_preschool_id;
  
  -- Step 2: Find Rejoice by name linked to this parent
  SELECT id, date_of_birth, preschool_id 
  INTO v_student_id, v_student_dob, v_preschool_id
  FROM students
  WHERE (parent_id = v_parent_id OR guardian_id = v_parent_id)
    AND LOWER(first_name) LIKE '%rejoice%'
    AND is_active = true
  LIMIT 1;
  
  IF v_student_id IS NULL THEN
    RAISE NOTICE 'Student Rejoice not found for parent % - checking all children', v_parent_id;
    
    -- List all children for debugging
    FOR v_student_id, v_student_dob IN
      SELECT id, date_of_birth 
      FROM students 
      WHERE (parent_id = v_parent_id OR guardian_id = v_parent_id)
        AND is_active = true
    LOOP
      RAISE NOTICE 'Found child: % with DOB: %', v_student_id, v_student_dob;
    END LOOP;
    
    RETURN;
  END IF;
  
  -- Calculate age
  IF v_student_dob IS NOT NULL THEN
    v_student_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_student_dob));
  ELSE
    v_student_age := 4; -- Assume 4+ if no DOB
  END IF;
  
  RAISE NOTICE 'Found Rejoice: student_id=%, DOB=%, age=%', v_student_id, v_student_dob, v_student_age;
  
  -- Step 3: Determine correct fee amount based on age
  -- Young Eagles fee structure:
  -- 6 Months - 1 Year: R850/month
  -- 1 - 3 Years: R720/month  
  -- 4 - 6 Years: R680/month
  IF v_student_age >= 4 AND v_student_age <= 6 THEN
    v_correct_amount := 680.00;
  ELSIF v_student_age >= 1 AND v_student_age < 4 THEN
    v_correct_amount := 720.00;
  ELSIF v_student_age < 1 THEN
    v_correct_amount := 850.00;
  ELSE
    v_correct_amount := 680.00; -- Default to 4-6 years for school age
  END IF;
  
  RAISE NOTICE 'Correct monthly fee for age %: R%', v_student_age, v_correct_amount;
  
  -- Step 4: Find the appropriate fee structure for tuition
  SELECT id INTO v_fee_structure_id
  FROM fee_structures
  WHERE preschool_id = v_preschool_id
    AND fee_type = 'tuition'
    AND is_active = true
  LIMIT 1;
  
  IF v_fee_structure_id IS NULL THEN
    RAISE NOTICE 'No tuition fee structure found for preschool % - creating default', v_preschool_id;
    
    -- Create a tuition fee structure if none exists
    INSERT INTO fee_structures (
      preschool_id,
      name,
      description,
      amount,
      fee_type,
      frequency,
      mandatory,
      is_active,
      effective_from
    ) VALUES (
      v_preschool_id,
      'Monthly School Fees - Ages 4-6',
      'Monthly tuition fee for children ages 4-6 years',
      v_correct_amount,
      'tuition',
      'monthly',
      true,
      true,
      CURRENT_DATE
    )
    RETURNING id INTO v_fee_structure_id;
  END IF;
  
  -- Step 5: Update existing pending/overdue fees for this student to the correct amount
  UPDATE student_fees
  SET 
    amount = v_correct_amount,
    final_amount = v_correct_amount,
    amount_outstanding = CASE 
      WHEN amount_paid IS NOT NULL AND amount_paid > 0 
      THEN GREATEST(0, v_correct_amount - amount_paid)
      ELSE v_correct_amount 
    END,
    updated_at = NOW()
  WHERE student_id = v_student_id
    AND status IN ('pending', 'overdue', 'partially_paid')
    AND fee_structure_id = v_fee_structure_id;
  
  RAISE NOTICE 'Updated % existing fees for Rejoice to R%', 
    (SELECT COUNT(*) FROM student_fees WHERE student_id = v_student_id AND status IN ('pending', 'overdue', 'partially_paid')),
    v_correct_amount;
  
  -- Step 6: If no fees exist for this month, create one
  IF NOT EXISTS (
    SELECT 1 FROM student_fees 
    WHERE student_id = v_student_id 
      AND date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE)
  ) THEN
    INSERT INTO student_fees (
      student_id,
      fee_structure_id,
      amount,
      final_amount,
      due_date,
      status,
      amount_outstanding
    ) VALUES (
      v_student_id,
      v_fee_structure_id,
      v_correct_amount,
      v_correct_amount,
      date_trunc('month', CURRENT_DATE)::DATE,
      'pending',
      v_correct_amount
    );
    
    RAISE NOTICE 'Created new fee for current month: R%', v_correct_amount;
  END IF;
  
  RAISE NOTICE 'Migration completed successfully for Rejoice (student_id: %)', v_student_id;
END;
$$;

DO $$
DECLARE
  has_students boolean;
  has_profiles boolean;
  has_date_of_birth boolean;
BEGIN
  has_students := to_regclass('public.students') IS NOT NULL;
  has_profiles := to_regclass('public.profiles') IS NOT NULL;

  IF NOT has_students OR NOT has_profiles THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'date_of_birth'
  ) INTO has_date_of_birth;

  IF NOT has_date_of_birth THEN
    RETURN;
  END IF;

  -- Verification query (intentionally not returning rows in migration context)
  PERFORM 1
  FROM students s
  JOIN profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
  LEFT JOIN student_fees sf ON sf.student_id = s.id
  WHERE p.email = 'charitydube217@gmail.com'
    AND s.is_active = true;
END $$;
