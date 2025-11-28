-- Migration: Add FK from message_participants.user_id to profiles.id
-- This enables Supabase PostgREST to automatically join message_participants with profiles
-- Required for the messages page to fetch participant profile details

-- Add foreign key constraint (profiles.id references auth.users.id, same as message_participants.user_id)
ALTER TABLE public.message_participants
ADD CONSTRAINT message_participants_user_profile_fk
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- NOTE: messages.sender_id already has a FK to profiles via messages_sender_id_fkey
-- Do NOT add another FK constraint as it causes ambiguous relationship errors in PostgREST
