/**
 * Fetches and computes analytics data for the principal dashboard.
 */
import { supabase } from '@/lib/supabase';
import type { AnalyticsData } from './types';

export async function fetchPrincipalAnalytics(
  schoolId: string,
): Promise<AnalyticsData> {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const today = now.toISOString().split('T')[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const sb = supabase!;
  const [studentsRes, attendanceRes, todayAttRes, revenueRes, outstandingRes, staffRes] =
    await Promise.all([
      sb.from('students')
        .select('id, created_at, status, date_of_birth, age_groups (name)')
        .eq('preschool_id', schoolId),
      sb.from('attendance').select('status, attendance_date').gte('attendance_date', monthStart),
      sb.from('attendance').select('status').eq('attendance_date', today),
      sb.from('financial_transactions').select('amount')
        .eq('preschool_id', schoolId).eq('type', 'fee_payment').eq('status', 'completed')
        .gte('created_at', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
        .lt('created_at', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`),
      sb.from('financial_transactions').select('amount')
        .eq('preschool_id', schoolId).eq('type', 'fee_payment').eq('status', 'pending'),
      sb.from('profiles').select('id, role')
        .or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`)
        .eq('role', 'teacher'),
    ]);

  // Enrollment
  const students = studentsRes.data || [];
  const totalStudents = students.length;
  const newEnrollments = students.filter((s) => new Date(s.created_at) >= lastMonth).length;
  const activeStudents = students.filter((s) => s.status === 'active').length;
  const withdrawnStudents = students.filter((s) => s.status === 'withdrawn').length;
  const retentionRate = totalStudents ? (activeStudents / totalStudents) * 100 : 0;

  const ageGroupCounts: Record<string, number> = {};
  students.forEach((s) => {
    const ag = (s.age_groups as any)?.name || 'Unknown';
    ageGroupCounts[ag] = (ageGroupCounts[ag] || 0) + 1;
  });
  const ageGroupDistribution = Object.entries(ageGroupCounts).map(([ageGroup, count]) => ({
    ageGroup,
    count,
  }));

  // Attendance
  const attRecords = attendanceRes.data || [];
  const totalAtt = attRecords.length;
  const presentAtt = attRecords.filter((a) => a.status === 'present').length;
  const averageAttendance = totalAtt > 0 ? (presentAtt / totalAtt) * 100 : 0;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyTrend = dayLabels.map((label, idx) => {
    const recs = attRecords.filter((r) => new Date(r.attendance_date).getDay() === idx);
    const p = recs.filter((r) => r.status === 'present').length;
    return { day: label, rate: recs.length > 0 ? Math.round((p / recs.length) * 100) : 0 };
  });

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const recent = attRecords.filter((r) => new Date(r.attendance_date) >= sevenDaysAgo);
  const byDay: Record<string, { present: number; total: number }> = {};
  for (const r of recent) {
    const key = new Date(r.attendance_date).toISOString().split('T')[0];
    if (!byDay[key]) byDay[key] = { present: 0, total: 0 };
    byDay[key].total += 1;
    if (r.status === 'present') byDay[key].present += 1;
  }
  const lowAttendanceAlerts = Object.values(byDay).filter(
    (d) => d.total > 0 && (d.present / d.total) * 100 < 85,
  ).length;

  const todayRecords = todayAttRes.data || [];
  const todayPresent = todayRecords.filter((a) => a.status === 'present').length;
  const todayAttendance = todayRecords.length > 0 ? (todayPresent / todayRecords.length) * 100 : 0;

  // Finance
  const totalRevenue = (revenueRes.data || []).reduce((sum, t) => sum + t.amount, 0);
  const totalOutstanding = (outstandingRes.data || []).reduce((sum, t) => sum + t.amount, 0);
  const paymentRate =
    totalRevenue > 0 ? (totalRevenue / (totalRevenue + totalOutstanding)) * 100 : 0;

  // Staff
  const activeTeachers = (staffRes.data || []).length;
  const totalStaff = staffRes.count || activeTeachers;
  const studentTeacherRatio = activeTeachers > 0 ? activeStudents / activeTeachers : 0;

  return {
    enrollment: { totalStudents, newEnrollments, withdrawals: withdrawnStudents, retentionRate, ageGroupDistribution },
    attendance: { averageAttendance, todayAttendance, weeklyTrend, lowAttendanceAlerts },
    finance: { monthlyRevenue: totalRevenue, outstandingFees: totalOutstanding, paymentRate, expenseRatio: 0 },
    staff: { totalStaff, activeTeachers, studentTeacherRatio, performanceScore: 0 },
    academic: { averageGrade: 0, improvingStudents: 0, strugglingStudents: 0, parentEngagement: 0 },
  };
}
