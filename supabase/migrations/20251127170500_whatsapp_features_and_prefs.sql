-- WhatsApp-style messaging enhancements and chat wallpaper preferences
-- Idempotent where possible

BEGIN;

-- 1) messages table enhancements (reply/forward/edit/delete/status)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_for jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL,
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id uuid NULL,
  ADD COLUMN IF NOT EXISTS message_status text NULL;

-- FKs for reply/forward to messages.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_reply_to_fk'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_reply_to_fk
      FOREIGN KEY (reply_to_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_forwarded_from_fk'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_forwarded_from_fk
      FOREIGN KEY (forwarded_from_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_messages_thread_created_at ON public.messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_forwarded_from ON public.messages(forwarded_from_message_id);

-- 2) typing_indicators table + RPC
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing boolean NOT NULL DEFAULT false,
  last_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT typing_unique_per_user_thread UNIQUE (thread_id, user_id)
);

ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Policies: only participants can see, users can write their own record
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='typing_indicators' AND policyname='typing_select_participants'
  ) THEN
    CREATE POLICY typing_select_participants ON public.typing_indicators
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.message_participants mp
          WHERE mp.thread_id = typing_indicators.thread_id AND mp.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='typing_indicators' AND policyname='typing_upsert_self'
  ) THEN
    CREATE POLICY typing_upsert_self ON public.typing_indicators
      FOR ALL TO authenticated
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.message_participants mp
          WHERE mp.thread_id = typing_indicators.thread_id AND mp.user_id = auth.uid()
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.message_participants mp
          WHERE mp.thread_id = typing_indicators.thread_id AND mp.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RPC: update_typing_indicator(thread_id, is_typing)
CREATE OR REPLACE FUNCTION public.update_typing_indicator(p_thread_id uuid, p_is_typing boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.typing_indicators(thread_id, user_id, is_typing, last_updated)
  VALUES (p_thread_id, auth.uid(), p_is_typing, now())
  ON CONFLICT (thread_id, user_id)
  DO UPDATE SET is_typing = EXCLUDED.is_typing, last_updated = now();
END;
$$;

REVOKE ALL ON FUNCTION public.update_typing_indicator(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_typing_indicator(uuid, boolean) TO authenticated;

-- 3) Edit / delete helpers
-- Edit within 15 minutes
CREATE OR REPLACE FUNCTION public.edit_message(p_message_id uuid, p_new_content text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  can_edit boolean;
BEGIN
  SELECT (m.sender_id = auth.uid())
         AND (now() - m.created_at < interval '15 minutes')
         AND (NOT COALESCE(m.deleted_for_everyone,false))
  INTO can_edit
  FROM public.messages m
  WHERE m.id = p_message_id;

  IF NOT can_edit THEN
    RETURN false;
  END IF;

  UPDATE public.messages
  SET content = p_new_content,
      edited_at = now()
  WHERE id = p_message_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_message(uuid, text) TO authenticated;

-- Delete for me: mark in deleted_for array
CREATE OR REPLACE FUNCTION public.delete_message_for_me(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET deleted_for = CASE 
    WHEN NOT (deleted_for ? (auth.uid())::text) THEN deleted_for || to_jsonb((auth.uid())::text)
    ELSE deleted_for
  END
  WHERE id = p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_message_for_me(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_message_for_me(uuid) TO authenticated;

-- Delete for everyone: only sender, within 1 hour
CREATE OR REPLACE FUNCTION public.delete_message_for_everyone(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  can_delete boolean;
BEGIN
  SELECT (m.sender_id = auth.uid())
         AND (now() - m.created_at < interval '1 hour')
  INTO can_delete
  FROM public.messages m
  WHERE m.id = p_message_id;

  IF NOT can_delete THEN
    RETURN false;
  END IF;

  UPDATE public.messages
  SET deleted_for_everyone = true
  WHERE id = p_message_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_message_for_everyone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_message_for_everyone(uuid) TO authenticated;

-- 4) Per-thread wallpaper preferences (per user)
CREATE TABLE IF NOT EXISTS public.message_thread_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallpaper_url text,
  wallpaper_preset text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_thread_prefs_unique UNIQUE (thread_id, user_id)
);

ALTER TABLE public.message_thread_prefs ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'message_thread_prefs_touch'
  ) THEN
    CREATE TRIGGER message_thread_prefs_touch
    BEFORE UPDATE ON public.message_thread_prefs
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- Policies: user can manage own prefs for threads they participate in
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_thread_prefs' AND policyname='prefs_select_participants'
  ) THEN
    CREATE POLICY prefs_select_participants ON public.message_thread_prefs
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.message_participants mp
          WHERE mp.thread_id = message_thread_prefs.thread_id AND mp.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_thread_prefs' AND policyname='prefs_upsert_self'
  ) THEN
    CREATE POLICY prefs_upsert_self ON public.message_thread_prefs
      FOR ALL TO authenticated
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.message_participants mp
          WHERE mp.thread_id = message_thread_prefs.thread_id AND mp.user_id = auth.uid()
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.message_participants mp
          WHERE mp.thread_id = message_thread_prefs.thread_id AND mp.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5) Storage bucket for chat wallpapers (public read, auth write)
-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
SELECT 'chat-wallpapers', 'chat-wallpapers', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'chat-wallpapers'
);

-- Policies for storage.objects
-- Allow read to everyone if bucket public (handled by storage). Allow authenticated to insert to their path.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_wallpapers_insert_auth'
  ) THEN
    CREATE POLICY chat_wallpapers_insert_auth ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'chat-wallpapers'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_wallpapers_update_auth'
  ) THEN
    CREATE POLICY chat_wallpapers_update_auth ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'chat-wallpapers'
      ) WITH CHECK (
        bucket_id = 'chat-wallpapers'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_wallpapers_delete_auth'
  ) THEN
    CREATE POLICY chat_wallpapers_delete_auth ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'chat-wallpapers'
      );
  END IF;
END $$;

COMMIT;