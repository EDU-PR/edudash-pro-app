-- Fix storage.objects recursion by moving attachment image count into
-- a SECURITY DEFINER function with row_security disabled.

BEGIN;

-- Helper: count today's image uploads in attachments bucket for a user
CREATE OR REPLACE FUNCTION public.count_daily_attachment_images(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
SET row_security = off
AS $$
  SELECT count(*)
  FROM storage.objects o
  WHERE p_user_id IS NOT NULL
    AND o.bucket_id = 'attachments'
    AND (storage.foldername(o.name))[1] = p_user_id::text
    AND o.created_at::date = CURRENT_DATE
    AND (
      COALESCE(o.metadata->>'mimetype','') LIKE 'image/%'
      OR o.name ~* '\\.(jpg|jpeg|png|gif|webp|bmp)$'
    );
$$;

GRANT EXECUTE ON FUNCTION public.count_daily_attachment_images(uuid) TO authenticated, service_role;

-- Replace recursive policy with safe function call
DROP POLICY IF EXISTS attachments_upload_limit_images ON storage.objects;

CREATE POLICY attachments_upload_limit_images
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id <> 'attachments'
  OR (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      (
        COALESCE(metadata->>'mimetype','') NOT LIKE 'image/%'
        AND name !~* '\\.(jpg|jpeg|png|gif|webp|bmp)$'
      )
      OR get_user_subscription_tier(auth.uid()) NOT IN ('free','trial')
      OR public.count_daily_attachment_images(auth.uid()) < 10
    )
  )
);

COMMIT;
