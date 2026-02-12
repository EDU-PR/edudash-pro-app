import type { ResolvedSchoolType } from '@/lib/schoolTypeResolver';

export type DashboardPolicyRole = 'parent' | 'teacher' | 'principal';

type PolicyMap = Record<ResolvedSchoolType, Record<DashboardPolicyRole, ReadonlySet<string>>>;

const makeSet = <T extends string>(ids: T[]): ReadonlySet<string> => new Set(ids);

const POLICY: PolicyMap = {
  preschool: {
    parent: makeSet([
      'view_homework',
      'assigned_lessons',
      'check_attendance',
      'activity_feed',
      'learning_hub',
      'dash_playground',
      'family_activity',
      'upload_progress',
      'messages',
      'events',
      'calls',
      'ai_help',
      'generate_image',
      'dash_tutor',
      'upgrade',
      'payments',
      'dash_grade_test',
      'dev_notifications',
    ]),
    teacher: makeSet([
      'browse_lessons',
      'create_lesson',
      'quick_lesson',
      'create_activity',
      'take_attendance',
      'start_live_lesson',
      'assign_lesson',
      'assign_homework',
      'my_class',
      'birthday_chart',
      'messages',
      'manage_groups',
      'student_reports',
      'family_activity_review',
      'reputation',
      'generate_image',
      'ai_assistant',
      'call_parent',
    ]),
    principal: makeSet([
      'students',
      'teachers',
      'parent-links',
      'classes',
      'groups',
      'teacher-approval',
      'seat-management',
      'registrations',
      'payments',
      'unpaid-fees',
      'fee-management',
      'log-expense',
      'aftercare',
      'browse-lessons',
      'create-lesson',
      'assign-lessons',
      'reports',
      'family-activity-review',
      'activities',
      'calendar',
      'year-planner',
      'ai-year-planner',
      'curriculum-themes',
      'lesson-templates',
      'weekly-plans',
      'live-lessons',
      'announcements',
      'birthday-chart',
      'excursions',
      'meetings',
      'settings',
      'dash-studio',
      'dash-advisor',
    ]),
  },
  k12_school: {
    // K-12 parent quick actions are handled in /(k12)/parent/dashboard.
    // Keep default parent dashboard on a preschool-safe action set.
    parent: makeSet([
      'view_homework',
      'assigned_lessons',
      'check_attendance',
      'activity_feed',
      'messages',
      'events',
      'calls',
      'ai_help',
      'generate_image',
      'dash_tutor',
      'upgrade',
      'payments',
      'dash_grade_test',
      'dev_notifications',
    ]),
    teacher: makeSet([
      'browse_lessons',
      'create_lesson',
      'create_activity',
      'take_attendance',
      'start_live_lesson',
      'assign_lesson',
      'assign_homework',
      'my_class',
      'messages',
      'manage_groups',
      'student_reports',
      'family_activity_review',
      'reputation',
      'generate_image',
      'ai_assistant',
      'call_parent',
    ]),
    principal: makeSet([
      'students',
      'teachers',
      'classes',
      'groups',
      'teacher-approval',
      'registrations',
      'payments',
      'unpaid-fees',
      'fee-management',
      'log-expense',
      'browse-lessons',
      'create-lesson',
      'assign-lessons',
      'reports',
      'calendar',
      'year-planner',
      'ai-year-planner',
      'curriculum-themes',
      'lesson-templates',
      'weekly-plans',
      'live-lessons',
      'announcements',
      'settings',
      'dash-advisor',
    ]),
  },
};

function normalizeRole(role: string): DashboardPolicyRole | null {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'parent') return 'parent';
  if (normalized === 'teacher') return 'teacher';
  if (normalized === 'principal' || normalized === 'principal_admin') return 'principal';
  return null;
}

export function isDashboardActionAllowed(
  role: string,
  schoolType: ResolvedSchoolType,
  actionId: string
): boolean {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return true;

  const rolePolicy = POLICY[schoolType][normalizedRole];
  return rolePolicy.has(actionId);
}

export function filterActionsByDashboardPolicy<T extends { id: string }>(
  actions: T[],
  role: string,
  schoolType: ResolvedSchoolType
): T[] {
  return actions.filter((action) => isDashboardActionAllowed(role, schoolType, action.id));
}
