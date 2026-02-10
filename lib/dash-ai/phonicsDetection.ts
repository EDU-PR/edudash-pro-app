/**
 * Deterministic phonics intent detection used across Dash voice + tutor flows.
 */

export interface PhonicsDetectionContext {
  ageYears?: number | null;
  organizationType?: string | null;
  gradeLevel?: string | null;
  schoolType?: string | null;
}

const PHONICS_PATTERNS: RegExp[] = [
  /\bphonics\b/i,
  /\bletter\s+sounds?\b/i,
  /\bthe\s+letter\s+[a-z]\s+makes\b/i,
  /\bwhat\s+sound\s+does\s+[a-z]\s+make\b/i,
  /\bsounds?\s+like\b/i,
  /\bblend(?:ing)?\b/i,
  /\bsegment(?:ing)?\b/i,
  /\brhyme(?:s|ing)?\b/i,
  /\bvowel(?:s)?\b/i,
  /\/[a-z]\//i,
  /\[[a-z]\]/i,
  /\b[a-z]-[a-z](?:-[a-z])+\b/i,
  /\b(short|long)\s+vowel\b/i,
];

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
  return PHONICS_PATTERNS.some((pattern) => pattern.test(value));
}

export function shouldUsePhonicsMode(
  text: string,
  context?: PhonicsDetectionContext | null
): boolean {
  const explicit = detectPhonicsIntent(text);
  if (explicit) return true;
  if (!context) return false;

  // Preschool users benefit from slower, clearer phoneme pacing even when explicit
  // markers are not present.
  return isPreschoolContext(context) && /\b(letter|sound|read|reading|alphabet)\b/i.test(text || '');
}
