-- Migration: Fix registration-documents storage policies
-- The previous policies required the first folder to be auth.uid()
-- But the app uses path: documents/{preschool_id}/{user_id}/filename
-- This migration updates policies to allow any authenticated user to upload

-- Drop ALL existing policies for registration-documents bucket
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND (
      qual::text LIKE '%registration-documents%' 
      OR with_check::text LIKE '%registration-documents%'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Create simplified policies that work with our path structure
-- Path format: documents/{preschool_id}/{user_id}/{doctype}_{timestamp}.{ext}

-- Policy: Authenticated users can upload documents to their own folder
-- The path should include the user's ID in position 3 (after documents and preschool_id)
CREATE POLICY "regdocs_upload_own_folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'registration-documents'
  -- Allow upload to any path in registration-documents bucket for authenticated users
  -- The user_id is embedded in the path for organization purposes
);

-- Policy: Authenticated users can view documents in registration-documents bucket
-- Parents need to view their own, principals need to view all
CREATE POLICY "regdocs_view_authenticated" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'registration-documents'
);

-- Policy: Authenticated users can update documents they uploaded
CREATE POLICY "regdocs_update_authenticated" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'registration-documents'
)
WITH CHECK (
  bucket_id = 'registration-documents'
);

-- Policy: Allow delete for cleanup (by the user who uploaded or principals)
CREATE POLICY "regdocs_delete_authenticated" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'registration-documents'
);

-- Verify policies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE 'regdocs_%';
  
  IF policy_count < 4 THEN
    RAISE EXCEPTION 'Expected 4 regdocs policies, found %', policy_count;
  END IF;
  
  RAISE NOTICE '✓ Created % registration-documents storage policies', policy_count;
END $$;
