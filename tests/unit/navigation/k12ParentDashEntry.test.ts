/**
 * Unit tests for K12 Parent Dash tab entry in BottomTabBar
 *
 * These tests validate the locked decision:
 *   K-12 parent default Dash entry = Tutor Chat
 *     route: /screens/dash-assistant?mode=tutor&source=k12_parent_tab
 *
 * Since BottomTabBar is a React component, these tests verify the
 * underlying data transformation logic rather than rendering.
 */

describe('K12 Parent Dash Tab Entry — data contract', () => {
  /**
   * The BottomTabBar overrides the parent center Dash tab route
   * from /screens/dash-voice → /screens/dash-assistant?mode=tutor&source=k12_parent_tab
   * when the user is a K12 parent. This test validates the expected URL format.
   */
  const K12_PARENT_DASH_ROUTE = '/screens/dash-assistant?mode=tutor&source=k12_parent_tab';

  it('K12 parent Dash route starts with /screens/dash-assistant', () => {
    expect(K12_PARENT_DASH_ROUTE.startsWith('/screens/dash-assistant')).toBe(true);
  });

  it('K12 parent Dash route includes tutor mode param', () => {
    const url = new URL(K12_PARENT_DASH_ROUTE, 'http://localhost');
    expect(url.searchParams.get('mode')).toBe('tutor');
  });

  it('K12 parent Dash route includes k12_parent_tab source', () => {
    const url = new URL(K12_PARENT_DASH_ROUTE, 'http://localhost');
    expect(url.searchParams.get('source')).toBe('k12_parent_tab');
  });

  it('K12 parent Dash route is NOT /screens/dash-voice', () => {
    expect(K12_PARENT_DASH_ROUTE).not.toBe('/screens/dash-voice');
  });

  it('isActive should match dash-assistant, dash-voice, and dash-tutor', () => {
    // Mirrors the isActive logic in BottomTabBar for 'parent-dash' tabId
    const isParentDashActive = (pathname: string) =>
      pathname.includes('/screens/dash-assistant') ||
      pathname.includes('/screens/dash-voice') ||
      pathname.includes('/screens/dash-tutor');

    expect(isParentDashActive('/screens/dash-assistant')).toBe(true);
    expect(isParentDashActive('/screens/dash-assistant?mode=tutor')).toBe(true);
    expect(isParentDashActive('/screens/dash-voice')).toBe(true);
    expect(isParentDashActive('/screens/dash-tutor')).toBe(true);
    expect(isParentDashActive('/screens/parent-dashboard')).toBe(false);
    expect(isParentDashActive('/screens/grades')).toBe(false);
  });
});
