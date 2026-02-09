/** Fetch children, build child cards, load registration fees & AI usage */
import { assertSupabase } from '@/lib/supabase';
import { fetchParentChildren } from '@/lib/parent-children';
import { logger } from '@/lib/logger';
import type { ChildCard, UrgentMetrics, UsageStats } from './types';
import { EMPTY_URGENT } from './types';
import { fetchUrgentMetrics } from './fetchUrgentMetrics';
export interface DashboardDataResult {
  children: any[];
  cards: ChildCard[];
  urgentMetrics: UrgentMetrics | null;
  usage: UsageStats;
}
export async function fetchDashboardChildren(
  userId: string,
  profileId: string | null,
  schoolId: string | null,
  activeChildId: string | null,
  t: (key: string, opts?: any) => string,
): Promise<DashboardDataResult> {
  const client = assertSupabase();
  let studentsData: any[] = [];
  let internalUserId: string | null = null;
  let mySchoolId = schoolId;
  try {
    const { data: me } = await client
      .from('profiles').select('id, preschool_id, organization_id')
      .eq('auth_user_id', userId).single();
    internalUserId = me?.id ?? null;
    mySchoolId = me?.preschool_id || me?.organization_id || schoolId;
    if (internalUserId) {
      studentsData = await fetchParentChildren(internalUserId, {
        includeInactive: false, schoolId: mySchoolId || undefined,
      });
    }
  } catch (error) {
    logger.error('Error loading children:', error);
  }
  const realChildren = studentsData || [];
  const nowIso = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  async function buildCard(child: any): Promise<ChildCard> {
    let lastActivity = new Date();
    let status: 'active' | 'absent' | 'late' = 'active';
    let progressScore = 75;
    let homeworkPending = 0;
    let upcomingEvents = 0;
    try {
      const { data: latestAtt } = await client
        .from('attendance').select('status, attendance_date, created_at')
        .eq('student_id', child.id).order('attendance_date', { ascending: false }).limit(1);
      if (latestAtt?.[0]) {
        lastActivity = new Date(latestAtt[0].created_at || latestAtt[0].attendance_date);
        const st = String(latestAtt[0].status || '').toLowerCase();
        status = st === 'late' ? 'late' : st === 'absent' ? 'absent' : 'active';
      }
      const { data: windowAtt } = await client
        .from('attendance').select('status')
        .eq('student_id', child.id).gte('attendance_date', thirtyDaysAgo).limit(1000);
      if (windowAtt && windowAtt.length > 0) {
        const present = windowAtt.filter((a: any) => String(a.status).toLowerCase() === 'present').length;
        progressScore = Math.max(60, Math.min(100, Math.round(60 + (present / windowAtt.length) * 40)));
      }
    } catch { /* silent */ }
    try {
      if (child.class_id) {
        const { data: assignments } = await client
          .from('homework_assignments').select('id, due_date')
          .eq('class_id', child.class_id).eq('is_published', true)
          .gte('due_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .lte('due_date', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString());
        const assignmentIds = (assignments || []).map((a: any) => a.id);
        if (assignmentIds.length > 0) {
          const { data: subs } = await client
            .from('homework_submissions').select('assignment_id')
            .eq('student_id', child.id).in('assignment_id', assignmentIds);
          const submittedSet = new Set((subs || []).map((s: any) => s.assignment_id));
          homeworkPending = assignmentIds.filter((id: string) => !submittedSet.has(id)).length;
        }
      }
    } catch { homeworkPending = 0; }
    try {
      if (child.class_id) {
        const { data: events } = await client
          .from('class_events').select('id, start_time')
          .eq('class_id', child.class_id).gte('start_time', nowIso).limit(3);
        upcomingEvents = (events || []).length;
      }
    } catch { upcomingEvents = 0; }
    return {
      id: child.id, firstName: child.first_name, lastName: child.last_name,
      dateOfBirth: child.date_of_birth,
      grade: child.classes?.grade_level || t('students.preschool'),
      className: child.classes?.name || (child.class_id ? `Class ${String(child.class_id).slice(-4)}` : null),
      lastActivity, homeworkPending, upcomingEvents, progressScore, status,
    };
  }
  const cards = await Promise.all(realChildren.map(buildCard));
  // Load urgent metrics for active child
  let urgentMetrics: UrgentMetrics | null = null;
  if (cards.length > 0) {
    const targetId = activeChildId && cards.find(c => c.id === activeChildId) ? activeChildId : cards[0].id;
    urgentMetrics = await fetchUrgentMetrics(targetId);
  } else if (internalUserId) {
    try {
      const { data: pendingRegs } = await client
        .from('child_registration_requests')
        .select('registration_fee_amount, payment_verified, status, requested_at')
        .eq('parent_id', internalUserId).order('requested_at', { ascending: false }).limit(1);
      const reg = pendingRegs?.[0];
      if (reg && reg.registration_fee_amount && !reg.payment_verified && reg.status !== 'rejected') {
        urgentMetrics = {
          ...EMPTY_URGENT,
          feesDue: { amount: Number(reg.registration_fee_amount) || 0, dueDate: reg.requested_at || null, overdue: false },
        };
      }
    } catch (regErr) {
      logger.warn('Failed to load pending registration fees:', regErr);
    }
  }
  // AI usage
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const { data: usageData } = await client
    .from('ai_usage_logs').select('service_type')
    .eq('user_id', userId).gte('created_at', startOfMonth.toISOString());
  const usage: UsageStats = {
    ai_help: usageData?.filter(u => u.service_type === 'homework_help').length || 0,
    ai_lessons: usageData?.filter(u => u.service_type === 'lesson_generation').length || 0,
    tutoring_sessions: 0,
  };
  return { children: realChildren, cards, urgentMetrics, usage };
}
