-- Check if parent account and student were created for dipsroboticsgm@gmail.com
-- Run this in EduDashPro database

-- Check for parent profile
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  preschool_id,
  created_at
FROM profiles
WHERE email = 'dipsroboticsgm@gmail.com';

-- Check for students linked to this parent
SELECT 
  s.id,
  s.first_name,
  s.last_name,
  s.date_of_birth,
  s.parent_id,
  s.created_at
FROM students s
WHERE s.parent_id IN (
  SELECT id FROM profiles WHERE email = 'dipsroboticsgm@gmail.com'
);

-- Check registration status
SELECT 
  id,
  guardian_email,
  student_first_name,
  student_last_name,
  status,
  registration_fee_paid,
  proof_of_payment_url,
  created_at,
  reviewed_date
FROM registration_requests
WHERE guardian_email = 'dipsroboticsgm@gmail.com';
