/** Types for parent dashboard data hook */
export interface ChildCard {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  date_of_birth?: string;
  grade: string;
  className: string | null;
  lastActivity: Date;
  homeworkPending: number;
  upcomingEvents: number;
  progressScore: number;
  status: 'active' | 'absent' | 'late';
}
export interface UrgentMetrics {
  feesDue: { amount: number; dueDate: string | null; overdue: boolean } | null;
  unreadMessages: number;
  pendingHomework: number;
  todayAttendance: 'present' | 'absent' | 'late' | 'unknown';
  upcomingEvents: number;
}
export interface UsageStats {
  ai_help: number;
  ai_lessons: number;
  tutoring_sessions: number;
}
export const EMPTY_URGENT: UrgentMetrics = {
  feesDue: null, unreadMessages: 0, pendingHomework: 0,
  todayAttendance: 'unknown', upcomingEvents: 0,
};
export const EMPTY_USAGE: UsageStats = { ai_help: 0, ai_lessons: 0, tutoring_sessions: 0 };
