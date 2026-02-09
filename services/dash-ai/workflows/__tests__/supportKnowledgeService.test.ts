import {
  getSupportKnowledgeSeedCount,
  searchSupportKnowledge,
} from '../SupportKnowledgeService';

describe('SupportKnowledgeService', () => {
  it('returns grounded snippets for support queries', () => {
    const result = searchSupportKnowledge('payment not reflecting and receipt verification', {
      limit: 3,
    });

    expect(result.snippets.length).toBeGreaterThan(0);
    expect(result.confidence_score).toBeGreaterThan(0.2);
    expect(result.snippets[0]).toEqual(
      expect.objectContaining({
        source: expect.stringContaining('kb://'),
        title: expect.any(String),
        snippet: expect.any(String),
      })
    );
  });

  it('returns low confidence when nothing matches', () => {
    const result = searchSupportKnowledge('xqvzzw lmnopq zzxx unknown token set', {
      limit: 3,
    });

    expect(result.snippets).toHaveLength(0);
    expect(result.confidence_score).toBeLessThanOrEqual(0.2);
  });

  it('exposes seed size for diagnostics', () => {
    expect(getSupportKnowledgeSeedCount()).toBeGreaterThan(0);
  });
});
