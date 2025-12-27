-- Add RLS policies for superadmin to manage organizations (delete, update)
-- Also fix subscriptions read policy for superadmin

-- ============================================================================
-- SUBSCRIPTIONS - Superadmin read access
-- ============================================================================

DROP POLICY IF EXISTS subscriptions_superadmin_read ON subscriptions;
CREATE POLICY subscriptions_superadmin_read ON subscriptions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

-- ============================================================================
-- PRESCHOOLS - Superadmin delete and update
-- ============================================================================

DROP POLICY IF EXISTS preschools_superadmin_delete ON preschools;
CREATE POLICY preschools_superadmin_delete ON preschools
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

DROP POLICY IF EXISTS preschools_superadmin_update ON preschools;
CREATE POLICY preschools_superadmin_update ON preschools
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

-- ============================================================================
-- SCHOOLS - Superadmin delete and update
-- ============================================================================

DROP POLICY IF EXISTS schools_superadmin_delete ON schools;
CREATE POLICY schools_superadmin_delete ON schools
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

DROP POLICY IF EXISTS schools_superadmin_update ON schools;
CREATE POLICY schools_superadmin_update ON schools
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

-- ============================================================================
-- ORGANIZATIONS - Superadmin delete and update
-- ============================================================================

DROP POLICY IF EXISTS organizations_superadmin_delete ON organizations;
CREATE POLICY organizations_superadmin_delete ON organizations
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

DROP POLICY IF EXISTS organizations_superadmin_update ON organizations;
CREATE POLICY organizations_superadmin_update ON organizations
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

-- Add comments
COMMENT ON POLICY subscriptions_superadmin_read ON subscriptions IS 'Allow superadmin to view all subscriptions';
COMMENT ON POLICY preschools_superadmin_delete ON preschools IS 'Allow superadmin to delete preschools';
COMMENT ON POLICY preschools_superadmin_update ON preschools IS 'Allow superadmin to update preschools';
COMMENT ON POLICY schools_superadmin_delete ON schools IS 'Allow superadmin to delete schools';
COMMENT ON POLICY schools_superadmin_update ON schools IS 'Allow superadmin to update schools';
COMMENT ON POLICY organizations_superadmin_delete ON organizations IS 'Allow superadmin to delete organizations';
COMMENT ON POLICY organizations_superadmin_update ON organizations IS 'Allow superadmin to update organizations';

-- ============================================================================
-- PROFILES - Superadmin update (for unlinking users from organizations)
-- ============================================================================

DROP POLICY IF EXISTS profiles_superadmin_update ON profiles;
CREATE POLICY profiles_superadmin_update ON profiles
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'superadmin'
  )
);

COMMENT ON POLICY profiles_superadmin_update ON profiles IS 'Allow superadmin to update any profile (for unlinking from organizations)';
