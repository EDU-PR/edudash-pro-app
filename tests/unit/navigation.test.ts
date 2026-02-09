/**
 * Unit tests for navigation logic in lib/navigation.ts
 */

const mockSafeRouter = {
  canGoBack: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
};

jest.mock('@/lib/navigation/safeRouter', () => ({
  __esModule: true,
  safeRouter: mockSafeRouter,
  default: mockSafeRouter,
}));

const { shouldShowBackButton, navigateBack } = require('../../lib/navigation');

describe('Navigation Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSafeRouter.canGoBack.mockReturnValue(true);
  });

  describe('shouldShowBackButton', () => {
    it('returns false for dashboard routes', () => {
      const routes = [
        'parent-dashboard',
        'teacher-dashboard',
        'screens/teacher-dashboard',
        'SCREENS/PRINCIPAL-DASHBOARD',
      ];

      routes.forEach((route) => {
        expect(shouldShowBackButton(route, true)).toBe(false);
      });
    });

    it('returns false for root routes', () => {
      const routes = ['index', 'landing', '(tabs)', '', 'home'];
      routes.forEach((route) => {
        expect(shouldShowBackButton(route, true)).toBe(false);
      });
    });

    it('returns true for regular routes when back navigation is available', () => {
      mockSafeRouter.canGoBack.mockReturnValue(true);
      const routes = ['parent-messages', 'screens/parent-messages', 'class-list'];
      routes.forEach((route) => {
        expect(shouldShowBackButton(route, true)).toBe(true);
      });
    });

    it('returns false for regular routes when back navigation is unavailable', () => {
      mockSafeRouter.canGoBack.mockReturnValue(false);
      const routes = ['parent-messages', 'class-list'];
      routes.forEach((route) => {
        expect(shouldShowBackButton(route, true)).toBe(false);
      });
    });

    it('returns true for always-back routes even when history is unavailable', () => {
      mockSafeRouter.canGoBack.mockReturnValue(false);
      const routes = ['account', 'settings', 'profile', 'student-detail'];
      routes.forEach((route) => {
        expect(shouldShowBackButton(route, true)).toBe(true);
      });
    });

    it('handles null and undefined route names safely', () => {
      expect(shouldShowBackButton(null as any, true)).toBe(false);
      expect(shouldShowBackButton(undefined as any, true)).toBe(false);
    });
  });

  describe('navigateBack', () => {
    it('calls back() when canGoBack is true', () => {
      mockSafeRouter.canGoBack.mockReturnValue(true);
      navigateBack();
      expect(mockSafeRouter.back).toHaveBeenCalledTimes(1);
      expect(mockSafeRouter.replace).not.toHaveBeenCalled();
    });

    it('uses fallback route when canGoBack is false', () => {
      mockSafeRouter.canGoBack.mockReturnValue(false);
      navigateBack('/custom-fallback');
      expect(mockSafeRouter.back).not.toHaveBeenCalled();
      expect(mockSafeRouter.replace).toHaveBeenCalledWith('/custom-fallback');
    });

    it('uses default fallback route when no fallback is provided', () => {
      mockSafeRouter.canGoBack.mockReturnValue(false);
      navigateBack();
      expect(mockSafeRouter.replace).toHaveBeenCalledWith('/');
    });

    it('handles navigation errors gracefully', () => {
      mockSafeRouter.canGoBack.mockImplementation(() => {
        throw new Error('Navigation failure');
      });
      expect(() => navigateBack()).not.toThrow();
      expect(mockSafeRouter.replace).toHaveBeenCalledWith('/');
    });
  });
});
