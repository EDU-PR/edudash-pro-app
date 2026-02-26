-- School Calendar RPC for parents and teachers (SECURITY DEFINER)
BEGIN;

CREATE OR REPLACE FUNCTION public.get_school_calendar_for_parent()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public
AS $$
DECLARE
  v_caller uuid;
  v_profile_id uuid;
  v_preschool_ids uuid[];
  v_events jsonb;
  v_meetings jsonb;
  v_excursions jsonb;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT COALESCE((SELECT p.id FROM public.profiles p WHERE p.id = v_caller),
    (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = v_caller), v_caller) INTO v_profile_id;
  SELECT ARRAY_AGG(DISTINCT pid) INTO v_preschool_ids FROM (
    SELECT COALESCE(p.preschool_id, p.organization_id) AS pid FROM public.profiles p
    WHERE p.id = v_profile_id AND COALESCE(p.preschool_id, p.organization_id) IS NOT NULL
    UNION
    SELECT s.preschool_id FROM public.students s WHERE (s.parent_id = v_profile_id OR s.guardian_id = v_profile_id) AND s.preschool_id IS NOT NULL
    UNION
    SELECT s.preschool_id FROM public.student_parent_relationships spr JOIN public.students s ON s.id = spr.student_id
    WHERE spr.parent_id = v_profile_id AND s.preschool_id IS NOT NULL
  ) sub WHERE pid IS NOT NULL;
  IF v_preschool_ids IS NULL OR array_length(v_preschool_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('events','[]'::jsonb,'meetings','[]'::jsonb,'excursions','[]'::jsonb);
  END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO v_events
  FROM (SELECT id,title,start_date,end_date,event_type,description FROM school_events
    WHERE preschool_id = ANY(v_preschool_ids) AND status='scheduled'
    AND (target_audience IS NULL OR target_audience='{}' OR target_audience && ARRAY['all','parents','parent']::text[])
    ORDER BY start_date ASC LIMIT 100) t;
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO v_meetings
  FROM (SELECT id,title,meeting_type,meeting_date,start_time,end_time,location FROM public.school_meetings
    WHERE preschool_id = ANY(v_preschool_ids) AND status IN ('scheduled','draft') AND meeting_type='parent'
    ORDER BY meeting_date ASC LIMIT 50) t;
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO v_excursions
  FROM (SELECT id,title,destination,excursion_date,status FROM public.school_excursions
    WHERE preschool_id = ANY(v_preschool_ids) AND status IN ('approved','pending_approval')
    ORDER BY excursion_date ASC LIMIT 50) t;
  RETURN jsonb_build_object('events',COALESCE(v_events,'[]'::jsonb),'meetings',COALESCE(v_meetings,'[]'::jsonb),'excursions',COALESCE(v_excursions,'[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_school_calendar_for_teacher()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public
AS $$
DECLARE
  v_caller uuid;
  v_profile_id uuid;
  v_preschool_id uuid;
  v_events jsonb;
  v_meetings jsonb;
  v_excursions jsonb;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT COALESCE((SELECT p.id FROM public.profiles p WHERE p.id = v_caller),
    (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = v_caller), v_caller) INTO v_profile_id;
  SELECT COALESCE(p.preschool_id, p.organization_id) INTO v_preschool_id FROM public.profiles p
  WHERE p.id = v_profile_id AND p.role IN ('teacher','principal','principal_admin','admin','super_admin');
  IF v_preschool_id IS NULL THEN
    RETURN jsonb_build_object('events','[]'::jsonb,'meetings','[]'::jsonb,'excursions','[]'::jsonb);
  END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO v_events
  FROM (SELECT id,title,start_date,end_date,event_type,description FROM school_events
    WHERE preschool_id = v_preschool_id AND status='scheduled' ORDER BY start_date ASC LIMIT 100) t;
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO v_meetings
  FROM (SELECT id,title,meeting_type,meeting_date,start_time,end_time,location FROM public.school_meetings
    WHERE preschool_id = v_preschool_id AND status IN ('scheduled','draft') ORDER BY meeting_date ASC LIMIT 50) t;
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO v_excursions
  FROM (SELECT id,title,destination,excursion_date,status FROM public.school_excursions
    WHERE preschool_id = v_preschool_id AND status IN ('approved','pending_approval','draft')
    ORDER BY excursion_date ASC LIMIT 50) t;
  RETURN jsonb_build_object('events',COALESCE(v_events,'[]'::jsonb),'meetings',COALESCE(v_meetings,'[]'::jsonb),'excursions',COALESCE(v_excursions,'[]'::jsonb));
END;
$$;

COMMIT;
