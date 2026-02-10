/**
 * Shared text normalization for all Dash TTS paths.
 * Keeps pronunciation consistent across mobile/web/edge proxies.
 */

export interface TTSNormalizeOptions {
  expandContractions?: boolean;
  phonicsMode?: boolean;
  preservePhonicsMarkers?: boolean;
}

const ACRONYM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bEduDash Pro\b/gi, 'Edu Dash Pro'],
  [/\bAPI\b/g, 'A P I'],
  [/\bHTTP\b/g, 'H T T P'],
  [/\bJSON\b/g, 'J S O N'],
  [/\bSQL\b/g, 'S Q L'],
  [/\bRLS\b/g, 'R L S'],
  [/\bRBAC\b/g, 'R B A C'],
  [/\bSTT\b/g, 'speech to text'],
  [/\bTTS\b/g, 'text to speech'],
  [/\bAI\b/g, 'A.I.'],
  [/\bCAPS\b/g, 'caps'],
  [/\bSTEM\b/g, 'stem'],
];

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

function collapseRepeatedLetterSounds(text: string): string {
  return text.replace(/\b([b-df-hj-np-tv-z])(?:[\s-]+\1){2,8}\b/gi, (match, letter: string) => {
    const repeats = match.split(/[\s-]+/).length;
    const size = Math.max(3, Math.min(6, repeats));
    return letter.toLowerCase().repeat(size);
  });
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
    .replace(/_.*?tokens used_/gi, '');
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

  for (const [pattern, replacement] of ACRONYM_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = normalizeSouthAfricanLanguageNames(text);

  // Keep marker punctuation in phonics mode.
  text = preservePhonicsMarkers
    ? text.replace(/[(){}<>]/g, '')
    : text.replace(/[()[\]{}<>]/g, '');

  text = collapseRepeatedLetterSounds(text);

  return text
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

