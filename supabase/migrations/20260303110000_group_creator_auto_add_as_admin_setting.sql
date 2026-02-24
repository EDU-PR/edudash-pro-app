-- ============================================================================
-- Group Creator Auto-Add as Admin Setting
-- ============================================================================
-- Allows principals/admins to configure whether teachers who create class
-- or parent groups are automatically added to those groups as admins.
-- Default: true (creator is always added as admin).
-- ============================================================================

-- Add column to preschool_settings
ALTER TABLE preschool_settings
ADD COLUMN IF NOT EXISTS group_creator_auto_add_as_admin BOOLEAN DEFAULT true;

COMMENT ON COLUMN preschool_settings.group_creator_auto_add_as_admin IS
  'When true, teachers who create class or parent groups are automatically added as admins. Principals can disable this.';
