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

export interface DashboardQuickStat {
  label: string;
  value: string | number;
  icon?: string;
  trend?: string;
  color?: string;
}

export interface RecentActivity {
  id: string;
  type: string;
  message: string;
  time: string;
  userName?: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  time: string;
  type?: string;
}

export interface ChildData {
  id: string;
  firstName: string;
  lastName: string;
  grade?: string;
  className?: string;
  teacher?: string;
}

export function createEmptyPrincipalData(): PrincipalDashboardData {
  return {
    schoolName: '',
    totalStudents: 0,
    totalTeachers: 0,
    totalParents: 0,
    attendanceRate: 0,
    monthlyRevenue: 0,
    pendingApplications: 0,
    upcomingEvents: 0,
    recentActivity: [],
  };
}

export function createEmptyTeacherData(): TeacherDashboardData {
  return {
    schoolName: '',
    totalStudents: 0,
    totalClasses: 0,
    upcomingLessons: 0,
    pendingGrading: 0,
    myClasses: [],
    recentAssignments: [],
    upcomingEvents: [],
  };
}

export function createEmptyParentData(): ParentDashboardData {
  return {
    schoolName: '',
    totalChildren: 0,
    children: [],
    attendanceRate: 0,
    presentToday: 0,
    recentHomework: [],
    upcomingEvents: [],
    unreadMessages: 0,
  };
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
