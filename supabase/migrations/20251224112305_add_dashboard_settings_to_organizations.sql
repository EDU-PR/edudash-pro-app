-- Add dashboard_settings column to organizations table
-- This allows CEOs to customize dashboard appearance for their organization

-- Add the dashboard_settings JSONB column
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS dashboard_settings JSONB DEFAULT '{}';

-- Add comment explaining the column
COMMENT ON COLUMN organizations.dashboard_settings IS 'Organization dashboard customization settings including wallpaper, colors, and greeting';

-- Create index for faster queries on dashboard settings
CREATE INDEX IF NOT EXISTS idx_organizations_dashboard_settings 
ON organizations USING GIN (dashboard_settings);

-- Example dashboard_settings structure:
-- {
--   "wallpaper_url": "https://...",
--   "wallpaper_opacity": 0.15,
--   "primary_color": "#3B82F6",
--   "show_member_count": true,
--   "show_revenue": true,
--   "custom_greeting": "Welcome to Soil of Africa!"
-- }
