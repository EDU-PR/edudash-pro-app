-- Migration: Migrate messaging tables foreign keys from auth.users to profiles
-- Date: 2025-11-25
-- Description: Fix foreign key relationships to use profiles table instead of legacy auth.users

-- ============================================================================
-- MESSAGE_PARTICIPANTS: Migrate user_id FK
-- ============================================================================

ALTER TABLE message_participants
DROP CONSTRAINT IF EXISTS message_participants_user_id_fkey;

ALTER TABLE message_participants
ADD CONSTRAINT message_participants_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================================
-- MESSAGES: Migrate sender_id FK
-- ============================================================================

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE messages
ADD CONSTRAINT messages_sender_id_fkey
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================================
-- MESSAGE_THREADS: Migrate created_by FK
-- ============================================================================

ALTER TABLE message_threads
DROP CONSTRAINT IF EXISTS message_threads_created_by_fkey;

ALTER TABLE message_threads
ADD CONSTRAINT message_threads_created_by_fkey
FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- All messaging tables should now reference profiles(id) instead of auth.users(id)
-- This enables Supabase PostgREST to use the relationships in queries

COMMENT ON CONSTRAINT message_participants_user_id_fkey ON message_participants 
IS 'Foreign key to profiles table for user relationship';

COMMENT ON CONSTRAINT messages_sender_id_fkey ON messages 
IS 'Foreign key to profiles table for sender relationship';

COMMENT ON CONSTRAINT message_threads_created_by_fkey ON message_threads 
IS 'Foreign key to profiles table for creator relationship';
