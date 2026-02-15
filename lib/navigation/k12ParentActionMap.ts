/**
 * K-12 Parent Dashboard Action Map
 *
 * Single source of truth for all dashboard CTA destinations.
 * Prevents inline route duplication and makes it trivial to
 * assert route validity in tests.
 */

export type K12ParentActionId =
  | 'search'
  | 'notifications'
  | 'profile'
  | 'tutor_session'
  | 'exam_builder'
  | 'messages'
  | 'grades'
  | 'account'
  | 'see_all_activity'
  | 'see_all_events'
  | 'event_detail'
  | 'school_communication'
  | 'child_detail';

export interface K12ParentActionConfig {
  /** Destination route path */
  route: string;
  /** Optional params factory — returns search / query params */
  params?: Record<string, string>;
  /** Human-readable label (for telemetry / debugging) */
  label: string;
}

export const K12_PARENT_ACTIONS: Record<K12ParentActionId, K12ParentActionConfig> = {
  search: {
    route: '/screens/app-search',
    params: { scope: 'all' },
    label: 'Search',
  },
  notifications: {
    route: '/screens/notifications',
    label: 'Notifications',
  },
  profile: {
    route: '/screens/account',
    label: 'Profile / Account',
  },
  tutor_session: {
    route: '/screens/dash-assistant',
    params: { source: 'k12_parent', mode: 'tutor', tutorMode: 'diagnostic' },
    label: 'Start Tutor Session',
  },
  exam_builder: {
    route: '/screens/exam-prep',
    label: 'Exam Builder',
  },
  messages: {
    route: '/screens/parent-messages',
    label: 'Messages',
  },
  grades: {
    route: '/screens/grades',
    label: 'Grades',
  },
  account: {
    route: '/screens/account',
    label: 'Account',
  },
  see_all_activity: {
    route: '/screens/parent-activity-feed',
    label: 'See All Recent Activity',
  },
  see_all_events: {
    route: '/screens/calendar',
    params: { source: 'k12_parent', tab: 'events' },
    label: 'See All Events',
  },
  event_detail: {
    route: '/screens/calendar',
    label: 'Event Detail',
  },
  school_communication: {
    route: '/screens/parent-announcements',
    label: 'School Communication',
  },
  child_detail: {
    route: '/screens/parent-children',
    label: 'Child Detail',
  },
};

/**
 * Returns an array of all destination routes used by the K-12 parent dashboard.
 * Useful for route-validity assertions in tests.
 */
export function getAllK12ParentRoutes(): string[] {
  return [...new Set(Object.values(K12_PARENT_ACTIONS).map((a) => a.route))];
}
