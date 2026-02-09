const INVALID_AVATAR_VALUES = new Set(['null', 'undefined', 'n/a', 'none']);

export const sanitizeAvatarUrl = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (INVALID_AVATAR_VALUES.has(trimmed.toLowerCase())) {
    return null;
  }

  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  return null;
};

export const resolveAvatarUrl = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    const normalized = sanitizeAvatarUrl(value);
    if (normalized) return normalized;
  }

  return null;
};
