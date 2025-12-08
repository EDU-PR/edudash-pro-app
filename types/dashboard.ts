/**
 * Dashboard Data Types
 * 
 * Shared type definitions for all dashboard hooks.
 * Extracted from hooks/useDashboardData.ts per WARP.md standards.
 */

// Types for dashboard data
export interface PrincipalDashboardData {
  schoolId?: string;
  schoolName: string;
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  attendanceRate: number;
  monthlyRevenue: number;
  pendingApplications: number;
  upcomingEvents: number;
  capacity?: number;
  enrollmentPercentage?: number;
  lastUpdated?: string;
  recentActivity: Array<{
    id: string;
    type: 'enrollment' | 'payment' | 'teacher' | 'event';
    message: string;
    time: string;
    userName?: string;
  }>;
}

export interface TeacherDashboardData {
  schoolName: string;
  schoolTier?: 'free' | 'starter' | 'premium' | 'enterprise' | 'solo' | 'group_5' | 'group_10';
  totalStudents: number;
  totalClasses: number;
  upcomingLessons: number;
  pendingGrading: number;
  myClasses: Array<{
    id: string;
    name: string;
    studentCount: number;
    grade: string;
    room: string;
    nextLesson: string;
    attendanceRate?: number;
    presentToday?: number;
  }>;
  recentAssignments: Array<{
    id: string;
    title: string;
    dueDate: string;
    submitted: number;
    total: number;
    status: 'pending' | 'graded' | 'overdue';
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    time: string;
    type: 'meeting' | 'activity' | 'assessment';
  }>;
}

export interface ParentDashboardData {
  schoolName: string;
  totalChildren: number;
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    grade: string;
    className: string;
    teacher: string;
  }>;
  attendanceRate: number;
  presentToday: number;
  recentHomework: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: 'submitted' | 'graded' | 'not_submitted';
    studentName: string;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    time: string;
    type: 'meeting' | 'activity' | 'assessment';
  }>;
  unreadMessages: number;
}
