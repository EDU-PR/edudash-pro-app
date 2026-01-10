-- Update Mbali's age to 5 years and fix lesson visibility issues
--date_of_birth to 2021 to make her 5 years old

-- Update Mb ali Skosana's date of birth
UPDATE public.students
SET date_of_birth = '2021-01-15',
    updated_at = NOW()
WHERE id = '074692f3-f5a3-4fea-977a-b726828e5067'
  AND first_name = 'Mbali'
  AND last_name = 'Skosana';

-- Verify the link between zanelelwndl@gmail.com and Mbali is correct (already correct)
-- No changes needed as parent_id is already set correctly

COMMENT ON COLUMN students.date_of_birth IS 'Student date of birth - updated for Mbali Skosana to reflect correct age of 5 years';
