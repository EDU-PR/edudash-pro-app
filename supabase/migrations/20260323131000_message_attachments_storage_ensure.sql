-- Ensure message-attachments bucket and policies exist (re-run safe).
-- Version 20260323130000 may already be in schema_migrations; this migration uses a new version.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'message-attachments',
    'message-attachments',
    true,
    52428800, -- 50 MB
    ARRAY[
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/quicktime',
        'video/webm'
    ]::text[]
)
ON CONFLICT (id)
DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "message_attachments_insert" ON storage.objects;
CREATE POLICY "message_attachments_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'message-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "message_attachments_select" ON storage.objects;
CREATE POLICY "message_attachments_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'message-attachments');

COMMIT;
