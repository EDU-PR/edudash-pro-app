-- Create organization-assets storage bucket for wallpapers and branding
-- This bucket stores organization-specific assets like dashboard wallpapers

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-assets',
  'organization-assets',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for organization-assets bucket

-- Allow authenticated users to upload to their organization's folder
CREATE POLICY "organization_assets_upload_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-assets'
);

-- Allow public read access (wallpapers need to be publicly viewable)
CREATE POLICY "organization_assets_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'organization-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "organization_assets_update_policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'organization-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "organization_assets_delete_policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'organization-assets');

COMMENT ON TABLE storage.buckets IS 'organization-assets bucket for wallpapers and org branding';
