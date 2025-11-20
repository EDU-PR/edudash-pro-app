-- Allow parents to view all active preschools when registering children
-- This is necessary for the "Select School" dropdown in child registration

-- Enable RLS on preschools if not already enabled
ALTER TABLE preschools ENABLE ROW LEVEL SECURITY;

-- Drop existing public read policy if it exists
DROP POLICY IF EXISTS "preschools_public_read" ON preschools;

-- Create policy to allow authenticated users to view all active preschools
CREATE POLICY "preschools_public_read"
ON preschools
FOR SELECT
TO authenticated
USING (is_active = true);

-- Verify the policy was created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies
WHERE tablename = 'preschools'
ORDER BY policyname;
