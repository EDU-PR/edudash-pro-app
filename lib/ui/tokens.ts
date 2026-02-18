export const uiTokens = {
  colors: {
    brandPrimary: '#6366F1',
    brandAccent: '#8B5CF6',
    success: '#16A34A',
    danger: '#DC2626',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  typography: {
    caption: 11,
    body: 14,
    title: 18,
  },
} as const;

export type UITokens = typeof uiTokens;
