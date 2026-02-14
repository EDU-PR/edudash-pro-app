-- Allow message owners to soft-delete/edit their own messages without failing WITH CHECK.
BEGIN;

DROP POLICY IF EXISTS messages_update_policy ON public.messages;

CREATE POLICY messages_update_policy
ON public.messages
FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

COMMIT;
