export interface ManifestTabConfig {
  id: string;
  label: string;
  icon: string;
  activeIcon: string;
  route: string;
  roles?: string[];
  isCenterTab?: boolean;
}

export const ROLES_WITH_CENTER_TAB = [
  'parent',
  'student',
  'learner',
  'principal',
  'principal_admin',
  'teacher',
] as const;

export const SCHOOL_ADMIN_DASH_TAB: ManifestTabConfig = {
  id: 'school-admin-dash',
  label: 'Dash',
  icon: 'sparkles-outline',
  activeIcon: 'sparkles',
  route: '/screens/dash-assistant',
  isCenterTab: true,
};

export function roleHasCenterDashTab(role: string): boolean {
  return ROLES_WITH_CENTER_TAB.includes(role as (typeof ROLES_WITH_CENTER_TAB)[number]);
}
