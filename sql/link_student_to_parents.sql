-- Link a student to parent + guardian by email
-- Replace placeholders before running.

-- 1) Locate the student (use preschool_id if you want to narrow it)
SELECT id, first_name, last_name, preschool_id
FROM students
WHERE LOWER(first_name) = LOWER('<STUDENT_FIRST_NAME>')
  AND (LOWER(last_name) = LOWER('<STUDENT_LAST_NAME>') OR '<STUDENT_LAST_NAME>' = '')
ORDER BY created_at DESC;

-- 2) Locate parent profiles by email
SELECT id, first_name, last_name, email
FROM profiles
WHERE LOWER(email) IN (LOWER('<PARENT_EMAIL>'), LOWER('<GUARDIAN_EMAIL>'));

-- 3) Update the student record
-- Replace <STUDENT_ID>, <PARENT_PROFILE_ID>, <GUARDIAN_PROFILE_ID>
UPDATE students
SET parent_id = '<PARENT_PROFILE_ID>',
    guardian_id = '<GUARDIAN_PROFILE_ID>'
WHERE id = '<STUDENT_ID>';

-- 4) Upsert relationships (optional but recommended)
INSERT INTO student_parent_relationships (student_id, parent_id, relationship_type, is_primary)
VALUES
  ('<STUDENT_ID>', '<PARENT_PROFILE_ID>', 'parent', true),
  ('<STUDENT_ID>', '<GUARDIAN_PROFILE_ID>', 'guardian', false)
ON CONFLICT DO NOTHING;
