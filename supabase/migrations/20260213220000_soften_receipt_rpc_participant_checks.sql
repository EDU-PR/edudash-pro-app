-- Soften receipt RPC participant checks
--
-- Previously mark_thread_messages_as_read, mark_message_as_read, and
-- mark_messages_delivered raised EXCEPTION when caller was not a thread
-- participant, returning HTTP 400 to the client. This caused noisy
-- error loops because the client retries automatically.
--
-- Fix: return gracefully (RETURN / RETURN 0) when the caller is not a
-- participant. The security model is still enforced: no data is modified,
-- no information is leaked, auth.uid() still governs identity.

BEGIN;

-- 1) mark_message_as_read — return void (no-op) if not participant
CREATE OR REPLACE FUNCTION public.mark_message_as_read(message_id uuid, reader_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_caller uuid;
  v_thread_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF reader_id IS NOT NULL AND reader_id <> v_caller THEN
    RAISE EXCEPTION 'reader_id must match auth.uid()' USING ERRCODE = '42501';
  END IF;

  SELECT m.thread_id INTO v_thread_id
  FROM public.messages m WHERE m.id = mark_message_as_read.message_id;

  IF v_thread_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.user_is_thread_participant(v_thread_id) THEN
    RETURN;
  END IF;

  UPDATE public.messages m
  SET read_by = array_append(coalesce(m.read_by, '{}'::uuid[]), v_caller)
  WHERE m.id = mark_message_as_read.message_id
    AND m.sender_id <> v_caller
    AND NOT (v_caller = ANY(coalesce(m.read_by, '{}'::uuid[])));

  UPDATE public.message_participants mp
  SET last_read_at = now()
  WHERE mp.thread_id = v_thread_id AND mp.user_id = v_caller;
END;
$$;

-- 2) mark_thread_messages_as_read — return void (no-op) if not participant
CREATE OR REPLACE FUNCTION public.mark_thread_messages_as_read(thread_id uuid, reader_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF reader_id IS NOT NULL AND reader_id <> v_caller THEN
    RAISE EXCEPTION 'reader_id must match auth.uid()' USING ERRCODE = '42501';
  END IF;

  IF mark_thread_messages_as_read.thread_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.user_is_thread_participant(mark_thread_messages_as_read.thread_id) THEN
    RETURN;
  END IF;

  UPDATE public.messages m
  SET read_by = array_append(coalesce(m.read_by, '{}'::uuid[]), v_caller)
  WHERE m.thread_id = mark_thread_messages_as_read.thread_id
    AND m.sender_id <> v_caller
    AND NOT (v_caller = ANY(coalesce(m.read_by, '{}'::uuid[])));

  UPDATE public.message_participants mp
  SET last_read_at = now()
  WHERE mp.thread_id = mark_thread_messages_as_read.thread_id
    AND mp.user_id = v_caller;
END;
$$;

-- 3) mark_messages_delivered — return 0 if not participant
DROP FUNCTION IF EXISTS public.mark_messages_delivered(uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.mark_messages_delivered(
  p_thread_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  thread_id uuid DEFAULT NULL,
  user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_caller uuid;
  v_thread uuid;
  v_user uuid;
  updated_count integer;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  v_thread := coalesce(p_thread_id, mark_messages_delivered.thread_id);
  IF v_thread IS NULL THEN
    RETURN 0;
  END IF;

  v_user := coalesce(p_user_id, mark_messages_delivered.user_id);
  IF v_user IS NOT NULL AND v_user <> v_caller THEN
    RAISE EXCEPTION 'user_id must match auth.uid()' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_is_thread_participant(v_thread) THEN
    RETURN 0;
  END IF;

  UPDATE public.messages m
  SET delivered_at = now()
  WHERE m.thread_id = v_thread
    AND m.sender_id <> v_caller
    AND m.delivered_at IS NULL
    AND m.deleted_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_delivered(uuid, uuid, uuid, uuid) TO authenticated;

COMMIT;
