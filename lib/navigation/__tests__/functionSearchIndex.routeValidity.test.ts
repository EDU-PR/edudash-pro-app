/**
 * Unit tests for functionSearchIndex route validity
 *
 * Ensures the search index does not contain known invalid routes
 * and that parent-role search queries surface finance and document
 * screens correctly.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock EDUDASH_SCREENS to avoid pulling in the full constant at test time
jest.mock('@/lib/constants/edudash-features', () => ({
  EDUDASH_SCREENS: {},
}));

import { getFunctionSearchItems, FUNCTION_SEARCH_INDEX } from '@/lib/navigation/functionSearchIndex';

const KNOWN_DEAD_ROUTES = [
  '/screens/parent-events',
  '/screens/search',
];

describe('Function Search Index — route validity', () => {
  it('does not contain any known dead routes in the main index', () => {
    FUNCTION_SEARCH_INDEX.forEach((item) => {
      KNOWN_DEAD_ROUTES.forEach((dead) => {
        expect(item.route).not.toBe(dead);
      });
    });
  });

  it('includes a grades entry for parent role', () => {
    const results = getFunctionSearchItems({ role: 'parent', query: 'grades' });
    const gradesItem = results.find((r) => r.route === '/screens/grades');
    expect(gradesItem).toBeDefined();
  });

  it('includes activity feed for parent role', () => {
    const results = getFunctionSearchItems({ role: 'parent', query: 'activity feed' });
    const activityItem = results.find((r) => r.route === '/screens/parent-activity-feed');
    expect(activityItem).toBeDefined();
  });

  it('includes announcements for parent role', () => {
    const results = getFunctionSearchItems({ role: 'parent', query: 'announcements' });
    const item = results.find((r) => r.route === '/screens/parent-announcements');
    expect(item).toBeDefined();
  });
});

describe('Function Search Index — parent finance synonyms', () => {
  const financeQueries = ['payment', 'pay', 'fees', 'school fees', 'money', 'billing'];

  financeQueries.forEach((query) => {
    it(`"${query}" returns parent payment results`, () => {
      const results = getFunctionSearchItems({ role: 'parent', query });
      const paymentRoutes = results.filter((r) =>
        r.route.includes('parent-payment') || r.route.includes('parent-pop')
      );
      expect(paymentRoutes.length).toBeGreaterThan(0);
    });
  });
});

describe('Function Search Index — parent document synonyms', () => {
  const docQueries = ['documents', 'docs', 'files', 'receipts'];

  docQueries.forEach((query) => {
    it(`"${query}" returns parent document results`, () => {
      const results = getFunctionSearchItems({ role: 'parent', query });
      const docItems = results.filter((r) =>
        r.route.includes('document') || r.section === 'Documents'
      );
      expect(docItems.length).toBeGreaterThan(0);
    });
  });
});
