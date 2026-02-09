/**
 * Principal Analytics type definitions and utility helpers.
 */

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

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
  }).format(amount);

export const getStatusColor = (value: number, good: number, excellent: number): string => {
  if (value >= excellent) return '#10B981';
  if (value >= good) return '#F59E0B';
  return '#EF4444';
};
