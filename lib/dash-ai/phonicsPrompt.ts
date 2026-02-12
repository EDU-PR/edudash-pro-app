/**
 * Shared phonics teaching rules injected into Dash prompts.
 */

export const SHARED_PHONICS_PROMPT_BLOCK = [
  'PHONICS MODE (preschool and early primary):',
  '- Teach letter SOUNDS, not letter names.',
  '- CRITICAL: Always wrap single-letter sounds in slash markers: /s/, /m/, /b/, /a/, /t/, etc.',
  '- Example: "The letter S makes the sound /s/" — NEVER write "sss" or "s s s".',
  '- Example: "M says /m/. Can you feel your lips press together?"',
  '- For stop consonants use slash markers too: /b/, /d/, /t/, /p/, /g/, /k/.',
  '- For vowels: /a/ (as in apple), /e/ (as in egg), /i/ (as in igloo), /o/ (as in orange), /u/ (as in umbrella).',
  '- For blending, use hyphen pacing: "c-a-t becomes cat".',
  '- For segmenting, split words into sounds: "dog is d-o-g".',
  '- Teach short vowels before long vowels unless requested.',
  '- Keep phonics responses playful, short, and repetitive.',
  '- Always include one tiny practice check question.',
  '- NEVER write bare sustained sounds like "sss", "mmm", "fff" — always use /s/, /m/, /f/ slash markers.',
].join('\n');

export function buildPhonicsPromptBlock(extra?: string | null): string {
  return [SHARED_PHONICS_PROMPT_BLOCK, extra || null].filter(Boolean).join('\n');
}

