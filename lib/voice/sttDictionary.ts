/**
 * STT Dictionary — Domain-specific vocabulary for speech recognition
 *
 * Provides:
 * 1. `STT_CONTEXTUAL_STRINGS` — biasing hints for expo-speech-recognition
 *    (helps the recognizer prioritise EduDash-relevant words)
 * 2. `STT_CORRECTIONS` — post-hoc regex→string replacements for
 *    commonly misrecognised words and voice-dictation punctuation
 *
 * Shared between expoProvider.ts (contextual strings) and
 * formatTranscript.ts (corrections).
 *
 * Limit: ≤200 lines (WARP.md).
 */

// ── Contextual strings (speech recognizer vocabulary bias) ──────────
// Keep short phrases; Android 12+ / iOS supported.

export const STT_CONTEXTUAL_STRINGS: string[] = [
  // Brand
  'Dash',
  'EduDash',
  'EduDash Pro',
  'Dash AI',
  'Dash Tutor',

  // Commands users say to Dash
  'check',
  'explain',
  'help me',
  'homework',
  'practice',
  'quiz me',
  'test me',
  'mark my work',
  'did I get it right',
  'diagnose',

  // Educational
  'phonics',
  'blending',
  'segmenting',
  'rhyming',
  'CAPS',
  'STEM',
  'Grade R',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'worksheet',
  'lesson',

  // SA languages (frequently spoken in voice input)
  'isiZulu',
  'isiXhosa',
  'isiNdebele',
  'Sepedi',
  'Sesotho',
  'Setswana',
  'Tshivenda',
  'Xitsonga',
  'SiSwati',
  'Afrikaans',

  // SA greetings
  'Sawubona',
  'Molo',
  'Dumela',
  'Thobela',
  'Howzit',
];

// ── Post-hoc STT corrections ────────────────────────────────────────
// Order matters — more specific patterns first.

export const STT_CORRECTIONS: Array<[RegExp, string]> = [
  // ── Existing generic corrections ──
  [/\bit socks\b/gi, "it's socks"],
  [/\bsummeriz(e|ing|ed|er)\b/gi, 'summarize$1'],
  [/\bsend comma\b/gi, 'send,'],
  [/\bnew line\b/gi, '. '],
  [/\bfull stop\b/gi, '.'],
  [/\bquestion mark\b/gi, '?'],
  [/\bexclamation mark\b/gi, '!'],
  [/\bopen bracket\b/gi, '('],
  [/\bclose bracket\b/gi, ')'],
  [/\bcomma\b/gi, ','],

  // ── EduDash brand (common misrecognitions) ──
  [/\bdestruct\b/gi, 'Dash check'],
  [/\bdash\s*check\b/gi, 'Dash check'],
  [/\bedge?\s*dash\b/gi, 'EduDash'],
  [/\bedu\s+dash\b/gi, 'EduDash'],
  [/\bedu\s*-?\s*dash\s+pro\b/gi, 'EduDash Pro'],

  // ── SA language names ──
  [/\bissy?\s*zulu\b/gi, 'isiZulu'],
  [/\bissy?\s*cosa\b/gi, 'isiXhosa'],
  [/\bissy?\s*n?debele\b/gi, 'isiNdebele'],
  [/\bsay?\s*pedy?\b/gi, 'Sepedi'],
  [/\bsay?\s*sotho?\b/gi, 'Sesotho'],
  [/\bset?\s*swana\b/gi, 'Setswana'],
  [/\bsee?\s*swat[ie]\b/gi, 'SiSwati'],
  [/\btshi?\s*venda\b/gi, 'Tshivenda'],
  [/\bsit?\s*songa\b/gi, 'Xitsonga'],

  // ── SA greetings ──
  [/\bsaw?\s*you?\s*bona\b/gi, 'Sawubona'],
  [/\bdo?\s*mela\b/gi, 'Dumela'],
  [/\btho?\s*bela\b/gi, 'Thobela'],

  // ── Educational terms ──
  [/\bcaps\b/g, 'CAPS'],
  [/\bgrade\s*are\b/gi, 'Grade R'],
];
