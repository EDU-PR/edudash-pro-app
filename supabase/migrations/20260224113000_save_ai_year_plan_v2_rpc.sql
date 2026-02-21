-- Year Planner V2 save RPC
-- Persists term + monthly matrix and optionally syncs published monthly entries to calendar/operations.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_ai_year_plan_v2(
  p_preschool_id uuid,
  p_created_by uuid,
  p_plan jsonb,
  p_sync_calendar boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_caller uuid;
  v_profile_id uuid;
  v_auth_result jsonb;
  v_academic_year integer;
  v_entry jsonb;
  v_month_index integer;
  v_bucket text;
  v_subtype text;
  v_title text;
  v_details text;
  v_start_date date;
  v_end_date date;
  v_metadata jsonb;
  v_is_published boolean;
  v_source text;
  v_saved_monthly integer := 0;
  v_synced_events integer := 0;
  v_synced_meetings integer := 0;
  v_synced_excursions integer := 0;
  v_sync_marker text;
  v_target_audience text[];
  v_event_type text;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_preschool_id IS NULL THEN
    RAISE EXCEPTION 'p_preschool_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_caller THEN
    RAISE EXCEPTION 'p_created_by must match auth.uid()' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_caller
      AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = p_preschool_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to save year plan for this preschool' USING ERRCODE = '42501';
  END IF;

  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'p_plan must be a JSON object' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    (SELECT p.id FROM public.profiles p WHERE p.id = v_caller LIMIT 1),
    (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = v_caller LIMIT 1),
    v_caller
  )
  INTO v_profile_id;

  v_academic_year := NULLIF((p_plan->>'academic_year')::int, 0);
  IF v_academic_year IS NULL THEN
    v_academic_year := EXTRACT(YEAR FROM NOW())::int;
  END IF;

  v_sync_marker := format('[YEAR_PLAN_V2:%s:%s]', p_preschool_id, v_academic_year);

  -- Save base term/theme plan using existing transactional function.
  v_auth_result := public.save_ai_year_plan(
    p_preschool_id,
    v_caller,
    p_plan
  );

  -- Replace previously generated AI monthly entries for this caller/year.
  DELETE FROM public.year_plan_monthly_entries y
  WHERE y.preschool_id = p_preschool_id
    AND y.academic_year = v_academic_year
    AND y.created_by = v_profile_id
    AND y.source IN ('ai', 'synced');

  IF jsonb_typeof(p_plan->'monthly_entries') = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_plan->'monthly_entries')
    LOOP
      v_month_index := NULLIF((v_entry->>'month_index')::int, 0);

      IF v_month_index IS NULL THEN
        CASE upper(trim(COALESCE(v_entry->>'month', '')))
          WHEN 'JAN', 'JANUARY' THEN v_month_index := 1;
          WHEN 'FEB', 'FEBRUARY' THEN v_month_index := 2;
          WHEN 'MAR', 'MARCH' THEN v_month_index := 3;
          WHEN 'APR', 'APRIL' THEN v_month_index := 4;
          WHEN 'MAY' THEN v_month_index := 5;
          WHEN 'JUN', 'JUNE' THEN v_month_index := 6;
          WHEN 'JUL', 'JULY' THEN v_month_index := 7;
          WHEN 'AUG', 'AUGUST' THEN v_month_index := 8;
          WHEN 'SEP', 'SEPT', 'SEPTEMBER' THEN v_month_index := 9;
          WHEN 'OCT', 'OCTOBER' THEN v_month_index := 10;
          WHEN 'NOV', 'NOVEMBER' THEN v_month_index := 11;
          WHEN 'DEC', 'DECEMBER' THEN v_month_index := 12;
          ELSE v_month_index := NULL;
        END CASE;
      END IF;

      IF v_month_index IS NULL OR v_month_index < 1 OR v_month_index > 12 THEN
        CONTINUE;
      END IF;

      v_bucket := lower(trim(COALESCE(v_entry->>'bucket', '')));
      IF v_bucket NOT IN ('holidays_closures', 'meetings_admin', 'excursions_extras', 'donations_fundraisers') THEN
        CONTINUE;
      END IF;

      v_subtype := NULLIF(trim(COALESCE(v_entry->>'subtype', '')), '');
      v_title := NULLIF(trim(COALESCE(v_entry->>'title', '')), '');
      IF v_title IS NULL THEN
        CONTINUE;
      END IF;

      v_details := NULLIF(trim(COALESCE(v_entry->>'details', v_entry->>'description', '')), '');
      v_start_date := NULLIF(v_entry->>'start_date', '')::date;
      v_end_date := NULLIF(v_entry->>'end_date', '')::date;
      v_metadata := COALESCE(v_entry->'metadata', '{}'::jsonb);
      v_is_published := COALESCE((v_entry->>'is_published')::boolean, false);
      v_source := COALESCE(NULLIF(v_entry->>'source', ''), 'ai');
      IF v_source NOT IN ('ai', 'manual', 'synced') THEN
        v_source := 'ai';
      END IF;

      INSERT INTO public.year_plan_monthly_entries (
        preschool_id,
        created_by,
        academic_year,
        month_index,
        bucket,
        subtype,
        title,
        details,
        start_date,
        end_date,
        metadata,
        source,
        is_published,
        published_to_calendar
      ) VALUES (
        p_preschool_id,
        v_profile_id,
        v_academic_year,
        v_month_index,
        v_bucket,
        v_subtype,
        v_title,
        v_details,
        v_start_date,
        v_end_date,
        v_metadata,
        v_source,
        v_is_published,
        false
      );

      v_saved_monthly := v_saved_monthly + 1;
    END LOOP;
  END IF;

  IF p_sync_calendar THEN
    -- Remove previously synced records for this generated year (caller scoped).
    DELETE FROM public.school_events
    WHERE preschool_id = p_preschool_id
      AND created_by = v_caller
      AND notes ILIKE '%' || v_sync_marker || '%';

    DELETE FROM public.school_meetings
    WHERE preschool_id = p_preschool_id
      AND created_by = v_profile_id
      AND description ILIKE '%' || v_sync_marker || '%';

    DELETE FROM public.school_excursions
    WHERE preschool_id = p_preschool_id
      AND created_by = v_profile_id
      AND notes ILIKE '%' || v_sync_marker || '%';

    FOR v_entry IN
      SELECT to_jsonb(y.*)
      FROM public.year_plan_monthly_entries y
      WHERE y.preschool_id = p_preschool_id
        AND y.academic_year = v_academic_year
        AND y.created_by = v_profile_id
        AND y.is_published = true
    LOOP
      v_bucket := v_entry->>'bucket';
      v_subtype := v_entry->>'subtype';
      v_title := v_entry->>'title';
      v_details := COALESCE(v_entry->>'details', '');
      v_start_date := NULLIF(v_entry->>'start_date', '')::date;
      v_end_date := NULLIF(v_entry->>'end_date', '')::date;

      IF v_start_date IS NULL THEN
        v_start_date := make_date(v_academic_year, (v_entry->>'month_index')::int, 1);
      END IF;
      IF v_end_date IS NULL THEN
        v_end_date := v_start_date;
      END IF;

      IF v_bucket = 'meetings_admin' THEN
        INSERT INTO public.school_meetings (
          preschool_id,
          created_by,
          title,
          description,
          meeting_type,
          meeting_date,
          start_time,
          end_time,
          status
        ) VALUES (
          p_preschool_id,
          v_profile_id,
          v_title,
          CONCAT(v_details, ' ', v_sync_marker),
          CASE
            WHEN lower(COALESCE(v_subtype, '')) IN ('staff', 'staff_meeting') THEN 'staff'
            WHEN lower(COALESCE(v_subtype, '')) IN ('parent', 'parent_meeting') THEN 'parent'
            WHEN lower(COALESCE(v_subtype, '')) IN ('training', 'staff_training') THEN 'training'
            WHEN lower(COALESCE(v_subtype, '')) IN ('curriculum', 'admin') THEN 'curriculum'
            ELSE 'other'
          END,
          v_start_date,
          '09:00',
          '10:00',
          'scheduled'
        );
        v_synced_meetings := v_synced_meetings + 1;

      ELSIF v_bucket = 'excursions_extras' THEN
        INSERT INTO public.school_excursions (
          preschool_id,
          created_by,
          title,
          description,
          destination,
          excursion_date,
          status,
          notes
        ) VALUES (
          p_preschool_id,
          v_profile_id,
          v_title,
          v_details,
          COALESCE(NULLIF(v_subtype, ''), 'TBD destination'),
          v_start_date,
          'draft',
          v_sync_marker
        );
        v_synced_excursions := v_synced_excursions + 1;

      ELSE
        v_target_audience := ARRAY['all'];

        v_event_type := CASE
          WHEN v_bucket = 'holidays_closures' THEN 'holiday'
          WHEN v_bucket = 'donations_fundraisers' AND lower(COALESCE(v_subtype, '')) LIKE '%donat%' THEN 'donation_drive'
          WHEN v_bucket = 'donations_fundraisers' THEN 'fundraiser'
          WHEN lower(COALESCE(v_subtype, '')) = 'staff_meeting' THEN 'staff_meeting'
          ELSE 'other'
        END;

        INSERT INTO public.school_events (
          preschool_id,
          created_by,
          title,
          description,
          event_type,
          start_date,
          end_date,
          all_day,
          target_audience,
          send_notifications,
          status,
          notes
        ) VALUES (
          p_preschool_id,
          v_caller,
          v_title,
          CONCAT(v_details, ' ', v_sync_marker),
          v_event_type,
          v_start_date,
          v_end_date,
          true,
          v_target_audience,
          true,
          'scheduled',
          v_sync_marker
        );
        v_synced_events := v_synced_events + 1;
      END IF;

      UPDATE public.year_plan_monthly_entries
      SET published_to_calendar = true,
          source = CASE WHEN source = 'manual' THEN source ELSE 'synced' END,
          updated_at = NOW()
      WHERE id = (v_entry->>'id')::uuid;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'academic_year', v_academic_year,
    'base', v_auth_result,
    'monthly_entries_saved', v_saved_monthly,
    'synced_events', v_synced_events,
    'synced_meetings', v_synced_meetings,
    'synced_excursions', v_synced_excursions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_ai_year_plan_v2(uuid, uuid, jsonb, boolean) TO authenticated;

COMMIT;
