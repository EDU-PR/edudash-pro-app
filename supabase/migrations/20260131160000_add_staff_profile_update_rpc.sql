-- Allow principals/admins to update parent contact details in their school
-- Uses a SECURITY DEFINER function to avoid broad UPDATE privileges on profiles

DO $sql$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.update_profile_contact_by_staff(
    target_profile_id uuid,
    new_first_name text,
    new_last_name text,
    new_phone text,
    new_email text
  )
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO public, auth, extensions
  AS $$
  DECLARE
    viewer_record public.profiles%rowtype;
    target_record public.profiles%rowtype;
    viewer_school uuid;
    target_school uuid;
  BEGIN
    SELECT *
    INTO viewer_record
    FROM public.profiles
    WHERE auth_user_id = auth.uid() OR id = auth.uid()
    LIMIT 1;

    IF viewer_record.id IS NULL THEN
      RAISE EXCEPTION 'profile_not_found';
    END IF;

    IF viewer_record.role NOT IN ('principal', 'principal_admin', 'admin', 'super_admin') THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;

    SELECT *
    INTO target_record
    FROM public.profiles
    WHERE id = target_profile_id
    LIMIT 1;

    IF target_record.id IS NULL THEN
      RAISE EXCEPTION 'target_not_found';
    END IF;

    IF viewer_record.role <> 'super_admin' THEN
      viewer_school := COALESCE(viewer_record.organization_id, viewer_record.preschool_id);
      target_school := COALESCE(target_record.organization_id, target_record.preschool_id);

      IF viewer_school IS NULL OR target_school IS NULL OR viewer_school <> target_school THEN
        RAISE EXCEPTION 'not_authorized';
      END IF;
    END IF;

    UPDATE public.profiles
    SET first_name = COALESCE(new_first_name, first_name),
        last_name = COALESCE(new_last_name, last_name),
        phone = COALESCE(new_phone, phone),
        email = COALESCE(new_email, email),
        updated_at = NOW()
    WHERE id = target_profile_id;

    RETURN true;
  END;
  $$;

  GRANT EXECUTE ON FUNCTION public.update_profile_contact_by_staff(uuid, text, text, text, text) TO authenticated;
END $sql$;
