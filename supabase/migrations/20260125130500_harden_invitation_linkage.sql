-- Harden invitation/join linkage flows:
-- 1) Ensure auth_user_id is always set when linking profiles.
-- 2) Prevent authenticated users from linking other users via public RPCs.

DO $sql$
BEGIN
  IF to_regclass('public.school_invitation_codes') IS NOT NULL
     AND to_regclass('public.profiles') IS NOT NULL
     AND to_regclass('public.users') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.use_invitation_code(
        p_code text,
        p_auth_user_id uuid,
        p_name text,
        p_phone text DEFAULT NULL::text
      )
      RETURNS uuid
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public', 'auth'
      SET row_security = off
      AS $body$
      DECLARE
        v_invitation public.school_invitation_codes%rowtype;
        v_profile_id uuid;
        v_profile_email text;
        v_auth_email text;
        v_full_name text := p_name;
        v_first text;
        v_last text;
        v_existing_profile_preschool_id uuid;
        v_actor_role text := auth.role();
        v_actor_id uuid := auth.uid();
      BEGIN
        -- Only allow linking the authenticated user, unless called by service role.
        IF v_actor_role <> 'service_role' AND (v_actor_id IS NULL OR v_actor_id <> p_auth_user_id) THEN
          RAISE EXCEPTION 'Cannot redeem invitation for a different user';
        END IF;

        -- Lock and load the invitation row to prevent race conditions
        SELECT * INTO v_invitation
        FROM public.school_invitation_codes
        WHERE code = p_code
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Invalid or expired invitation code';
        END IF;

        -- Basic validations
        IF COALESCE(v_invitation.is_active, false) = false THEN
          RAISE EXCEPTION 'Invitation code is inactive';
        END IF;

        IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN
          RAISE EXCEPTION 'Invitation code has expired';
        END IF;

        IF v_invitation.max_uses IS NOT NULL AND v_invitation.max_uses > 0
           AND COALESCE(v_invitation.current_uses, 0) >= v_invitation.max_uses THEN
          RAISE EXCEPTION 'Invitation code has reached its maximum number of uses';
        END IF;

        IF v_invitation.invitation_type <> 'parent' THEN
          RAISE EXCEPTION 'Unsupported invitation type: %', v_invitation.invitation_type;
        END IF;

        -- Check if profile already exists and is linked to a DIFFERENT school
        SELECT preschool_id, email INTO v_existing_profile_preschool_id, v_profile_email
        FROM public.profiles
        WHERE id = p_auth_user_id;

        IF FOUND AND v_existing_profile_preschool_id IS NOT NULL
           AND v_existing_profile_preschool_id <> v_invitation.preschool_id THEN
          RAISE EXCEPTION 'You are already linked to a different school. Please contact support to change schools.';
        END IF;

        -- If profile is already linked to THIS school, just return success (idempotent)
        IF FOUND AND v_existing_profile_preschool_id = v_invitation.preschool_id THEN
          RETURN p_auth_user_id;
        END IF;

        -- Get auth email as fallback
        SELECT email INTO v_auth_email FROM auth.users WHERE id = p_auth_user_id;

        -- Derive name parts; fallback to email local part if needed
        IF v_full_name IS NULL OR btrim(v_full_name) = '' THEN
          v_full_name := COALESCE(split_part(COALESCE(v_profile_email, v_auth_email), '@', 1), 'Parent');
        END IF;
        v_first := btrim(split_part(v_full_name, ' ', 1));
        IF position(' ' in v_full_name) > 0 THEN
          v_last := btrim(substr(v_full_name, position(' ' in v_full_name) + 1));
        ELSE
          v_last := NULL;
        END IF;

        -- Update profile (primary table)
        UPDATE public.profiles
        SET preschool_id = v_invitation.preschool_id,
            organization_id = v_invitation.preschool_id,
            role = CASE WHEN role IS NULL OR role = 'parent' THEN 'parent' ELSE role END,
            auth_user_id = COALESCE(auth_user_id, id),
            phone = COALESCE(phone, p_phone),
            first_name = COALESCE(NULLIF(first_name, ''), v_first),
            last_name = COALESCE(NULLIF(last_name, ''), v_last),
            email = COALESCE(email, v_profile_email, v_auth_email),
            updated_at = now()
        WHERE id = p_auth_user_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Profile not found for user. Please ensure you are signed in.';
        END IF;

        -- Sync to legacy users table for backward compatibility
        INSERT INTO public.users (
          auth_user_id, email, name, phone, role, preschool_id, organization_id,
          is_active, first_name, last_name, created_at, updated_at
        ) VALUES (
          p_auth_user_id,
          COALESCE(v_profile_email, v_auth_email),
          v_full_name,
          p_phone,
          'parent',
          v_invitation.preschool_id,
          v_invitation.preschool_id,
          true,
          COALESCE(NULLIF(v_first, ''), v_full_name),
          NULLIF(v_last, ''),
          now(),
          now()
        )
        ON CONFLICT (auth_user_id) DO UPDATE
          SET email = COALESCE(EXCLUDED.email, users.email),
              name = COALESCE(EXCLUDED.name, users.name),
              phone = COALESCE(EXCLUDED.phone, users.phone),
              role = 'parent',
              preschool_id = EXCLUDED.preschool_id,
              organization_id = EXCLUDED.organization_id,
              is_active = true,
              updated_at = now();

        -- Mark the invitation as used and increment counters (only on first use)
        UPDATE public.school_invitation_codes sic
        SET current_uses = COALESCE(sic.current_uses, 0) + 1,
            used_at = now(),
            used_by = p_auth_user_id,
            is_active = CASE
                          WHEN sic.max_uses IS NOT NULL AND sic.max_uses > 0
                               AND COALESCE(sic.current_uses, 0) + 1 >= sic.max_uses
                          THEN false
                          ELSE sic.is_active
                        END,
            updated_at = now()
        WHERE sic.id = v_invitation.id
          AND (sic.used_by IS NULL OR sic.used_by <> p_auth_user_id);

        RETURN p_auth_user_id;
      END;
      $body$;
    $fn$;
  END IF;

  IF to_regclass('public.invitations') IS NOT NULL
     AND to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.accept_invitation_code(invite_code text, user_id uuid)
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public'
      SET row_security = off
      AS $body$
      DECLARE
        invitation RECORD;
        v_actor_role text := auth.role();
        v_actor_id uuid := auth.uid();
      BEGIN
        -- Only allow linking the authenticated user, unless called by service role.
        IF v_actor_role <> 'service_role' AND (v_actor_id IS NULL OR v_actor_id <> user_id) THEN
          RETURN FALSE;
        END IF;

        -- Get invitation
        SELECT * INTO invitation
        FROM invitations i
        WHERE i.code = invite_code
          AND i.status = 'pending'
          AND (i.expires_at IS NULL OR i.expires_at > NOW())
          AND (i.max_uses = -1 OR i.uses_count < i.max_uses)
        FOR UPDATE;

        IF NOT FOUND THEN
          RETURN FALSE;
        END IF;

        -- Update invitation
        UPDATE invitations
        SET
          uses_count = uses_count + 1,
          accepted_by = user_id,
          accepted_at = NOW(),
          status = CASE
            WHEN max_uses = -1 THEN 'pending'  -- Unlimited use
            WHEN uses_count + 1 >= max_uses THEN 'accepted'  -- Max uses reached
            ELSE 'pending'
          END,
          updated_at = NOW()
        WHERE code = invite_code;

        -- Link user to organization
        UPDATE profiles
        SET
          organization_id = invitation.organization_id,
          preschool_id = invitation.organization_id,
          auth_user_id = COALESCE(auth_user_id, id),
          updated_at = NOW()
        WHERE id = user_id;

        RETURN TRUE;
      END;
      $body$;
    $fn$;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL
     AND to_regclass('public.students') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.handle_join_request_approval()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public'
      SET row_security = off
      AS $body$
      BEGIN
        -- Only process if status changed to approved
        IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
          -- Set review metadata
          NEW.reviewed_at := COALESCE(NEW.reviewed_at, NOW());
          NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());

          -- Handle based on request type
          CASE NEW.request_type
            WHEN 'teacher_invite' THEN
              UPDATE profiles
              SET
                organization_id = NEW.organization_id,
                preschool_id = COALESCE(NEW.preschool_id, NEW.organization_id),
                role = 'teacher',
                auth_user_id = COALESCE(auth_user_id, id),
                updated_at = NOW()
              WHERE id = NEW.requester_id;

            WHEN 'parent_join' THEN
              UPDATE profiles
              SET
                organization_id = NEW.organization_id,
                preschool_id = COALESCE(NEW.preschool_id, NEW.organization_id),
                auth_user_id = COALESCE(auth_user_id, id),
                updated_at = NOW()
              WHERE id = NEW.requester_id;

            WHEN 'member_join' THEN
              NULL;

            WHEN 'guardian_claim' THEN
              IF NEW.target_student_id IS NOT NULL THEN
                UPDATE students
                SET
                  parent_id = NEW.requester_id,
                  updated_at = NOW()
                WHERE id = NEW.target_student_id
                  AND parent_id IS NULL;
              END IF;

            WHEN 'staff_invite' THEN
              UPDATE profiles
              SET
                organization_id = NEW.organization_id,
                role = COALESCE(NEW.requested_role, 'admin'),
                auth_user_id = COALESCE(auth_user_id, id),
                updated_at = NOW()
              WHERE id = NEW.requester_id;

            WHEN 'learner_enroll' THEN
              NULL;
          END CASE;
        END IF;

        RETURN NEW;
      END;
      $body$;
    $fn$;
  END IF;
END $sql$;
