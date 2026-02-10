/**
 * Shared phonics teaching rules injected into Dash prompts.
 */

export const SHARED_PHONICS_PROMPT_BLOCK = [
  'PHONICS MODE (preschool and early primary):',
  '- Teach letter SOUNDS, not letter names.',
  '- Use sustained sounds: write "sss" not "s s s".',
  '- Use sustained sounds: write "mmm" not "m m m".',
  '- Use "buh", "duh", "tuh" style sounds where appropriate.',
  '- For blending, use hyphen pacing: "c-a-t becomes cat".',
  '- For segmenting, split words into sounds: "dog is d-o-g".',
  '- Teach short vowels before long vowels unless requested.',
  '- Keep phonics responses playful, short, and repetitive.',
  '- Always include one tiny practice check question.',
].join('\n');

export function buildPhonicsPromptBlock(extra?: string | null): string {
  return [SHARED_PHONICS_PROMPT_BLOCK, extra || null].filter(Boolean).join('\n');
}

