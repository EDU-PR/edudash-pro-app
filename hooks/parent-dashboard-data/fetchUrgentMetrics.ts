/** Fetch urgent metrics (fees, homework, attendance, events) for a single child */
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { UrgentMetrics } from './types';
export async function fetchUrgentMetrics(studentId: string): Promise<UrgentMetrics | null> {
  try {
    const client = assertSupabase();
    const today = new Date().toISOString().split('T')[0];
    const { data: studentData } = await client
      .from('students').select('preschool_id, class_id, enrollment_date')
      .eq('id', studentId).single();
    if (!studentData) return null;
    const enrollmentDate = studentData.enrollment_date ? new Date(studentData.enrollment_date) : null;
    const enrollmentMonthStart = enrollmentDate
      ? new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth(), 1) : null;
    const todayDate = new Date();
    const todayStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    // Fees due
    const { data: feeRows } = await client
      .from('student_fees').select('final_amount, amount, due_date, status')
      .eq('student_id', studentId);
    const payableFees = (feeRows || []).filter((f: any) => {
      if (!enrollmentMonthStart || !f?.due_date) return true;
      const due = new Date(f.due_date);
      return Number.isNaN(due.getTime()) || due >= enrollmentMonthStart;
    });
    const unpaidStatuses = new Set(['pending', 'overdue', 'partially_paid']);
    const pendingFees = payableFees.filter((f: any) => unpaidStatuses.has(String(f.status)));
    const dueFees = pendingFees.filter((f: any) => {
      if (!f?.due_date) return true;
      const due = new Date(f.due_date);
      return Number.isNaN(due.getTime()) || due <= todayStart;
    });
    const nextDue = dueFees.sort((a: any, b: any) =>
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
    const feesDue = nextDue ? {
      amount: nextDue.final_amount || nextDue.amount || 0,
      dueDate: nextDue.due_date || null,
      overdue: nextDue.due_date ? new Date(nextDue.due_date) < todayStart : false,
    } : null;
    // Pending homework
    let pendingHomework = 0;
    if (studentData.class_id) {
      const { data: assignments } = await client
        .from('homework_assignments').select('id')
        .eq('class_id', studentData.class_id).eq('is_published', true)
        .gte('due_date', today).limit(10);
      if (assignments) {
        const assignmentIds = assignments.map(a => a.id);
        const { data: submissions } = await client
          .from('homework_submissions').select('assignment_id')
          .eq('student_id', studentId).in('assignment_id', assignmentIds);
        const submittedIds = new Set(submissions?.map(s => s.assignment_id) || []);
        pendingHomework = assignmentIds.filter(id => !submittedIds.has(id)).length;
      }
    }
    // Today's attendance
    let todayAttendance: 'present' | 'absent' | 'late' | 'unknown' = 'unknown';
    try {
      const { data: attendanceData } = await client
        .from('attendance').select('status')
        .eq('student_id', studentId).eq('attendance_date', today).maybeSingle();
      if (attendanceData) {
        const status = String(attendanceData.status).toLowerCase();
        todayAttendance = ['present', 'absent', 'late'].includes(status)
          ? status as 'present' | 'absent' | 'late' : 'unknown';
      }
    } catch { /* silent */ }
    // Upcoming events
    let upcomingEvents = 0;
    if (studentData.class_id) {
      try {
        const { count } = await client
          .from('class_events').select('id', { count: 'exact', head: true })
          .eq('class_id', studentData.class_id)
          .gte('start_time', new Date().toISOString())
          .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
        upcomingEvents = count || 0;
      } catch { /* silent */ }
    }
    return {
      feesDue: feesDue && feesDue.amount > 0 ? feesDue : null,
      unreadMessages: 0, pendingHomework, todayAttendance, upcomingEvents,
    };
  } catch (error) {
    logger.error('Failed to load urgent metrics:', error);
    return null;
  }
}
