# Storage Policies Manual Setup Required

## Summary
✅ Migration 1: homework-files bucket created successfully  
✅ Migration 2: Message notification type added successfully  
✅ Migration 3: Notifications FK fixed successfully  
⚠️  Storage RLS policies need manual setup via Supabase Dashboard

## Storage Policies to Add Manually

The storage policies for the `homework-files` bucket cannot be created via psql due to permissions. You need to add them manually through the Supabase Dashboard:

### Go to: Storage → homework-files bucket → Policies

### Policy 1: Parents can upload homework files for their children
```sql
CREATE POLICY "Parents can upload homework files for their children"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_child_links.child_id::text = (string_to_array(name, '/'))[4]
      AND parent_child_links.parent_id = auth.uid()
    )
    OR
    auth.uid()::text = (string_to_array(name, '/'))[4]
  )
);
```

### Policy 2: Teachers can view homework files in their preschool
```sql
CREATE POLICY "Teachers can view homework files in their preschool"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'teacher'
      AND users.preschool_id::text = (string_to_array(name, '/'))[2]
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'principal'
      AND users.preschool_id::text = (string_to_array(name, '/'))[2]
    )
  )
);
```

### Policy 3: Parents can view homework files for their children
```sql
CREATE POLICY "Parents can view homework files for their children"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_child_links.child_id::text = (string_to_array(name, '/'))[4]
      AND parent_child_links.parent_id = auth.uid()
    )
    OR
    auth.uid()::text = (string_to_array(name, '/'))[4]
  )
);
```

### Policy 4: Users can delete their own uploaded files
```sql
CREATE POLICY "Users can delete their own uploaded homework files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'homework-files'
  AND owner = auth.uid()
  AND created_at > now() - interval '24 hours'
);
```

## File Path Pattern
Files should be uploaded with this structure:
```
homework_submissions/{preschool_id}/{assignment_id}/{student_id}/{filename}
```

## Verification
After adding policies, verify with:
```sql
SELECT * FROM storage.buckets WHERE id = 'homework-files';
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%homework%';
```
