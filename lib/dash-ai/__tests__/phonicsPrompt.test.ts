import { SHARED_PHONICS_PROMPT_BLOCK } from '../phonicsPrompt';

describe('phonicsPrompt', () => {
  it('enforces sound-first blending guidance', () => {
    expect(SHARED_PHONICS_PROMPT_BLOCK).toContain('/k/ - /a/ - /t/ ... cat');
    expect(SHARED_PHONICS_PROMPT_BLOCK).toContain('c says /k/, a says /a/, t says /t/');
  });

  it('does not use orthography-first blend wording', () => {
    expect(SHARED_PHONICS_PROMPT_BLOCK).not.toContain('c-a-t becomes cat');
  });
});
