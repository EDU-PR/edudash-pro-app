/**
 * Shared phonics teaching rules injected into Dash prompts.
 */

import { getMouthTip } from './phonemeLookup';
import type { PhonemeLanguage } from './phonemeLookup';

export const SHARED_PHONICS_PROMPT_BLOCK = [
  'PHONICS MODE (preschool and early primary):',
  '- Teach letter SOUNDS, not letter names.',
  '- CRITICAL: Always wrap single-letter sounds in slash markers: /s/, /m/, /b/, /a/, /t/, etc.',
  '- The voice system will automatically sustain continuant sounds (/s/, /f/, /m/, /n/, /l/, /r/, /v/, /z/, /h/) so they sound like "sssss" to the child. You only need to write /s/.',
  '- Example: "The letter S makes the sound /s/" — Dash will voice this as a long hissing /sssss/ sound.',
  '- Example: "M says /m/. Can you feel your lips press together?"',
  '- For stop consonants use slash markers too: /b/, /d/, /t/, /p/, /g/, /k/.',
  '- For vowels: /a/ (as in apple), /e/ (as in egg), /i/ (as in igloo), /o/ (as in orange), /u/ (as in umbrella).',
  '- For blending, model sounds first: "/k/ - /a/ - /t/ ... cat".',
  '- If showing letters, map each letter to a sound in the same line: "c says /k/, a says /a/, t says /t/".',
  '- If you show letter sequencing, keep it secondary support after the sound model (never the primary blend model).',
  '- For segmenting, split words into sounds with slash markers: "dog is /d/ - /o/ - /g/".',
  '- Teach short vowels before long vowels unless requested.',
  '- Keep phonics responses playful, short, and repetitive.',
  '- ALWAYS end with an explicit practice invitation: "Can you say /s/?" — this prompts the child to speak.',
  '- NEVER use [WHITEBOARD] tags during phonics teaching — speak everything directly to the child.',
  '- NEVER write bare repeated letters like "sss", "mmm" — always use /s/, /m/ slash markers instead.',
].join('\n');

export function buildPhonicsPromptBlock(extra?: string | null): string {
  return [SHARED_PHONICS_PROMPT_BLOCK, extra || null].filter(Boolean).join('\n');
}

/**
 * Build a coaching hint block for when learner accuracy < 60.
 * Injects mouth tip from phonemeLookup so Dash can coach: "Try this: [mouthTip]"
 */
export function buildPhonicsCoachingHint(
  phonemeOrKey: string,
  lang: PhonemeLanguage = 'en-ZA'
): string | null {
  const key = String(phonemeOrKey || '').trim().toLowerCase();
  if (!key) return null;
  const tip =
    getMouthTip(key, lang) ??
    getMouthTip(`long_${key}`, lang) ??
    getMouthTip(`short_${key}`, lang);
  if (!tip) return null;
  return `COACHING (learner struggled with /${key}/): Include this mouth tip in your next response: "${tip}"`;
}
