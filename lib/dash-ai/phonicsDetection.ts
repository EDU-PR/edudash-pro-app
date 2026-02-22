/**
 * Deterministic phonics intent detection used across Dash voice + tutor flows.
 */

export interface PhonicsDetectionContext {
  ageYears?: number | null;
  organizationType?: string | null;
  gradeLevel?: string | null;
  schoolType?: string | null;
}

const PHONICS_EXPLICIT_PATTERNS: RegExp[] = [
  /\bphonics\b/i,
  /\bletter\s+sounds?\b/i,
  /\bthe\s+letter\s+[a-z]\s+makes\b/i,
  /\bwhat\s+sound\s+does\s+[a-z]\s+make\b/i,
  /\b(?:letter|phoneme)\s+sound\s+(?:is|for)?\s*[a-z]\b/i,
  /\/[a-z]{1,3}\//i,
  /\[[a-z]{1,3}\]/i,
  /\b[a-z]-[a-z](?:-[a-z])+\b/i,
  /\b(short|long)\s+vowel\b/i,
  // Spaced letter repetitions ("s s s", "m m m", "a a a") — AI sometimes outputs these instead of /s/
  /\b([a-z])\s+\1(?:\s+\1){0,7}\b/i,
  // Sustained sounds ("sss", "mmm", "aaa", "eee") — ensure we use phonics TTS for these
  /\b(sss|mmm|fff|zzz|nnn|lll|rrr|vvv|hhh|aaa|eee|iii|ooo|uuu|buh|duh|tuh|puh|guh|kuh|juh|wuh|yuh)\b/i,
];

const PHONICS_CONTEXTUAL_PATTERNS: RegExp[] = [
  /\bblend(?:ing)?\b/i,
  /\bsegment(?:ing)?\b/i,
  /\brhyme(?:s|ing)?\b/i,
  /\bvowel(?:s)?\b/i,
  /\bconsonant(?:s)?\b/i,
  /\bphoneme(?:s)?\b/i,
  /\balphabet\b/i,
  /\bsound(?:ing)?\s+out\b/i,
];

const PHONICS_CONTEXT_GUARD =
  /\b(letter|letters|sound|phonics|phoneme|word|words|syllable|reading|spell(?:ing)?)\b/i;

const PRESCHOOL_GRADES = new Set(['pre-r', 'pre r', 'grade r', 'r', 'grade 1', '1']);

export function isPreschoolContext(context?: PhonicsDetectionContext | null): boolean {
  if (!context) return false;
  const org = String(context.organizationType || context.schoolType || '').toLowerCase();
  if (org.includes('preschool') || org.includes('ecd') || org.includes('early')) return true;

  if (typeof context.ageYears === 'number' && context.ageYears <= 6) return true;
  const grade = String(context.gradeLevel || '').trim().toLowerCase();
  return PRESCHOOL_GRADES.has(grade);
}

export function detectPhonicsIntent(text: string): boolean {
  const value = String(text || '').trim();
  if (!value) return false;
  if (PHONICS_EXPLICIT_PATTERNS.some((pattern) => pattern.test(value))) {
    return true;
  }

  const hasContextualCue = PHONICS_CONTEXTUAL_PATTERNS.some((pattern) => pattern.test(value));
  return hasContextualCue && PHONICS_CONTEXT_GUARD.test(value);
}

export function shouldUsePhonicsMode(
  text: string,
  context?: PhonicsDetectionContext | null
): boolean {
  const explicit = detectPhonicsIntent(text);
  if (explicit) return true;
  if (!context) return false;

  // In preschool contexts, allow a narrow set of reading/phonics cues
  // while avoiding broad false positives from normal conversational "sound/read".
  if (!isPreschoolContext(context)) return false;
  return /\b(letter(?:s)?\s+sound|letters?|phoneme|alphabet|sound\s+out|rhym(?:e|ing)|blend(?:ing)?|segment(?:ing)?|reading\s+letters?|reading\s+words?|spell(?:ing)?)\b/i.test(text || '');
}
