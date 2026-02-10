/**
 * Shared phonics mappings + SSML helpers.
 * Used by prompts, tutor flows, and TTS marker transformation.
 */

export type SupportedPhonicsLanguage = 'en' | 'af' | 'zu';

export type LetterSoundEntry = {
  ipa: string;
  sound: string;
  example: string;
};

export const LETTER_SOUNDS: Record<string, LetterSoundEntry> = {
  a: { ipa: 'æ', sound: 'ah', example: 'apple' },
  b: { ipa: 'b', sound: 'buh', example: 'ball' },
  c: { ipa: 'k', sound: 'kuh', example: 'cat' },
  d: { ipa: 'd', sound: 'duh', example: 'dog' },
  e: { ipa: 'ɛ', sound: 'eh', example: 'egg' },
  f: { ipa: 'f', sound: 'fff', example: 'fish' },
  g: { ipa: 'g', sound: 'guh', example: 'goat' },
  h: { ipa: 'h', sound: 'hhh', example: 'hat' },
  i: { ipa: 'ɪ', sound: 'ih', example: 'igloo' },
  j: { ipa: 'dʒ', sound: 'juh', example: 'jam' },
  k: { ipa: 'k', sound: 'kuh', example: 'kite' },
  l: { ipa: 'l', sound: 'lll', example: 'lion' },
  m: { ipa: 'm', sound: 'mmm', example: 'moon' },
  n: { ipa: 'n', sound: 'nnn', example: 'nest' },
  o: { ipa: 'ɒ', sound: 'oh', example: 'orange' },
  p: { ipa: 'p', sound: 'puh', example: 'pig' },
  q: { ipa: 'k', sound: 'kuh', example: 'queen' },
  r: { ipa: 'ɹ', sound: 'rrr', example: 'rabbit' },
  s: { ipa: 's', sound: 'sss', example: 'sun' },
  t: { ipa: 't', sound: 'tuh', example: 'top' },
  u: { ipa: 'ʌ', sound: 'uh', example: 'umbrella' },
  v: { ipa: 'v', sound: 'vvv', example: 'van' },
  w: { ipa: 'w', sound: 'wuh', example: 'water' },
  x: { ipa: 'ks', sound: 'ks', example: 'box' },
  y: { ipa: 'j', sound: 'yuh', example: 'yellow' },
  z: { ipa: 'z', sound: 'zzz', example: 'zebra' },
};

export const VOWEL_SOUNDS: Record<'short' | 'long', Record<string, LetterSoundEntry>> = {
  short: {
    a: { ipa: 'æ', sound: 'ah', example: 'cat' },
    e: { ipa: 'ɛ', sound: 'eh', example: 'bed' },
    i: { ipa: 'ɪ', sound: 'ih', example: 'sit' },
    o: { ipa: 'ɒ', sound: 'aw', example: 'hot' },
    u: { ipa: 'ʌ', sound: 'uh', example: 'cup' },
  },
  long: {
    a: { ipa: 'eɪ', sound: 'ay', example: 'cake' },
    e: { ipa: 'iː', sound: 'ee', example: 'tree' },
    i: { ipa: 'aɪ', sound: 'eye', example: 'kite' },
    o: { ipa: 'oʊ', sound: 'oh', example: 'home' },
    u: { ipa: 'juː', sound: 'yoo', example: 'cube' },
  },
};

export const BLEND_PATTERNS: Array<{ word: string; segments: string[] }> = [
  { word: 'cat', segments: ['c', 'a', 't'] },
  { word: 'dog', segments: ['d', 'o', 'g'] },
  { word: 'sun', segments: ['s', 'u', 'n'] },
  { word: 'hat', segments: ['h', 'a', 't'] },
  { word: 'pen', segments: ['p', 'e', 'n'] },
  { word: 'bug', segments: ['b', 'u', 'g'] },
  { word: 'run', segments: ['r', 'u', 'n'] },
  { word: 'map', segments: ['m', 'a', 'p'] },
];

export const RHYME_FAMILIES: Record<string, string[]> = {
  at: ['cat', 'hat', 'bat', 'mat'],
  an: ['man', 'fan', 'pan', 'can'],
  ig: ['pig', 'dig', 'wig', 'fig'],
  op: ['top', 'hop', 'mop', 'pop'],
  ug: ['bug', 'hug', 'mug', 'rug'],
};

export const AFRIKAANS_SOUNDS: Record<string, LetterSoundEntry> = {
  a: { ipa: 'ɑ', sound: 'ah', example: 'appel' },
  e: { ipa: 'ɛ', sound: 'eh', example: 'eend' },
  i: { ipa: 'i', sound: 'ee', example: 'vis' },
  o: { ipa: 'o', sound: 'oh', example: 'os' },
  u: { ipa: 'y', sound: 'uu', example: 'uur' },
  g: { ipa: 'x', sound: 'ghh', example: 'goed' },
};

export const ZULU_SYLLABLES = ['ba', 'be', 'bi', 'bo', 'bu', 'ma', 'me', 'mi', 'mo', 'mu'];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getLanguageLetterMap(language: SupportedPhonicsLanguage) {
  if (language === 'af') {
    return { ...LETTER_SOUNDS, ...AFRIKAANS_SOUNDS };
  }
  return LETTER_SOUNDS;
}

function getLetterEntry(letter: string, language: SupportedPhonicsLanguage): LetterSoundEntry | null {
  const key = String(letter || '').trim().toLowerCase();
  if (!key || key.length !== 1) return null;
  const map = getLanguageLetterMap(language);
  return map[key] || LETTER_SOUNDS[key] || null;
}

export function getPhonemeSSML(letter: string, language: SupportedPhonicsLanguage = 'en'): string {
  const entry = getLetterEntry(letter, language);
  if (!entry) return escapeXml(letter);
  return `<phoneme alphabet="ipa" ph="${escapeXml(entry.ipa)}">${escapeXml(entry.sound)}</phoneme>`;
}

export function buildLetterSoundSSML(letter: string, language: SupportedPhonicsLanguage = 'en'): string {
  const entry = getLetterEntry(letter, language);
  if (!entry) return escapeXml(letter);
  return `${getPhonemeSSML(letter, language)} <break time="300ms"/> ${escapeXml(entry.example)}`;
}

export function buildBlendingSSML(word: string, language: SupportedPhonicsLanguage = 'en'): string {
  const letters = String(word || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .split('')
    .filter(Boolean);
  if (letters.length === 0) return '';

  const segments = letters
    .map((letter) => `${getPhonemeSSML(letter, language)}<break time="400ms"/>`)
    .join(' ');

  return `${segments} <break time="450ms"/> ${escapeXml(letters.join(''))}`;
}

export function convertPhonicsMarkersToSSML(
  text: string,
  language: SupportedPhonicsLanguage = 'en'
): string {
  let next = String(text || '');

  // /b/ or [b]
  next = next.replace(/\/([a-z])\//gi, (_, letter: string) => getPhonemeSSML(letter, language));
  next = next.replace(/\[([a-z])\]/gi, (_, letter: string) => getPhonemeSSML(letter, language));

  // c-a-t style blending.
  next = next.replace(/\b([a-z](?:-[a-z]){1,7})\b/gi, (match) => {
    const letters = match.split('-').map((v) => v.trim()).filter(Boolean);
    if (letters.some((letter) => letter.length !== 1)) return match;
    return buildBlendingSSML(letters.join(''), language);
  });

  return next;
}

