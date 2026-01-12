/**
 * Teacher Routes - Single Source of Truth
 * 
 * Centralizes all teacher dashboard navigation routes.
 * Use this file for consistent routing across the app.
 * 
 * @module lib/constants/teacherRoutes
 */

import type { Href } from 'expo-router';

/**
 * Route configuration for teacher features
 */
export interface TeacherRoute {
  /** Route path */
  path: Href;
  /** Display title */
  title: string;
  /** Icon name (Ionicons) */
  icon: string;
  /** Theme color key or hex color */
  color: string;
  /** Translation key for title */
  titleKey: string;
  /** Whether route requires premium tier */
  requiresPremium?: boolean;
  /** Roles that can access this route */
  roles?: ('teacher' | 'principal_admin')[];
  /** Category for grouping */
  category: 'lessons' | 'classroom' | 'communication' | 'ai' | 'reports';
}

/**
 * All teacher routes - Single Source of Truth
 * 
 * Add new routes here and they will automatically appear
 * in the dashboard quick actions.
 */
export const TEACHER_ROUTES: Record<string, TeacherRoute> = {
  // === LESSONS ===
  create_lesson: {
    path: '/screens/preschool-lesson-generator' as Href,
    title: 'Create Lesson',
    titleKey: 'teacher.create_lesson',
    icon: 'book',
    color: 'primary',
    category: 'lessons',
  },
  my_lessons: {
    path: '/screens/my-lessons' as Href,
    title: 'My Lessons',
    titleKey: 'teacher.my_lessons',
    icon: 'library',
    color: '#8B5CF6',
    category: 'lessons',
  },
  assign_lesson: {
    path: '/screens/assign-lesson' as Href,
    title: 'Assign Lesson',
    titleKey: 'teacher.grade_assignments',
    icon: 'checkmark-circle',
    color: 'success',
    category: 'lessons',
  },
  
  // === CLASSROOM ===
  start_live_lesson: {
    path: '/screens/start-live-lesson' as Href,
    title: 'Start Live Lesson',
    titleKey: 'teacher.start_live_lesson',
    icon: 'videocam',
    color: '#ec4899',
    category: 'classroom',
  },
  my_class: {
    path: '/screens/my-class' as Href,
    title: 'My Class',
    titleKey: 'teacher.my_class',
    icon: 'school',
    color: 'secondary',
    category: 'classroom',
  },
  
  // === COMMUNICATION ===
  messages: {
    path: '/screens/teacher-message-list' as Href,
    title: 'Parent Messages',
    titleKey: 'teacher.parent_communication',
    icon: 'chatbubbles',
    color: 'info',
    category: 'communication',
  },
  call_parent: {
    path: '/screens/calls' as Href,
    title: 'Call Parent',
    titleKey: 'teacher.call_parent',
    icon: 'call',
    color: '#10B981',
    category: 'communication',
  },
  
  // === AI FEATURES ===
  ai_assistant: {
    path: '/screens/dash-assistant' as Href,
    title: 'AI Assistant',
    titleKey: 'teacher.ai_assistant',
    icon: 'sparkles',
    color: 'accent',
    requiresPremium: true,
    category: 'ai',
  },
  
  // === ATTENDANCE ===
  take_attendance: {
    path: '/screens/attendance' as Href,
    title: 'Take Attendance',
    titleKey: 'teacher.take_attendance',
    icon: 'checkbox',
    color: '#10B981',
    category: 'classroom',
  },
  
  // === REPORTS ===
  student_reports: {
    path: '/screens/teacher-reports' as Href,
    title: 'Student Reports',
    titleKey: 'teacher.student_reports',
    icon: 'bar-chart',
    color: 'warning',
    category: 'reports',
  },
} as const;

/**
 * Get route path for a specific action
 */
export const getTeacherRoute = (action: keyof typeof TEACHER_ROUTES): Href => {
  return TEACHER_ROUTES[action]?.path || '/screens/teacher-dashboard' as Href;
};

/**
 * Get all routes for a specific category
 */
export const getRoutesByCategory = (category: TeacherRoute['category']): TeacherRoute[] => {
  return Object.values(TEACHER_ROUTES).filter(route => route.category === category);
};

/**
 * Quick actions to display on the dashboard
 * Order matters - this is the display order
 */
export const TEACHER_QUICK_ACTIONS: (keyof typeof TEACHER_ROUTES)[] = [
  'create_lesson',
  'my_lessons',
  'take_attendance',
  'start_live_lesson',
  'assign_lesson',
  'my_class',
  'messages',
  'student_reports',
  'ai_assistant',
  'call_parent',
];

/**
 * Resolve color from theme or hex
 */
export const resolveRouteColor = (colorKey: string, theme: any): string => {
  // If it's a hex color, return as-is
  if (colorKey.startsWith('#')) {
    return colorKey;
  }
  // Otherwise resolve from theme
  return theme[colorKey] || theme.primary;
};
