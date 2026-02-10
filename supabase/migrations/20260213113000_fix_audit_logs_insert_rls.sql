-- Allow authenticated admin-level users to write audit logs under RLS.
-- This unblocks super-admin and principal/admin client-side audit inserts.

DROP POLICY IF EXISTS "Admin users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Admin users can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_level()
  AND (
    public.is_super_admin()
    OR (
      actor_organization_id IS NOT NULL
      AND public.can_access_organization(actor_organization_id)
    )
  )
  AND (
    actor_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = actor_id
        AND (p.auth_user_id = auth.uid() OR p.id = auth.uid())
    )
  )
);

