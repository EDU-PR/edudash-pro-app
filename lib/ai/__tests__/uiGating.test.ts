/**
 * Integration tests for UI gating helpers
 */

import { canAttach, canSearchHistory } from '../uiGating';
import type { Tier } from '../capabilities';

describe('uiGating', () => {
  describe('canAttach', () => {
    it('denies document attachments for free tier', () => {
      const t: Tier = 'free';
      expect(canAttach(t, ['image']).ok).toBe(true);
      expect(canAttach(t, ['pdf']).ok).toBe(false);
    });

    it('allows search for starter/premium tiers', () => {
      expect(canSearchHistory('starter')).toBe(true);
      expect(canSearchHistory('premium')).toBe(true);
    });

    it('allows images on free tier with daily limits', () => {
      expect(canAttach('free', ['image']).ok).toBe(true);
      expect(canAttach('starter', ['image']).ok).toBe(true);
      expect(canAttach('premium', ['image']).ok).toBe(true);
    });

    it('allows documents only with starter and above', () => {
      expect(canAttach('free', ['pdf']).ok).toBe(false);
      expect(canAttach('starter', ['pdf']).ok).toBe(true);
      expect(canAttach('premium', ['pdf']).ok).toBe(true);
    });

    it('handles mixed attachments', () => {
      const res = canAttach('premium', ['image', 'pdf']);
      expect(res.ok).toBe(true);
      const res2 = canAttach('free', ['image', 'pdf']);
      expect(res2.ok).toBe(false);
      expect(res2.missing).toEqual(expect.arrayContaining(['multimodal.documents']));
    });
  });
});
