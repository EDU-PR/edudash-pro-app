-- Add missing payment_verified_at and payment_verified_by columns to registration_requests table
-- These columns are already in child_registration_requests but were missing in registration_requests
-- This fixes the "Could not find the 'payment_verified_at' column" error when verifying payments

-- Add payment_verified_at column
ALTER TABLE registration_requests 
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;

-- Add payment_verified_by column
ALTER TABLE registration_requests 
ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES auth.users(id);

-- Add comments
COMMENT ON COLUMN registration_requests.payment_verified_at IS 'When payment was verified by principal';
COMMENT ON COLUMN registration_requests.payment_verified_by IS 'User ID of principal who verified payment';

-- Also ensure the storage bucket for registration documents exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'registration-documents',
  'registration-documents', 
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for registration-documents bucket
CREATE POLICY IF NOT EXISTS "Users can upload their own registration documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'registration-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY IF NOT EXISTS "Users can view their own registration documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'registration-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY IF NOT EXISTS "Principals can view registration documents for their school"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'registration-documents' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'super_admin')
  )
);
