-- Run this in Supabase SQL Editor to find the registration and get its ID
SELECT 
  id,
  guardian_email,
  guardian_name,
  student_first_name,
  student_last_name,
  status,
  created_at
FROM registration_requests
WHERE guardian_email = 'dipsroboticsgm@gmail.com'
ORDER BY created_at DESC
LIMIT 1;

-- Copy the 'id' value from the result, then use it to manually trigger the Edge Function
-- Go to Edge Functions → sync-registration-to-edudash → Invoke
-- Body: {"registration_id": "paste-id-here"}
