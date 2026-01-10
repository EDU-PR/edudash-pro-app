-- Fix classes table RLS policies to avoid infinite recursion
-- Using security definer functions to bypass RLS checks

-- Drop existing policies
DROP POLICY IF EXISTS "classes_admin_all" ON public.classes;
DROP POLICY IF EXISTS "classes_school_staff_manage" ON public.classes;
DROP POLICY IF EXISTS "classes_teacher_read_own" ON public.classes;
DROP POLICY IF EXISTS "classes_teacher_select" ON public.classes;
DROP POLICY IF EXISTS "classes_service_full" ON public.classes;
DROP POLICY IF EXISTS "classes_service_role" ON public.classes;

-- Create security definer function to check if user can manage classes for a preschool
CREATE OR REPLACE FUNCTION public.user_can_manage_classes(preschool_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.preschool_id, p.organization_id) = preschool_org_id
      )
      AND p.role IN ('principal', 'admin', 'principal_admin')
  );
END;
$$;

-- Create security definer function to check if user can view classes for a preschool
CREATE OR REPLACE FUNCTION public.user_can_view_classes(preschool_org_id UUID, class_teacher_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  user_preschool_id UUID;
  user_org_id UUID;
BEGIN
  -- Get user's preschool_id and organization_id
  SELECT p.preschool_id, p.organization_id
  INTO user_preschool_id, user_org_id
  FROM public.profiles p
  WHERE p.id = auth.uid();

  -- If user is the teacher of the class
  IF class_teacher_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- If user belongs to the same preschool/organization
  IF COALESCE(user_preschool_id, user_org_id) = preschool_org_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Re-create policies using security definer functions

-- Service role has full access
CREATE POLICY "classes_service_role"
ON public.classes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admins can manage all classes in their preschool/organization
CREATE POLICY "classes_admin_all"
ON public.classes
FOR ALL
TO authenticated
USING (
  public.user_can_manage_classes(preschool_id)
)
WITH CHECK (
  public.user_can_manage_classes(preschool_id)
);

-- Teachers and staff can view classes in their preschool/organization
CREATE POLICY "classes_teacher_select"
ON public.classes
FOR SELECT
TO authenticated
USING (
  public.user_can_view_classes(preschool_id, teacher_id)
);

-- Add comments
COMMENT ON FUNCTION public.user_can_manage_classes(UUID) IS
'Security definer function to check if user can manage classes for a preschool/organization';

COMMENT ON FUNCTION public.user_can_view_classes(UUID, UUID) IS
'Security definer function to check if user can view classes for a preschool/organization';

COMMENT ON POLICY "classes_admin_all" ON public.classes IS
'Allows admins and principals to manage classes in their preschool/organization';

COMMENT ON POLICY "classes_teacher_select" ON public.classes IS
'Allows teachers and staff to view classes in their preschool/organization';
