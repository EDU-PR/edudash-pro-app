BEGIN;

DROP POLICY IF EXISTS uniform_requests_staff_select ON public.uniform_requests;

CREATE POLICY uniform_requests_staff_select
ON public.uniform_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND lower(COALESCE(p.role, '')) IN (
        'principal',
        'principal_admin',
        'admin',
        'super_admin',
        'superadmin'
      )
      AND COALESCE(p.organization_id, p.preschool_id) = uniform_requests.preschool_id
  )
);

COMMIT;
