-- Soften mark_thread_messages_as_read behavior:
-- return no-op for non-participants instead of raising 42501.

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_thread_messages_as_read(
  p_thread_id uuid DEFAULT NULL,
  p_reader_id uuid DEFAULT NULL,
  thread_id uuid DEFAULT NULL,
  reader_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_caller uuid;
  v_thread_id uuid;
  v_reader_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  v_thread_id := COALESCE(p_thread_id, thread_id);
  IF v_thread_id IS NULL THEN
    RAISE EXCEPTION 'thread_id is required' USING ERRCODE = '22023';
  END IF;

  v_reader_id := COALESCE(p_reader_id, reader_id, v_caller);
  IF v_reader_id <> v_caller THEN
    RAISE EXCEPTION 'reader_id must match auth.uid()' USING ERRCODE = '42501';
  END IF;

  -- No-op for non-participants to prevent noisy client retry loops.
  IF NOT public.user_is_thread_participant(v_thread_id) THEN
    RETURN;
  END IF;

  UPDATE public.messages m
  SET read_by = array_append(COALESCE(m.read_by, '{}'::uuid[]), v_caller)
  WHERE m.thread_id = v_thread_id
    AND m.sender_id <> v_caller
    AND NOT (v_caller = ANY(COALESCE(m.read_by, '{}'::uuid[])));

  UPDATE public.message_participants mp
  SET last_read_at = NOW()
  WHERE mp.thread_id = v_thread_id
    AND mp.user_id = v_caller;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_thread_messages_as_read(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_thread_messages_as_read(uuid, uuid, uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
