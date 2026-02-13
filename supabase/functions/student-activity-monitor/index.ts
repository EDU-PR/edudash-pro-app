import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

type AttendanceStatus = 'present' | 'late' | 'absent';

type Policy = {
  enabled: boolean;
  trigger_absent_days: number;
  grace_days: number;
  require_principal_approval: boolean;
  billing_behavior: 'stop_new_fees_keep_debt' | string;
  auto_unassign_class_on_inactive: boolean;
  notify_channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
};

type ActiveStudent = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  class_id: string | null;
  preschool_id: string | null;
  organization_id: string | null;
};

type AttendanceRow = {
  student_id: string;
  attendance_date: string;
  status: AttendanceStatus;
};

type InactivityCase = {
  id: string;
  student_id: string;
  case_state: 'at_risk' | 'resolved' | 'inactive' | 'dismissed';
  warning_deadline_at: string | null;
  warning_sent_at: string | null;
  trigger_absence_days: number;
  trigger_absence_streak: number;
  last_absent_date: string | null;
  last_present_date: string | null;
  closed_at: string | null;
};

type SchoolRunStats = {
  school_id: string;
  school_name: string;
  policy_enabled: boolean;
  students_evaluated: number;
  warnings_created: number;
  warnings_resolved: number;
  auto_inactivated: number;
  approval_required_pending: number;
  errors: string[];
};

function parsePolicy(raw: unknown): Policy {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const notify = (obj.notify_channels && typeof obj.notify_channels === 'object'
    ? obj.notify_channels
    : {}) as Record<string, unknown>;

  const triggerAbsentDays = Number(obj.trigger_absent_days);
  const graceDays = Number(obj.grace_days);

  return {
    enabled: obj.enabled !== false,
    trigger_absent_days: Number.isFinite(triggerAbsentDays) && triggerAbsentDays > 0 ? triggerAbsentDays : 5,
    grace_days: Number.isFinite(graceDays) && graceDays > 0 ? graceDays : 7,
    require_principal_approval: obj.require_principal_approval === true,
    billing_behavior: typeof obj.billing_behavior === 'string' ? obj.billing_behavior : 'stop_new_fees_keep_debt',
    auto_unassign_class_on_inactive: obj.auto_unassign_class_on_inactive !== false,
    notify_channels: {
      push: notify.push !== false,
      email: notify.email === true,
      sms: notify.sms === true,
      whatsapp: notify.whatsapp === true,
    },
  };
}

function toDateOnlyIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function fullName(student: ActiveStudent): string {
  return [student.first_name, student.last_name].filter(Boolean).join(' ').trim() || 'Learner';
}

function computeLatestAbsentStreak(rows: AttendanceRow[]): {
  streak: number;
  streakStartOn: string | null;
  lastAbsentOn: string | null;
  lastPresentOn: string | null;
} {
  if (!rows.length) {
    return { streak: 0, streakStartOn: null, lastAbsentOn: null, lastPresentOn: null };
  }

  const sorted = [...rows].sort((a, b) => {
    const da = new Date(a.attendance_date).getTime();
    const db = new Date(b.attendance_date).getTime();
    return db - da;
  });

  let streak = 0;
  let streakStartOn: string | null = null;
  let lastAbsentOn: string | null = null;
  let lastPresentOn: string | null = null;

  for (const row of sorted) {
    if (row.status === 'absent') {
      streak += 1;
      if (!lastAbsentOn) lastAbsentOn = toDateOnlyIso(row.attendance_date);
      streakStartOn = toDateOnlyIso(row.attendance_date);
      continue;
    }

    // first non-absent breaks the active streak
    lastPresentOn = toDateOnlyIso(row.attendance_date);
    break;
  }

  return { streak, streakStartOn, lastAbsentOn, lastPresentOn };
}

async function dispatchLifecycleNotification(
  supabaseAdmin: ReturnType<typeof createClient>,
  eventType: 'student_inactivity_warning' | 'student_inactivity_resolved' | 'student_inactivity_marked_inactive',
  schoolId: string,
  student: ActiveStudent,
  extraContext: Record<string, unknown> = {},
): Promise<void> {
  const body = {
    event_type: eventType,
    preschool_id: schoolId,
    student_id: student.id,
    context: {
      student_name: fullName(student),
      ...extraContext,
    },
    send_immediately: true,
  };

  const { error } = await supabaseAdmin.functions.invoke('notifications-dispatcher', { body });
  if (error) {
    throw new Error(`notifications-dispatcher failed (${eventType}): ${error.message}`);
  }
}

async function createWarningCase(
  supabaseAdmin: ReturnType<typeof createClient>,
  schoolId: string,
  policy: Policy,
  student: ActiveStudent,
  streak: ReturnType<typeof computeLatestAbsentStreak>,
): Promise<void> {
  const now = new Date();
  const deadline = new Date(now.getTime() + policy.grace_days * 24 * 60 * 60 * 1000);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('student_inactivity_cases')
    .insert({
      preschool_id: schoolId,
      student_id: student.id,
      case_state: 'at_risk',
      trigger_absence_days: policy.trigger_absent_days,
      trigger_absence_streak: streak.streak,
      streak_started_on: streak.streakStartOn,
      last_absent_date: streak.lastAbsentOn,
      last_present_date: streak.lastPresentOn,
      warning_sent_at: now.toISOString(),
      warning_deadline_at: deadline.toISOString(),
      metadata: {
        source: 'student-activity-monitor',
        policy_snapshot: policy,
      },
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`case insert failed for ${student.id}: ${insertError.message}`);
  }

  await supabaseAdmin.rpc('log_student_inactivity_case_event', {
    p_case_id: inserted.id,
    p_event_type: 'case_created',
    p_actor_type: 'system',
    p_payload: {
      trigger_absence_streak: streak.streak,
      trigger_absence_days: policy.trigger_absent_days,
      warning_deadline_at: deadline.toISOString(),
    },
  });

  await supabaseAdmin.rpc('log_student_inactivity_case_event', {
    p_case_id: inserted.id,
    p_event_type: 'warning_sent',
    p_actor_type: 'system',
    p_payload: {
      notify_channels: policy.notify_channels,
    },
  });

  await dispatchLifecycleNotification(
    supabaseAdmin,
    'student_inactivity_warning',
    schoolId,
    student,
    {
      absence_streak: streak.streak,
      trigger_absence_days: policy.trigger_absent_days,
      grace_days: policy.grace_days,
      warning_deadline_at: deadline.toISOString(),
      warning_deadline_date: deadline.toISOString().slice(0, 10),
    },
  );
}

async function resolveCaseAsRecovered(
  supabaseAdmin: ReturnType<typeof createClient>,
  schoolId: string,
  student: ActiveStudent,
  openCase: InactivityCase,
  streak: ReturnType<typeof computeLatestAbsentStreak>,
): Promise<void> {
  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('student_inactivity_cases')
    .update({
      case_state: 'resolved',
      trigger_absence_streak: streak.streak,
      last_present_date: streak.lastPresentOn,
      resolved_at: now,
      closed_at: now,
      closed_reason: 'attendance_recovered',
    })
    .eq('id', openCase.id);

  if (updateError) {
    throw new Error(`failed to resolve case ${openCase.id}: ${updateError.message}`);
  }

  await supabaseAdmin.rpc('log_student_inactivity_case_event', {
    p_case_id: openCase.id,
    p_event_type: 'case_resolved',
    p_actor_type: 'system',
    p_payload: {
      resolution_reason: 'attendance_recovered',
      last_present_date: streak.lastPresentOn,
    },
  });

  await dispatchLifecycleNotification(
    supabaseAdmin,
    'student_inactivity_resolved',
    schoolId,
    student,
    {
      resolution_reason: 'attendance_recovered',
      last_present_date: streak.lastPresentOn,
    },
  );
}

async function autoInactivateCase(
  supabaseAdmin: ReturnType<typeof createClient>,
  schoolId: string,
  student: ActiveStudent,
  openCase: InactivityCase,
  streak: ReturnType<typeof computeLatestAbsentStreak>,
): Promise<void> {
  const now = new Date().toISOString();

  const { error: deactivateError } = await supabaseAdmin.rpc('deactivate_student', {
    student_uuid: student.id,
    reason: 'attendance_lifecycle_auto_inactive',
  });

  if (deactivateError) {
    throw new Error(`deactivate_student failed for ${student.id}: ${deactivateError.message}`);
  }

  const { error: caseUpdateError } = await supabaseAdmin
    .from('student_inactivity_cases')
    .update({
      case_state: 'inactive',
      trigger_absence_streak: streak.streak,
      last_absent_date: streak.lastAbsentOn,
      auto_inactivated_at: now,
      closed_at: now,
      closed_reason: 'grace_expired_auto_inactive',
    })
    .eq('id', openCase.id);

  if (caseUpdateError) {
    throw new Error(`failed to close inactive case ${openCase.id}: ${caseUpdateError.message}`);
  }

  await supabaseAdmin.rpc('log_student_inactivity_case_event', {
    p_case_id: openCase.id,
    p_event_type: 'auto_inactivated',
    p_actor_type: 'system',
    p_payload: {
      auto_reason: 'grace_expired_auto_inactive',
      trigger_absence_streak: streak.streak,
    },
  });

  await dispatchLifecycleNotification(
    supabaseAdmin,
    'student_inactivity_marked_inactive',
    schoolId,
    student,
    {
      trigger_absence_streak: streak.streak,
      inactive_on: now,
    },
  );
}

async function processSchool(
  supabaseAdmin: ReturnType<typeof createClient>,
  schoolId: string,
  schoolName: string,
): Promise<SchoolRunStats> {
  const stats: SchoolRunStats = {
    school_id: schoolId,
    school_name: schoolName,
    policy_enabled: false,
    students_evaluated: 0,
    warnings_created: 0,
    warnings_resolved: 0,
    auto_inactivated: 0,
    approval_required_pending: 0,
    errors: [],
  };

  try {
    const { data: policyData, error: policyError } = await supabaseAdmin.rpc(
      'get_attendance_lifecycle_policy',
      { p_preschool_id: schoolId },
    );

    if (policyError) {
      throw new Error(`policy fetch failed: ${policyError.message}`);
    }

    const policy = parsePolicy(policyData);
    stats.policy_enabled = policy.enabled;

    if (!policy.enabled) {
      return stats;
    }

    const { data: students, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, class_id, preschool_id, organization_id')
      .or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`)
      .eq('status', 'active')
      .eq('is_active', true);

    if (studentError) {
      throw new Error(`student fetch failed: ${studentError.message}`);
    }

    const activeStudents = (students || []) as ActiveStudent[];
    if (!activeStudents.length) {
      return stats;
    }

    const studentIds = activeStudents.map((student) => student.id);

    const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .select('student_id, attendance_date, status')
      .in('student_id', studentIds)
      .in('status', ['present', 'late', 'absent'])
      .gte('attendance_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

    if (attendanceError) {
      throw new Error(`attendance fetch failed: ${attendanceError.message}`);
    }

    const attendanceByStudent = new Map<string, AttendanceRow[]>();
    for (const row of ((attendanceRows || []) as AttendanceRow[])) {
      if (!attendanceByStudent.has(row.student_id)) {
        attendanceByStudent.set(row.student_id, []);
      }
      attendanceByStudent.get(row.student_id)!.push(row);
    }

    const { data: openCasesData, error: openCasesError } = await supabaseAdmin
      .from('student_inactivity_cases')
      .select('id, student_id, case_state, warning_deadline_at, warning_sent_at, trigger_absence_days, trigger_absence_streak, last_absent_date, last_present_date, closed_at')
      .eq('preschool_id', schoolId)
      .eq('case_state', 'at_risk')
      .is('closed_at', null);

    if (openCasesError) {
      throw new Error(`open case fetch failed: ${openCasesError.message}`);
    }

    const openCases = (openCasesData || []) as InactivityCase[];
    const openCaseByStudent = new Map(openCases.map((item) => [item.student_id, item]));

    for (const student of activeStudents) {
      stats.students_evaluated += 1;
      const rows = attendanceByStudent.get(student.id) || [];
      const streak = computeLatestAbsentStreak(rows);
      const openCase = openCaseByStudent.get(student.id);

      try {
        if (streak.streak >= policy.trigger_absent_days && !openCase) {
          await createWarningCase(supabaseAdmin, schoolId, policy, student, streak);
          stats.warnings_created += 1;
          continue;
        }

        if (!openCase) {
          continue;
        }

        if (streak.streak === 0) {
          await resolveCaseAsRecovered(supabaseAdmin, schoolId, student, openCase, streak);
          stats.warnings_resolved += 1;
          continue;
        }

        const { error: streakUpdateError } = await supabaseAdmin
          .from('student_inactivity_cases')
          .update({
            trigger_absence_streak: streak.streak,
            streak_started_on: streak.streakStartOn,
            last_absent_date: streak.lastAbsentOn,
            last_present_date: streak.lastPresentOn,
          })
          .eq('id', openCase.id);

        if (streakUpdateError) {
          throw new Error(`streak update failed for case ${openCase.id}: ${streakUpdateError.message}`);
        }

        const deadline = openCase.warning_deadline_at ? new Date(openCase.warning_deadline_at) : null;
        const deadlineExpired = deadline ? deadline.getTime() <= Date.now() : false;

        if (deadlineExpired) {
          if (policy.require_principal_approval) {
            stats.approval_required_pending += 1;
          } else {
            await autoInactivateCase(supabaseAdmin, schoolId, student, openCase, streak);
            stats.auto_inactivated += 1;
          }
        }
      } catch (studentError) {
        stats.errors.push(
          `student ${student.id} (${fullName(student)}): ${
            studentError instanceof Error ? studentError.message : String(studentError)
          }`,
        );
      }
    }
  } catch (error) {
    stats.errors.push(error instanceof Error ? error.message : String(error));
  }

  return stats;
}

async function authorizeRequest(req: Request, supabaseAdmin: ReturnType<typeof createClient>): Promise<{
  authorized: boolean;
  reason?: string;
  allowSchoolScope?: string | null;
}> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return { authorized: false, reason: 'Missing Authorization header' };
  }

  if (token === SUPABASE_SERVICE_ROLE_KEY || (CRON_SECRET && token === CRON_SECRET)) {
    return { authorized: true, allowSchoolScope: null };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { authorized: false, reason: 'Invalid bearer token' };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, preschool_id, organization_id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { authorized: false, reason: 'Profile not found' };
  }

  const role = String(profile.role || '').toLowerCase();
  if (!['principal', 'principal_admin', 'admin', 'super_admin'].includes(role)) {
    return { authorized: false, reason: 'Role not allowed' };
  }

  const schoolScope = (profile.organization_id || profile.preschool_id || null) as string | null;
  return { authorized: true, allowSchoolScope: schoolScope };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Function misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const auth = await authorizeRequest(req, supabaseAdmin);

    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.reason || 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const requestedSchoolId = typeof payload.preschool_id === 'string' ? payload.preschool_id : null;

    if (auth.allowSchoolScope && requestedSchoolId && requestedSchoolId !== auth.allowSchoolScope) {
      return new Response(JSON.stringify({ error: 'Cannot run monitor outside your school scope' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const schoolFilter = requestedSchoolId || auth.allowSchoolScope || null;

    const schoolsQuery = supabaseAdmin
      .from('preschools')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('name');

    const { data: schools, error: schoolsError } = schoolFilter
      ? await schoolsQuery.eq('id', schoolFilter)
      : await schoolsQuery;

    if (schoolsError) {
      throw new Error(`school query failed: ${schoolsError.message}`);
    }

    const schoolRows = (schools || []) as Array<{ id: string; name: string | null; is_active: boolean }>;

    const stats = {
      schools_processed: 0,
      students_evaluated: 0,
      warnings_created: 0,
      warnings_resolved: 0,
      auto_inactivated: 0,
      approval_required_pending: 0,
      school_results: [] as SchoolRunStats[],
      total_errors: 0,
      started_at: new Date().toISOString(),
      completed_at: '',
    };

    for (const school of schoolRows) {
      const schoolResult = await processSchool(supabaseAdmin, school.id, school.name || 'School');
      stats.school_results.push(schoolResult);
      stats.schools_processed += 1;
      stats.students_evaluated += schoolResult.students_evaluated;
      stats.warnings_created += schoolResult.warnings_created;
      stats.warnings_resolved += schoolResult.warnings_resolved;
      stats.auto_inactivated += schoolResult.auto_inactivated;
      stats.approval_required_pending += schoolResult.approval_required_pending;
      stats.total_errors += schoolResult.errors.length;
    }

    stats.completed_at = new Date().toISOString();

    return new Response(JSON.stringify({ success: true, ...stats }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
