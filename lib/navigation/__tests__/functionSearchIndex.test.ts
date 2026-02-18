import { getFunctionSearchItems } from '../functionSearchIndex';

describe('functionSearchIndex', () => {
  it('returns focused results for payments', () => {
    const results = getFunctionSearchItems({ role: 'parent', query: 'payments', scope: 'all' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.route).toBe('/screens/parent-payments');
  });

  it('keeps Dash scope strict for non-Dash queries', () => {
    const results = getFunctionSearchItems({ role: 'parent', query: 'payments', scope: 'dash' });
    expect(results).toHaveLength(0);
  });

  it('returns empty list for unrelated query tokens', () => {
    const results = getFunctionSearchItems({ role: 'teacher', query: 'zzzznotafeature', scope: 'all' });
    expect(results).toHaveLength(0);
  });
});
