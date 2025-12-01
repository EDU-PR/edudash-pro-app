-- Database Tables Verification for Parent Dashboard Features
-- Run this to verify all required tables exist

-- Check if announcements table exists and has correct structure
SELECT 
  'announcements' as table_name,
  COUNT(*) as row_count,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='priority') as has_priority,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='target_audience') as has_target_audience
FROM announcements;

-- Check if homework_submissions table exists
SELECT 
  'homework_submissions' as table_name,
  COUNT(*) as row_count,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='homework_submissions' AND column_name='grade') as has_grade,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='homework_submissions' AND column_name='feedback') as has_feedback
FROM homework_submissions;

-- Check if messages table exists
SELECT 
  'messages' as table_name,
  COUNT(*) as row_count,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='subject') as has_subject,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='recipient_id') as has_recipient_id
FROM messages;

-- Check if students table exists
SELECT 
  'students' as table_name,
  COUNT(*) as row_count,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='parent_id') as has_parent_id,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='class_id') as has_class_id
FROM students;

-- Check if notifications table exists
SELECT 
  'notifications' as table_name,
  COUNT(*) as row_count,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') as has_type,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_read') as has_is_read
FROM notifications;

-- Check if class_events table exists (for calendar)
SELECT 
  'class_events' as table_name,
  COUNT(*) as row_count,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='class_events' AND column_name='event_type') as has_event_type,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='class_events' AND column_name='start_time') as has_start_time
FROM class_events;

-- List all RLS policies for these tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('announcements', 'homework_submissions', 'messages', 'students', 'notifications', 'class_events')
ORDER BY tablename, policyname;
