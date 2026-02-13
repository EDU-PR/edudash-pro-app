-- Harden message receipt RPCs + add aggregated thread summary RPC
--
-- Goals:
-- 1) Read/delivered receipts must not be spoofable (auth.uid() is source of truth)
-- 2) Only thread participants can mark delivered/read
-- 3) Provide a short compatibility window for mark_messages_delivered arg names
-- 4) Remove N+1 unread/last-message queries via a single summary RPC

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read receipt RPCs (hardened)
-- ─────────────────────────────────────────────────────────────────────────────

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

  SELECT m.thread_id
    INTO v_thread_id
  FROM public.messages m
  WHERE m.id = message_id;

  IF v_thread_id IS NULL THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = '22023';
  END IF;

  IF NOT public.user_is_thread_participant(v_thread_id) THEN
    RAISE EXCEPTION 'Not a thread participant' USING ERRCODE = '42501';
  END IF;

  -- Do not mark your own message as read. Avoid duplicates. Handle NULL read_by arrays.
  UPDATE public.messages m
  SET read_by = array_append(coalesce(m.read_by, '{}'::uuid[]), v_caller)
  WHERE m.id = message_id
    AND m.sender_id <> v_caller
    AND NOT (v_caller = ANY(coalesce(m.read_by, '{}'::uuid[])));

  -- Best-effort: bump participant last_read_at for the thread.
  UPDATE public.message_participants mp
  SET last_read_at = now()
  WHERE mp.thread_id = v_thread_id
    AND mp.user_id = v_caller;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_message_as_read(uuid, uuid) TO authenticated;

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

  IF thread_id IS NULL THEN
    RAISE EXCEPTION 'thread_id is required' USING ERRCODE = '22023';
  END IF;

  IF NOT public.user_is_thread_participant(thread_id) THEN
    RAISE EXCEPTION 'Not a thread participant' USING ERRCODE = '42501';
  END IF;

  UPDATE public.messages m
  SET read_by = array_append(coalesce(m.read_by, '{}'::uuid[]), v_caller)
  WHERE m.thread_id = thread_id
    AND m.sender_id <> v_caller
    AND NOT (v_caller = ANY(coalesce(m.read_by, '{}'::uuid[])));

  UPDATE public.message_participants mp
  SET last_read_at = now()
  WHERE mp.thread_id = thread_id
    AND mp.user_id = v_caller;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_thread_messages_as_read(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Delivered receipt RPC (hardened + compatibility args)
-- NOTE: Postgres cannot overload by argument *name*, only by *type*.
-- To support legacy web/native clients for one release window, we accept both:
--   - canonical: p_thread_id / p_user_id
--   - legacy:    thread_id  / user_id
-- Caller identity is always auth.uid(); provided user_id is validated (no spoof).
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.mark_messages_delivered(uuid, uuid);

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

  v_thread := coalesce(p_thread_id, thread_id);
  IF v_thread IS NULL THEN
    RAISE EXCEPTION 'thread_id is required' USING ERRCODE = '22023';
  END IF;

  v_user := coalesce(p_user_id, user_id);
  IF v_user IS NOT NULL AND v_user <> v_caller THEN
    RAISE EXCEPTION 'user_id must match auth.uid()' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_is_thread_participant(v_thread) THEN
    RAISE EXCEPTION 'Not a thread participant' USING ERRCODE = '42501';
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Aggregated per-thread summary (unread count + last message fields)
-- Removes N+1 patterns in role dashboards.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_message_threads_summary()
RETURNS TABLE(
  thread_id uuid,
  unread_count integer,
  last_message_id uuid,
  last_message_content text,
  last_message_created_at timestamptz,
  last_message_sender_id uuid,
  last_message_delivered_at timestamptz,
  last_message_read_by uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH my_threads AS (
    SELECT mp.thread_id,
           mp.last_read_at
    FROM public.message_participants mp
    WHERE mp.user_id = auth.uid()
  ),
  last_messages AS (
    SELECT DISTINCT ON (m.thread_id)
      m.thread_id,
      m.id AS last_message_id,
      m.content AS last_message_content,
      m.created_at AS last_message_created_at,
      m.sender_id AS last_message_sender_id,
      m.delivered_at AS last_message_delivered_at,
      m.read_by AS last_message_read_by
    FROM public.messages m
    JOIN my_threads t ON t.thread_id = m.thread_id
    WHERE m.deleted_at IS NULL
    ORDER BY m.thread_id, m.created_at DESC
  ),
  unread AS (
    SELECT
      m.thread_id,
      count(*)::int AS unread_count
    FROM public.messages m
    JOIN my_threads t ON t.thread_id = m.thread_id
    WHERE m.deleted_at IS NULL
      AND m.sender_id <> auth.uid()
      AND m.created_at > COALESCE(t.last_read_at, '2000-01-01'::timestamptz)
    GROUP BY m.thread_id
  )
  SELECT
    t.thread_id,
    COALESCE(u.unread_count, 0) AS unread_count,
    lm.last_message_id,
    lm.last_message_content,
    lm.last_message_created_at,
    lm.last_message_sender_id,
    lm.last_message_delivered_at,
    lm.last_message_read_by
  FROM my_threads t
  LEFT JOIN unread u ON u.thread_id = t.thread_id
  LEFT JOIN last_messages lm ON lm.thread_id = t.thread_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_message_threads_summary() TO authenticated;

COMMIT;

