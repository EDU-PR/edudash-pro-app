/**
 * Shared text normalization for all Dash TTS paths.
 * Keeps pronunciation consistent across mobile/web/edge proxies.
 *
 * Uses the central pronunciation dictionary for brand names, SA language
 * names, abbreviations, and educational terms.
 *
 * @see pronunciationDictionary.ts — master SSML pronunciation lookup
 */

import { applyPronunciationPlainText } from './pronunciationDictionary';

export interface TTSNormalizeOptions {
  expandContractions?: boolean;
  phonicsMode?: boolean;
  preservePhonicsMarkers?: boolean;
}

const CONTRACTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bI'm\b/gi, 'I am'],
  [/\bI've\b/gi, 'I have'],
  [/\bI'll\b/gi, 'I will'],
  [/\bI'd\b/gi, 'I would'],
  [/\byou're\b/gi, 'you are'],
  [/\byou've\b/gi, 'you have'],
  [/\byou'll\b/gi, 'you will'],
  [/\bwe're\b/gi, 'we are'],
  [/\bwe've\b/gi, 'we have'],
  [/\bwe'll\b/gi, 'we will'],
  [/\bthey're\b/gi, 'they are'],
  [/\bthey've\b/gi, 'they have'],
  [/\bcan't\b/gi, 'cannot'],
  [/\bwon't\b/gi, 'will not'],
  [/\bdon't\b/gi, 'do not'],
  [/\bdoesn't\b/gi, 'does not'],
  [/\bdidn't\b/gi, 'did not'],
  [/\bisn't\b/gi, 'is not'],
  [/\baren't\b/gi, 'are not'],
  [/\bwasn't\b/gi, 'was not'],
  [/\bweren't\b/gi, 'were not'],
];

/** Map of common sustained-sound text to their single-letter marker */
const SUSTAINED_SOUND_MAP: Record<string, string> = {
  sss: 's', mmm: 'm', fff: 'f', zzz: 'z', nnn: 'n', lll: 'l',
  rrr: 'r', vvv: 'v', hhh: 'h',
  buh: 'b', duh: 'd', tuh: 't', puh: 'p', guh: 'g', kuh: 'k',
  juh: 'j', wuh: 'w', yuh: 'y',
  ah: 'a', eh: 'e', ih: 'i', aw: 'o', uh: 'u',
};

function normalizeEduDashBrandForms(text: string): string {
  return text
    // "E D U DashPro" / "E.D.U Dash Pro" -> "EduDash Pro"
    .replace(/\bE[\s.\-]*D[\s.\-]*U[\s.\-]*DASH[\s-]*PRO\b/gi, 'EduDash Pro')
    // "Edu Dash Pro" / "Edu-Dash-Pro" -> "EduDash Pro"
    .replace(/\bEDU[\s-]*DASH[\s-]*PRO\b/gi, 'EduDash Pro')
    // "EduDashPro" -> "EduDash Pro"
    .replace(/\bEduDashPro\b/g, 'EduDash Pro');
}

function normalizePhonicsMarkers(
  text: string,
  phonicsMode: boolean,
  preservePhonicsMarkers: boolean
): string {
  let next = String(text || '');

  // Canonicalize loose marker spacing first: "/ s /" -> "/s/", "[ sh ]" -> "[sh]"
  next = next.replace(/\/\s*([a-z]{1,6})\s*\//gi, (_m, token: string) => {
    const normalized = String(token || '').toLowerCase();
    return phonicsMode && preservePhonicsMarkers ? `/${normalized}/` : normalized;
  });
  next = next.replace(/\[\s*([a-z]{1,6})\s*\]/gi, (_m, token: string) => {
    const normalized = String(token || '').toLowerCase();
    return phonicsMode && preservePhonicsMarkers ? `[${normalized}]` : normalized;
  });

  // In non-phonics speech paths, markers should never be spoken literally.
  if (!phonicsMode || !preservePhonicsMarkers) {
    next = next
      .replace(/\/([a-z]{1,6})\//gi, '$1')
      .replace(/\[([a-z]{1,6})\]/gi, '$1');
  }

  return next;
}

function collapseRepeatedLetterSounds(text: string, phonicsMode: boolean): string {
  // 1. Convert spaced repetitions: "s s s" → "/s/"
  let result = text.replace(
    /\b([b-df-hj-np-tv-z])(?:[\s,;:/\\|._-]+\1){1,8}\b/gi,
    (match, letter: string) => {
      const lower = letter.toLowerCase();
      if (phonicsMode) {
        return `/${lower}/`;
      }
      const repeats = match
        .replace(/[^\w\s-]/g, ' ')
        .split(/[\s-]+/)
        .filter(Boolean).length;
      const size = Math.max(3, Math.min(6, repeats));
      return lower.repeat(size);
    }
  );

  // 2. In phonics mode, convert sustained-sound words to slash markers:
  //    "sss" → "/s/", "buh" → "/b/", "mmm" → "/m/", etc.
  if (phonicsMode) {
    const sustainedPattern = new RegExp(
      `\\b(${Object.keys(SUSTAINED_SOUND_MAP).join('|')})\\b`,
      'gi'
    );
    result = result.replace(sustainedPattern, (match) => {
      const letter = SUSTAINED_SOUND_MAP[match.toLowerCase()];
      return letter ? `/${letter}/` : match;
    });
  }

  return result;
}

function normalizeChoiceLabels(text: string): string {
  let next = String(text || '');

  // Preserve multiple-choice labels so TTS reads them as alphabet options
  // instead of blending into the answer value (e.g., "A)42" -> "Option A. 42").
  next = next.replace(
    /(^|[\n\r]\s*|[;:]\s*|,\s*|\s+)\(([a-hA-H])\)\s*(?=\S)/g,
    (_m, prefix: string, label: string) => `${prefix}Option ${label.toUpperCase()}. `
  );
  next = next.replace(
    /(^|[\n\r]\s*|[;:]\s*|,\s*|\s+)([a-hA-H])\)\s*(?=\S)/g,
    (_m, prefix: string, label: string) => `${prefix}Option ${label.toUpperCase()}. `
  );
  next = next.replace(
    /(^|[\n\r]\s*|[;:]\s*|,\s*|\s+)\[([A-H])\]\s*(?=\S)/g,
    (_m, prefix: string, label: string) => `${prefix}Option ${label.toUpperCase()}. `
  );
  next = next.replace(
    /\bOption ([A-H])\.(?=\S)/g,
    (_m, label: string) => `Option ${label}. `
  );

  return next;
}

function normalizeSouthAfricanLanguageNames(text: string): string {
  return text
    .replace(/\bi\s*s\s*i\s+zulu\b/gi, 'isiZulu')
    .replace(/\bi\s*s\s*i\s+xhosa\b/gi, 'isiXhosa')
    .replace(/\bi\s*s\s*i\s+ndebele\b/gi, 'isiNdebele')
    .replace(/\bisi\s+zulu\b/gi, 'isiZulu')
    .replace(/\bisi\s+xhosa\b/gi, 'isiXhosa')
    .replace(/\bisi\s+ndebele\b/gi, 'isiNdebele')
    .replace(/\bse\s+pedi\b/gi, 'Sepedi')
    .replace(/\bse\s+sotho\b/gi, 'Sesotho');
}

function stripMarkdownAndMeta(text: string, preservePhonicsMarkers: boolean): string {
  let next = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+\u2022\u25e6\u25aa\u00b7]\s*/gm, '')
    .replace(/^\s*\d+[.)]\s*/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^>\s*/gm, '');

  if (!preservePhonicsMarkers) {
    next = next.replace(/\[.*?\]/g, '');
  }

  return next
    .replace(/_Tools used:.*?_/gi, '')
    .replace(/_.*?tokens used_/gi, '')
    .replace(/^\s*(?:[^\w\s]\s*)*tools?\s*used\s*:.*$/gim, '')
    .replace(/^\s*(?:[^\w\s]\s*)*\d[\d,\s]*(?:\.\d+)?\s*tokens?\s*used\b.*$/gim, '')
    .replace(/^\s*(?:[^\w\s]\s*)*tokens?\s*used\b.*$/gim, '');
}

function stripEmojiAndSymbols(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{200D}]/gu, '');
}

export function normalizeForTTS(input: string, options: TTSNormalizeOptions = {}): string {
  const {
    expandContractions = true,
    phonicsMode = false,
    preservePhonicsMarkers = phonicsMode,
  } = options;

  let text = String(input || '')
    .replace(/\r\n/g, '\n')
    .replace(/[“”«»"]/g, '')
    .replace(/[‘’]/g, "'");

  if (!text.trim()) return '';

  if (expandContractions) {
    for (const [pattern, replacement] of CONTRACTION_REPLACEMENTS) {
      text = text.replace(pattern, replacement);
    }
  }

  text = stripMarkdownAndMeta(text, preservePhonicsMarkers);
  text = stripEmojiAndSymbols(text);
  text = normalizeChoiceLabels(text);
  text = normalizeEduDashBrandForms(text);

  // Apply pronunciation dictionary (brand names, SA languages, acronyms)
  text = applyPronunciationPlainText(text);

  // Normalize any remaining SA language name spacing issues
  text = normalizeSouthAfricanLanguageNames(text);

  // Keep marker punctuation in phonics mode.
  text = preservePhonicsMarkers
    ? text.replace(/[(){}<>]/g, '')
    : text.replace(/[()[\]{}<>]/g, '');

  text = collapseRepeatedLetterSounds(text, phonicsMode);
  text = normalizePhonicsMarkers(text, phonicsMode, preservePhonicsMarkers);

  return text
    .replace(/\bIt socks\b/g, "It's socks")
    .replace(/\bit socks\b/g, "it's socks")
    .replace(/\bCorrect answer:\s*/gi, '')
    .replace(/\bNext question:\s*/gi, '')
    .replace(/\bHint:\s*/gi, 'Hint. ')
    .replace(/^\s*User:\s*/gmi, '')
    .replace(/^\s*Assistant:\s*/gmi, '')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '. ')
    .trim();
}

export function normalizeForTTSPhonics(input: string): string {
  return normalizeForTTS(input, {
    expandContractions: true,
    phonicsMode: true,
    preservePhonicsMarkers: true,
  });
}
