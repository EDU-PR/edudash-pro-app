-- =============================================
-- POP Storage Buckets Migration
-- Create storage buckets for Proof of Payment and Picture of Progress
-- =============================================

-- Create proof-of-payment bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-of-payment',
  'proof-of-payment',
  false,  -- Private bucket
  52428800,  -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create picture-of-progress bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'picture-of-progress',
  'picture-of-progress',
  false,  -- Private bucket
  52428800,  -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================
-- Storage Policies for proof-of-payment bucket
-- =============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Parents can upload proof of payment" ON storage.objects;
DROP POLICY IF EXISTS "Parents can view their own proof of payment" ON storage.objects;
DROP POLICY IF EXISTS "Parents can update their own proof of payment" ON storage.objects;
DROP POLICY IF EXISTS "Parents can delete their own pending proof of payment" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view proof of payment" ON storage.objects;

-- Parents can upload to proof-of-payment bucket (their own folder)
CREATE POLICY "Parents can upload proof of payment"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proof-of-payment'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Parents can view their own proof of payment files
CREATE POLICY "Parents can view their own proof of payment"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proof-of-payment'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Parents can update their own proof of payment files
CREATE POLICY "Parents can update their own proof of payment"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'proof-of-payment'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'proof-of-payment'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Parents can delete their own proof of payment files
CREATE POLICY "Parents can delete their own proof of payment"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'proof-of-payment'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Staff (teachers, principals, superadmins) can view all proof of payment files
CREATE POLICY "Staff can view all proof of payment"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proof-of-payment'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('teacher', 'principal', 'superadmin', 'super_admin')
  )
);

-- =============================================
-- Storage Policies for picture-of-progress bucket
-- =============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Parents can upload picture of progress" ON storage.objects;
DROP POLICY IF EXISTS "Parents can view their own picture of progress" ON storage.objects;
DROP POLICY IF EXISTS "Parents can update their own picture of progress" ON storage.objects;
DROP POLICY IF EXISTS "Parents can delete their own picture of progress" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view picture of progress" ON storage.objects;

-- Parents can upload to picture-of-progress bucket (their own folder)
CREATE POLICY "Parents can upload picture of progress"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'picture-of-progress'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Parents can view their own picture of progress files
CREATE POLICY "Parents can view their own picture of progress"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'picture-of-progress'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Parents can update their own picture of progress files
CREATE POLICY "Parents can update their own picture of progress"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'picture-of-progress'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'picture-of-progress'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Parents can delete their own picture of progress files
CREATE POLICY "Parents can delete their own picture of progress"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'picture-of-progress'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Staff (teachers, principals, superadmins) can view all picture of progress files
CREATE POLICY "Staff can view all picture of progress"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'picture-of-progress'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('teacher', 'principal', 'superadmin', 'super_admin')
  )
);

-- =============================================
-- Verification queries (run manually to check)
-- =============================================
-- SELECT * FROM storage.buckets WHERE id IN ('proof-of-payment', 'picture-of-progress');
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
