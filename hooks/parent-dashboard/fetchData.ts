/** Standalone data-fetching function for the parent dashboard */
import { assertSupabase } from '@/lib/supabase';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { log, logError } from '@/lib/debug';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';
import type { ParentDashboardData } from '@/types/dashboard';
import { formatDueDate, formatEventTime, createEmptyParentData } from '@/lib/dashboard/utils';

export interface FetchResult {
  data: ParentDashboardData;
  fromCache: boolean;
}

export async function fetchParentDashboardData(
  userId: string,
  authLoading: boolean,
  forceRefresh = false,
): Promise<FetchResult | null> {
  if (authLoading) {
    log('🔄 Waiting for auth to complete...');
    return null;
  }
  // Cache check
  if (!forceRefresh) {
    const cached = await offlineCacheService.getParentDashboard(userId);
    if (cached) {
      log('📱 Loading parent data from cache...');
      return { data: cached, fromCache: true };
    }
  }
  const supabase = assertSupabase();
  const { data: authCheck } = await supabase.auth.getUser();
  if (!authCheck.user) throw new Error('Authentication session invalid');

  // Fetch parent profile (dual lookup)
  let parentUser = await fetchParentProfile(supabase, userId);
  if (!parentUser) return { data: createEmptyParentData(), fromCache: false };

  const schoolId = (parentUser as any).preschool_id || (parentUser as any).organization_id;
  const schoolName = await resolveSchoolName(supabase, schoolId);


  // Fetch children ----------------------------------------------------------------
  const parentIds = new Set<string>([parentUser.id, userId].filter(Boolean));
  const parentFilters = Array.from(parentIds).flatMap(id => [`parent_id.eq.${id}`, `guardian_id.eq.${id}`]);

  const { data: childrenData } = await supabase
    .from('students')
    .select('id, first_name, last_name, student_id, preschool_id, date_of_birth, grade_level, avatar_url, classes!students_class_id_fkey(id, name, teacher_id)')
    .or(parentFilters.join(','));

  const teacherMap = await buildTeacherMap(supabase, childrenData || []);
  const children = (childrenData || []).map((c: any) => mapChild(c, schoolId, teacherMap));
  const childIds = children.map(c => c.id);

  // Parallel fetches ---------------------------------------------------------------
  const today = new Date().toISOString().split('T')[0];
  const [feesDueSoon, todayAttendance, assignmentsData, eventsData] = await Promise.all([
    fetchFeesDueSoon(supabase, childIds, today),
    fetchTodayAttendance(supabase, childIds, today),
    fetchAssignments(supabase),
    fetchEvents(supabase, schoolId),
  ]);

  // Process results ----------------------------------------------------------------
  const totalChildren = children.length;
  const presentToday = todayAttendance.filter(a => a.status === 'present').length;
  const attendanceRate = totalChildren > 0 ? Math.round((presentToday / totalChildren) * 100) : 0;

  const feesDue = buildFeesDueSoon(feesDueSoon, children, today);
  const recentHomework = buildRecentHomework(assignmentsData, childIds, children);
  const upcomingEvents = buildUpcomingEvents(eventsData);

  const dashboardData: ParentDashboardData = {
    schoolName, totalChildren, feesDueSoon: feesDue,
    children, attendanceRate, presentToday,
    recentHomework, upcomingEvents, unreadMessages: 0,
  };

  if (schoolId) {
    await offlineCacheService.cacheParentDashboard(userId, dashboardData);
    log('💾 Parent dashboard data cached for offline use');
  }
  return { data: dashboardData, fromCache: false };
}

// ── helpers ──────────────────────────────────────────────────────────────────────

async function fetchParentProfile(supabase: any, userId: string) {
  const fields = 'id, preschool_id, first_name, last_name, role, organization_id';
  let { data, error } = await supabase.from('profiles').select(fields).eq('auth_user_id', userId).maybeSingle();
  if (error) logError('Parent user fetch error:', error);
  if (!data) {
    const r = await supabase.from('profiles').select(fields).eq('id', userId).maybeSingle();
    if (r.error) logError('Parent user fetch (id) error:', r.error);
    data = r.data;
  }
  return data;
}

async function resolveSchoolName(supabase: any, schoolId: string | null) {
  if (!schoolId) return 'Unknown School';
  const { data: school } = await supabase.from('preschools').select('name').eq('id', schoolId).maybeSingle();
  if (school?.name) return school.name;
  const { data: org } = await supabase.from('organizations').select('name').eq('id', schoolId).maybeSingle();
  return org?.name || 'Unknown School';
}

async function buildTeacherMap(supabase: any, childrenData: any[]) {
  const teacherIds = childrenData.map((c: any) => c.classes?.teacher_id).filter(Boolean);
  if (!teacherIds.length) return {} as Record<string, string>;
  const { data } = await supabase.from('profiles').select('id, first_name, last_name').in('id', teacherIds);
  const map: Record<string, string> = {};
  (data || []).forEach((t: any) => { map[t.id] = `${t.first_name || ''} ${t.last_name || ''}`.trim(); });
  return map;
}

function mapChild(c: any, fallbackSchoolId: string | null, teacherMap: Record<string, string>) {
  return {
    id: c.id, firstName: c.first_name, lastName: c.last_name,
    studentCode: c.student_id ?? null, preschoolId: c.preschool_id ?? fallbackSchoolId,
    avatarUrl: sanitizeAvatarUrl(c.avatar_url ?? null), dateOfBirth: c.date_of_birth ?? null,
    grade: c.grade_level || 'Grade R', className: c.classes?.name || 'No Class',
    classId: c.classes?.id || null,
    teacher: c.classes?.teacher_id ? (teacherMap[c.classes.teacher_id] || 'No Teacher Assigned') : 'No Teacher Assigned',
  };
}

async function fetchFeesDueSoon(supabase: any, childIds: string[], today: string) {
  if (!childIds.length) return [];
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setDate(end.getDate() + 3);
  const { data } = await supabase.from('student_fees')
    .select('student_id, due_date, amount, final_amount, status')
    .in('student_id', childIds).in('status', ['pending', 'overdue', 'partially_paid'])
    .gte('due_date', today).lte('due_date', end.toISOString().split('T')[0])
    .order('due_date', { ascending: true }).limit(1);
  return data || [];
}

async function fetchTodayAttendance(supabase: any, childIds: string[], today: string) {
  if (!childIds.length) return [];
  const { data } = await supabase.from('attendance').select('student_id, status').in('student_id', childIds).eq('attendance_date', today);
  return data || [];
}

async function fetchAssignments(supabase: any) {
  const { data } = await supabase.from('homework_assignments')
    .select('id, title, due_date, homework_submissions!homework_submissions_assignment_id_fkey(id, status, student_id)')
    .eq('is_published', true).order('due_date', { ascending: false }).limit(10);
  return data || [];
}

async function fetchEvents(supabase: any, schoolId: string | null) {
  if (!schoolId) return [];
  const { data } = await supabase.from('events').select('id, title, event_date, event_type, description')
    .eq('preschool_id', schoolId).gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true }).limit(5);
  return data || [];
}

function buildFeesDueSoon(fees: any[], children: any[], today: string): ParentDashboardData['feesDueSoon'] {
  const dueFee = fees[0];
  if (!dueFee?.due_date) return null;
  const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
  const dueDate = new Date(dueFee.due_date);
  const daysUntil = Math.ceil((dueDate.getTime() - todayD.getTime()) / (1000 * 60 * 60 * 24));
  const child = children.find(c => c.id === dueFee.student_id);
  return {
    amount: Number(dueFee.final_amount ?? dueFee.amount ?? 0),
    dueDate: dueFee.due_date,
    daysUntil: Number.isNaN(daysUntil) ? 0 : daysUntil,
    childName: child ? `${child.firstName} ${child.lastName}`.trim() : null,
  };
}

function buildRecentHomework(assignments: any[], childIds: string[], children: any[]) {
  return assignments.map((a: any) => {
    const subs = a.homework_submissions || [];
    const sub = subs.find((s: any) => childIds.includes(s.student_id));
    if (!sub) return null;
    return {
      id: a.id, title: a.title, dueDate: formatDueDate(a.due_date),
      status: (sub.status || 'not_submitted') as 'submitted' | 'graded' | 'not_submitted',
      studentName: children.find(c => c.id === sub.student_id)?.firstName || 'Unknown',
    };
  }).filter(Boolean).slice(0, 5);
}

function buildUpcomingEvents(events: any[]) {
  return events.map((e: any) => ({
    id: e.id, title: e.title, time: formatEventTime(new Date(e.event_date)),
    type: (e.event_type || 'event') as 'meeting' | 'activity' | 'assessment',
  }));
}
