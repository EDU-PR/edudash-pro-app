type SupportedLang = 'en' | 'af' | 'zu';

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

export const formatTranscript = (rawText: string, locale?: string | null): string => {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const lang = detectLanguage(locale);
  let result = cleaned.replace(/\s+([?.!])/g, '$1');

  if (lang === 'en') {
    result = result.replace(/\bi\b/g, 'I');
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

  return result;
};
