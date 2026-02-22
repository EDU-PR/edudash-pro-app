const STRIP_PUNCTUATION = /[.,!?;:()[\]{}"'`~@#$%^&*_+=<>|\\/-]+/g;

export function normalizeTranscript(input: string): string {
  const value = String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(STRIP_PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return value;
}

export function tokenizeTranscript(input: string): string[] {
  const normalized = normalizeTranscript(input);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}
