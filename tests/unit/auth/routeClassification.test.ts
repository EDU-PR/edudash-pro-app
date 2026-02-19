/**
 * Tests for route classification helpers and the account-switch bypass.
 */
import {
  isAuthRoute,
  isAuthCallbackRoute,
  isProfilesGateRoute,
  isOnboardingRoute,
  isOrgAdminFamilyRoute,
  isAccountSwitchIntent,
  firstParam,
} from '@/hooks/auth/routeClassification';

describe('routeClassification', () => {
  describe('isAuthRoute', () => {
    it.each([
      '/',
      '/landing',
      '/(auth)/sign-in',
      '/(auth)/sign-up',
      '/something/sign-in',
      '/signup',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/auth-callback',
      '/verify-email/verify',
    ])('returns true for auth route: %s', (path) => {
      expect(isAuthRoute(path)).toBe(true);
    });

    it.each([
      '/screens/dashboard',
      '/screens/parent-dashboard',
      '/onboarding',
      '/profiles-gate',
      undefined,
    ])('returns false for non-auth route: %s', (path) => {
      expect(isAuthRoute(path)).toBe(false);
    });
  });

  describe('isAuthCallbackRoute', () => {
    it('returns true when path contains auth-callback', () => {
      expect(isAuthCallbackRoute('/auth-callback')).toBe(true);
      expect(isAuthCallbackRoute('/(auth)/auth-callback?code=123')).toBe(true);
    });

    it('returns false for non-callback paths', () => {
      expect(isAuthCallbackRoute('/sign-in')).toBe(false);
      expect(isAuthCallbackRoute(undefined)).toBe(false);
    });
  });

  describe('isProfilesGateRoute', () => {
    it('detects profiles-gate route', () => {
      expect(isProfilesGateRoute('/profiles-gate')).toBe(true);
      expect(isProfilesGateRoute('/dashboard')).toBe(false);
      expect(isProfilesGateRoute(undefined)).toBe(false);
    });
  });

  describe('isOnboardingRoute', () => {
    it('detects onboarding routes', () => {
      expect(isOnboardingRoute('/onboarding')).toBe(true);
      expect(isOnboardingRoute('/onboarding/step-2')).toBe(true);
      expect(isOnboardingRoute('/not-onboarding')).toBe(false);
    });
  });

  describe('isOrgAdminFamilyRoute', () => {
    it('detects org-admin family routes', () => {
      expect(isOrgAdminFamilyRoute('/screens/org-admin-dashboard')).toBe(true);
      expect(isOrgAdminFamilyRoute('/screens/org-admin/settings')).toBe(true);
      expect(isOrgAdminFamilyRoute('/screens/admin-tertiary-x')).toBe(true);
      expect(isOrgAdminFamilyRoute('/screens/admin-dashboard')).toBe(false);
    });
  });

  describe('firstParam', () => {
    it('unwraps array params', () => {
      expect(firstParam(['1', '2'])).toBe('1');
      expect(firstParam('hello')).toBe('hello');
      expect(firstParam(undefined)).toBeUndefined();
    });
  });

  describe('isAccountSwitchIntent', () => {
    it('returns true when addAccount=1', () => {
      expect(isAccountSwitchIntent({ addAccount: '1' })).toBe(true);
    });

    it('returns true when switch=1', () => {
      expect(isAccountSwitchIntent({ switch: '1' })).toBe(true);
    });

    it('returns false when fresh=1', () => {
      expect(isAccountSwitchIntent({ fresh: '1' })).toBe(false);
    });

    it('returns true when addAccount is array with 1', () => {
      expect(isAccountSwitchIntent({ addAccount: ['1', '0'] })).toBe(true);
    });

    it('returns false when no switch params', () => {
      expect(isAccountSwitchIntent({})).toBe(false);
      expect(isAccountSwitchIntent({ type: 'recovery' })).toBe(false);
      expect(isAccountSwitchIntent({ addAccount: '0' })).toBe(false);
    });
  });
});
