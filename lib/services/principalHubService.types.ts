/**
 * Type definitions used by PrincipalHubService.
 * Extracted for WARP.md compliance and reuse by hooks/principal-hub/.
 */

export interface PrincipalHubStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  attendanceRate: number;
  monthlyRevenue: number;
  pendingApplications: number;
  upcomingEvents: number;
}

export interface TeacherInfo {
  id: string;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string;
  subject_specialization?: string;
  is_active: boolean;
  created_at: string;
  classes_assigned: number;
  students_count: number;
  last_login?: string;
}

export interface AnnouncementData {
  id: string;
  title: string;
  content: string;
  target_audience: string[];
  target_classes?: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduled_for?: string;
  expires_at?: string;
  is_published: boolean;
  created_at: string;
  created_by: string;
}

export interface FinancialSummary {
  monthlyRevenue: number;
  monthlyExpenses: number;
  netProfit: number;
  outstandingFees: number;
  enrollmentTrend: 'up' | 'down' | 'stable';
  paymentRate: number;
}
