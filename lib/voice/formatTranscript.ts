type SupportedLang = 'en' | 'af' | 'zu';

export interface TranscriptFormatOptions {
  whisperFlow?: boolean;
  summarize?: boolean;
  preschoolMode?: boolean;
  maxSummaryWords?: number;
}

const detectLanguage = (locale?: string | null): SupportedLang => {
  const short = (locale || 'en').toLowerCase();
  if (short.startsWith('af')) return 'af';
  if (short.startsWith('zu')) return 'zu';
  return 'en';
};

const QUESTION_STARTERS: Record<SupportedLang, string[]> = {
  en: [
    'who', 'what', 'where', 'when', 'why', 'how',
    'can', 'could', 'should', 'is', 'are', 'do', 'does', 'did',
    'will', 'would', 'may', 'might', 'am', 'was', 'were',
    'please', 'tell me', 'help me', 'explain', 'show me', 'give me',
  ],
  af: [
    'wie', 'wat', 'waar', 'wanneer', 'hoekom', 'waarom', 'hoe',
    'kan', 'sal', 'sou', 'moet', 'is', 'was', 'wil', 'mag', 'het',
    'help my', 'verduidelik', 'sê vir my',
  ],
  zu: [
    'ngubani', 'yini', 'kuphi', 'nini', 'kungani', 'ngani', 'kanjani',
    'ingabe', 'ngicela', 'ungangisiza', 'ungachaza', 'siza',
  ],
};

const FILLER_PATTERNS: Array<[RegExp, string]> = [
  [/\b(um+|uh+|erm+|hmm+)\b/gi, ''],
  [/\b(you know|like|sort of|kind of|basically|actually)\b/gi, ''],
  [/\b(i mean)\b/gi, ''],
];

const COMMON_STT_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bit socks\b/gi, "it's socks"],
  [/\bsummeriz(e|ing|ed|er)\b/gi, 'summarize$1'],
  [/\bsend comma\b/gi, 'send,'],
  [/\bnew line\b/gi, '. '],
  [/\bfull stop\b/gi, '.'],
  [/\bquestion mark\b/gi, '?'],
];

const looksLikeQuestion = (text: string, lang: SupportedLang): boolean => {
  const lower = text.toLowerCase();
  return QUESTION_STARTERS[lang].some((starter) => {
    return (
      lower === starter ||
      lower.startsWith(`${starter} `) ||
      lower.startsWith(`${starter},`) ||
      lower.startsWith(`${starter}?`)
    );
  });
};

const collapseDuplicateWords = (text: string): string => {
  // "please please help me" -> "please help me"
  return text.replace(/\b([a-z']+)(?:\s+\1){1,4}\b/gi, '$1');
};

const applyWhisperFlowAutoEdits = (
  input: string,
  lang: SupportedLang,
  preschoolMode: boolean
): string => {
  let next = input;

  for (const [pattern, replacement] of COMMON_STT_CORRECTIONS) {
    next = next.replace(pattern, replacement);
  }

  if (!preschoolMode) {
    for (const [pattern, replacement] of FILLER_PATTERNS) {
      next = next.replace(pattern, replacement);
    }
  }

  next = collapseDuplicateWords(next);

  if (lang === 'en') {
    next = next.replace(/\bi\b/g, 'I');
  }

  return next.replace(/\s{2,}/g, ' ').trim();
};

const summarizeTranscriptIntent = (
  text: string,
  lang: SupportedLang,
  maxWords = 20
): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const words = normalized.split(' ').filter(Boolean);
  if (words.length <= maxWords) return normalized;

  // Keep phonics utterances untouched to avoid losing teaching markers.
  if (/[\/\[]([a-z]{1,8})[\/\]]/i.test(normalized) || /\bphonics\b/i.test(normalized)) {
    return normalized;
  }

  const sentences = normalized
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const questionSentence = sentences.find((s) => looksLikeQuestion(s, lang) || /\?$/.test(s));
  const candidate = questionSentence || sentences[0] || normalized;
  const candidateWords = candidate.split(' ').filter(Boolean);

  if (candidateWords.length <= maxWords) return candidate;

  const trimmed = candidateWords.slice(0, maxWords).join(' ');
  return /[.?!]$/.test(trimmed) ? trimmed : `${trimmed}...`;
};

const normalizePhonicsTranscript = (text: string, lang: SupportedLang): string => {
  if (lang !== 'en') return text;
  let next = text;

  // Common STT confusion when learner says "letter sound ..."
  next = next.replace(/\b(latest|later|late)\s+sound\s+([a-z])\b/gi, 'letter sound /$2/');
  next = next.replace(/\bletter\s+sound\s+([a-z])\b/gi, 'letter sound /$1/');
  next = next.replace(/\bthe\s+sound\s+is\s+([a-z])\b/gi, 'the sound is /$1/');
  next = next.replace(/\bsound\s+([a-z])\b/gi, 'sound /$1/');

  // Repeated single letters become one phoneme marker.
  next = next.replace(
    /\b([b-df-hj-np-tv-z])(?:[\s,;:/\\|._-]+\1){1,8}\b/gi,
    (_, letter: string) => `/${String(letter || '').toLowerCase()}/`
  );

  return next;
};

export const formatTranscript = (
  rawText: string,
  locale?: string | null,
  options: TranscriptFormatOptions = {}
): string => {
  return formatTranscriptWithOptions(rawText, locale, options);
};

export const formatTranscriptWithOptions = (
  rawText: string,
  locale?: string | null,
  options: TranscriptFormatOptions = {}
): string => {
  const {
    whisperFlow = true,
    summarize = false,
    preschoolMode = false,
    maxSummaryWords = 20,
  } = options;

  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const lang = detectLanguage(locale);
  let result = cleaned.replace(/\s+([?.!])/g, '$1');
  result = normalizePhonicsTranscript(result, lang);

  if (whisperFlow) {
    result = applyWhisperFlowAutoEdits(result, lang, preschoolMode);
  }

  result = result.charAt(0).toUpperCase() + result.slice(1);

  const hasTerminalPunctuation = /[.?!]$/.test(result);
  if (!hasTerminalPunctuation) {
    result += looksLikeQuestion(result, lang) ? '?' : '.';
  } else {
    const trailing = result.match(/[.?!]+$/);
    if (trailing && trailing[0].length > 1) {
      result = result.slice(0, -trailing[0].length) + trailing[0].slice(-1);
    }
  }

  if (summarize) {
    result = summarizeTranscriptIntent(result, lang, maxSummaryWords);
  }

  return result;
};

export const formatTranscriptSmart = formatTranscriptWithOptions;
