import { SHARED_PHONICS_PROMPT_BLOCK, buildPhonicsCoachingHint } from '../phonicsPrompt';

describe('phonicsPrompt', () => {
  it('enforces sound-first blending guidance', () => {
    expect(SHARED_PHONICS_PROMPT_BLOCK).toContain('/k/ - /a/ - /t/ ... cat');
    expect(SHARED_PHONICS_PROMPT_BLOCK).toContain('c says /k/, a says /a/, t says /t/');
  });

  it('does not use orthography-first blend wording', () => {
    expect(SHARED_PHONICS_PROMPT_BLOCK).not.toContain('c-a-t becomes cat');
  });

  it('buildPhonicsCoachingHint returns mouth tip for known phonemes', () => {
    const hint = buildPhonicsCoachingHint('s', 'en-ZA');
    expect(hint).not.toBeNull();
    expect(hint).toContain('COACHING');
    expect(hint).toContain('/s/');
    expect(hint).toContain('tongue');
  });

  it('buildPhonicsCoachingHint returns null for unknown phoneme', () => {
    const hint = buildPhonicsCoachingHint('xyz', 'en-ZA');
    expect(hint).toBeNull();
  });
});
