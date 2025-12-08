-- Check current RLS policies on preschools table
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'preschools';

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "preschools_select_policy" ON preschools;
DROP POLICY IF EXISTS "preschools_insert_policy" ON preschools;
DROP POLICY IF EXISTS "preschools_update_policy" ON preschools;
DROP POLICY IF EXISTS "preschools_delete_policy" ON preschools;

-- Create permissive policies for preschools table

-- Allow service role full access (for sign-up process)
CREATE POLICY "Service role full access" ON preschools
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to insert (for principal sign-up)
CREATE POLICY "Allow insert during sign-up" ON preschools
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to read preschools they belong to
CREATE POLICY "Users can read their preschool" ON preschools
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT preschool_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Allow principals to update their preschool
CREATE POLICY "Principals can update their preschool" ON preschools
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT preschool_id 
      FROM profiles 
      WHERE id = auth.uid() AND role = 'principal'
    )
  )
  WITH CHECK (
    id IN (
      SELECT preschool_id 
      FROM profiles 
      WHERE id = auth.uid() AND role = 'principal'
    )
  );

-- Allow superadmins full access
CREATE POLICY "Superadmins full access" ON preschools
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Verify new policies
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'preschools'
ORDER BY policyname;
