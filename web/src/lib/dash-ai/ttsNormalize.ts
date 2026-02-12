/**
 * Lightweight shared text normalization for web TTS paths.
 * Keeps output predictable while avoiding markdown/emoji artifacts.
 */

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

function stripMarkdown(text: string, preservePhonicsMarkers: boolean): string {
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

  return next;
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

function normalizePhonicsMarkers(
  text: string,
  phonicsMode: boolean,
  preservePhonicsMarkers: boolean
): string {
  let next = String(text || '');

  next = next.replace(/\/\s*([a-z]{1,6})\s*\//gi, (_m, token: string) => {
    const normalized = String(token || '').toLowerCase();
    return phonicsMode && preservePhonicsMarkers ? `/${normalized}/` : normalized;
  });

  next = next.replace(/\[\s*([a-z]{1,6})\s*\]/gi, (_m, token: string) => {
    const normalized = String(token || '').toLowerCase();
    return phonicsMode && preservePhonicsMarkers ? `[${normalized}]` : normalized;
  });

  if (!phonicsMode || !preservePhonicsMarkers) {
    next = next
      .replace(/\/([a-z]{1,6})\//gi, '$1')
      .replace(/\[([a-z]{1,6})\]/gi, '$1');
  }

  return next;
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

  text = stripMarkdown(text, preservePhonicsMarkers);
  text = stripEmojiAndSymbols(text);
  text = normalizePhonicsMarkers(text, phonicsMode, preservePhonicsMarkers);

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

