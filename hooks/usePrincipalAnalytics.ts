/**
 * usePrincipalAnalytics Hook
 * 
 * Fetches and manages analytics data for principal dashboard.
 * Extracted from monolithic principal-analytics.tsx for modularity.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export interface EnrollmentData {
  totalStudents: number;
  newEnrollments: number;
  withdrawals: number;
  retentionRate: number;
  ageGroupDistribution: { ageGroup: string; count: number }[];
}

export interface AttendanceData {
  averageAttendance: number;
  todayAttendance: number;
  weeklyTrend: { day: string; rate: number }[];
  lowAttendanceAlerts: number;
}

export interface FinanceData {
  monthlyRevenue: number;
  outstandingFees: number;
  paymentRate: number;
  expenseRatio: number;
}

export interface StaffData {
  totalStaff: number;
  activeTeachers: number;
  studentTeacherRatio: number;
  performanceScore: number;
}

export interface AcademicData {
  averageGrade: number;
  improvingStudents: number;
  strugglingStudents: number;
  parentEngagement: number;
}

export interface AnalyticsData {
  enrollment: EnrollmentData;
  attendance: AttendanceData;
  finance: FinanceData;
  staff: StaffData;
  academic: AcademicData;
}

export function usePrincipalAnalytics() {
  const { user, profile } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      const schoolId = (profile as any)?.preschool_id || (profile as any)?.organization_id;
      if (!schoolId) {
        setError('No school associated with this account');
        setLoading(false);
        return;
      }

      // Get school info
      const { data: school } = await supabase
        .from('preschools')
        .select('id, name')
        .eq('id', schoolId)
        .maybeSingle();

      if (!school) {
        setError('School not found');
        setLoading(false);
        return;
      }

      // Fetch all data in parallel for better performance
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const today = now.toISOString().split('T')[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        studentsResult,
        attendanceResult,
        todayAttendanceResult,
        revenueResult,
        outstandingResult,
        staffResult,
      ] = await Promise.all([
        // Students
        supabase
          .from('students')
          .select('id, created_at, status, date_of_birth, age_groups (name)')
          .eq('preschool_id', school.id),
        // Attendance (current month)
        supabase
          .from('attendance_records')
          .select('status, date')
          .eq('preschool_id', school.id)
          .gte('date', monthStart),
        // Today's attendance
        supabase
          .from('attendance_records')
          .select('status')
          .eq('preschool_id', school.id)
          .gte('date', today + 'T00:00:00')
          .lt('date', today + 'T23:59:59'),
        // Monthly revenue
        supabase
          .from('financial_transactions')
          .select('amount')
          .eq('preschool_id', school.id)
          .eq('type', 'fee_payment')
          .eq('status', 'completed')
          .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('created_at', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`),
        // Outstanding fees
        supabase
          .from('financial_transactions')
          .select('amount')
          .eq('preschool_id', school.id)
          .eq('type', 'fee_payment')
          .eq('status', 'pending'),
        // Staff (profiles.id = auth_user_id)
        supabase
          .from('profiles')
          .select('id, role')
          .or(`preschool_id.eq.${school.id},organization_id.eq.${school.id}`)
          .eq('role', 'teacher'),
      ]);

      const students = studentsResult.data || [];
      const totalStudents = students.length;
      
      // Calculate enrollment metrics
      const newEnrollments = students.filter(s => new Date(s.created_at) >= lastMonth).length;
      const activeStudents = students.filter(s => s.status === 'active').length;
      const withdrawnStudents = students.filter(s => s.status === 'withdrawn').length;
      const retentionRate = totalStudents ? (activeStudents / totalStudents) * 100 : 0;

      // Age group distribution
      const ageGroupCounts: Record<string, number> = {};
      students.forEach(s => {
        const ageGroup = (s.age_groups as any)?.name || 'Unknown';
        ageGroupCounts[ageGroup] = (ageGroupCounts[ageGroup] || 0) + 1;
      });
      const ageGroupDistribution = Object.entries(ageGroupCounts).map(([ageGroup, count]) => ({
        ageGroup,
        count,
      }));

      // Attendance calculations
      const attendanceRecords = attendanceResult.data || [];
      const totalAttendanceRecords = attendanceRecords.length;
      const presentRecords = attendanceRecords.filter(a => a.status === 'present').length;
      const averageAttendance = totalAttendanceRecords > 0 ? (presentRecords / totalAttendanceRecords) * 100 : 0;

      // Weekly trend
      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weeklyTrend = dayLabels.map((label, idx) => {
        const recs = attendanceRecords.filter(r => new Date(r.date).getDay() === idx);
        const present = recs.filter(r => r.status === 'present').length;
        const rate = recs.length > 0 ? Math.round((present / recs.length) * 100) : 0;
        return { day: label, rate };
      });

      // Low attendance alerts (last 7 days)
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      const recent = attendanceRecords.filter(r => new Date(r.date) >= sevenDaysAgo);
      const byDay: Record<string, { present: number; total: number }> = {};
      for (const r of recent) {
        const key = new Date(r.date).toISOString().split('T')[0];
        if (!byDay[key]) byDay[key] = { present: 0, total: 0 };
        byDay[key].total += 1;
        if (r.status === 'present') byDay[key].present += 1;
      }
      const lowAttendanceAlerts = Object.values(byDay).filter(d => 
        d.total > 0 && (d.present / d.total) * 100 < 85
      ).length;

      // Today's attendance
      const todayRecords = todayAttendanceResult.data || [];
      const todayPresent = todayRecords.filter(a => a.status === 'present').length;
      const todayTotal = todayRecords.length;
      const todayAttendance = todayTotal > 0 ? (todayPresent / todayTotal) * 100 : 0;

      // Financial calculations
      const totalRevenue = (revenueResult.data || []).reduce((sum, t) => sum + t.amount, 0);
      const totalOutstanding = (outstandingResult.data || []).reduce((sum, t) => sum + t.amount, 0);
      const paymentRate = totalRevenue > 0 ? (totalRevenue / (totalRevenue + totalOutstanding)) * 100 : 0;

      // Staff calculations
      const activeTeachers = (staffResult.data || []).length;
      const totalStaff = staffResult.count || activeTeachers;
      const studentTeacherRatio = activeTeachers > 0 ? activeStudents / activeTeachers : 0;

      setAnalytics({
        enrollment: {
          totalStudents,
          newEnrollments,
          withdrawals: withdrawnStudents,
          retentionRate,
          ageGroupDistribution,
        },
        attendance: {
          averageAttendance,
          todayAttendance,
          weeklyTrend,
          lowAttendanceAlerts,
        },
        finance: {
          monthlyRevenue: totalRevenue,
          outstandingFees: totalOutstanding,
          paymentRate,
          expenseRatio: 0,
        },
        staff: {
          totalStaff,
          activeTeachers,
          studentTeacherRatio,
          performanceScore: 0,
        },
        academic: {
          averageGrade: 0,
          improvingStudents: 0,
          strugglingStudents: 0,
          parentEngagement: 0,
        },
      });
      setError(null);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, profile]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalytics();
  }, [loadAnalytics]);

  return {
    analytics,
    loading,
    refreshing,
    error,
    refresh,
  };
}

// Utility functions
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const getStatusColor = (value: number, good: number, excellent: number): string => {
  if (value >= excellent) return '#10B981';
  if (value >= good) return '#F59E0B';
  return '#EF4444';
};
