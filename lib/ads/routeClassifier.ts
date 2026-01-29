import { Platform } from 'react-native';

export function isAuthLikeRoute(pathname: string | null): boolean {
  if (!pathname) return true;
  return (
    pathname.startsWith('/(auth)') ||
    pathname === '/' ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/landing') ||
    pathname.includes('auth-callback') ||
    pathname.includes('reset-password') ||
    pathname.includes('profiles-gate') ||
    pathname.includes('onboarding') ||
    pathname.includes('verify')
  );
}

const EDUCATIONAL_KEYWORDS = [
  'learning',
  'lesson',
  'lessons',
  'homework',
  'worksheet',
  'quiz',
  'practice',
  'study',
  'dash-assistant',
  'dash-orb',
  'dash-ai',
  'tutor',
  'progress',
  'grades',
  'attendance',
  'report',
  'reports',
  'activity',
  'activities',
  'live-classes',
  'reading',
  'math',
  'science',
];

const NON_EDUCATIONAL_KEYWORDS = [
  'settings',
  'account',
  'profile',
  'payments',
  'billing',
  'subscription',
  'membership',
  'messages',
  'chat',
  'calendar',
  'birthday',
  'announcements',
  'notifications',
  'support',
  'help',
  'calls',
  'call',
  'invite',
  'invites',
  'uniform',
  'fees',
  'donation',
  'admin',
  'principal',
  'teacher',
  'parent',
];

export function isEducationalRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return EDUCATIONAL_KEYWORDS.some((keyword) => pathname.includes(keyword));
}

export function isNonEducationalRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (isAuthLikeRoute(pathname)) return false;
  if (isEducationalRoute(pathname)) return false;
  return NON_EDUCATIONAL_KEYWORDS.some((keyword) => pathname.includes(keyword));
}

export function isWebPlatform(): boolean {
  return Platform.OS === 'web';
}
