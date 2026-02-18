import type { ThemeColors } from '@/contexts/ThemeContext';
import { nextGenPalette as p } from './nextGenTokens';

export interface NextGenThemeOverrides {
  root: Partial<ThemeColors>;
  aliases: Partial<ThemeColors['colors']>;
}

export const getNextGenThemeOverrides = (isDark: boolean): NextGenThemeOverrides => {
  const background = isDark ? p.bg0 : '#F5F7FF';
  const chrome = isDark ? p.bg1 : '#EEF3FF';
  const elevated = isDark ? p.bg2 : '#FFFFFF';

  return {
    root: {
      background,
      surface: p.glass,
      surfaceVariant: p.glassStrong,
      elevated,
      cardBackground: p.glass,
      card: p.glass,
      border: p.border,
      borderLight: 'rgba(255,255,255,0.08)',
      divider: 'rgba(255,255,255,0.08)',
      text: p.text,
      textSecondary: p.textMuted,
      textTertiary: p.textSubtle,
      muted: p.textSubtle,
      primary: p.purple2,
      primaryLight: p.purple3,
      primaryDark: p.purple1,
      secondary: p.green2,
      secondaryLight: p.green3,
      secondaryDark: p.green1,
      success: p.success,
      warning: p.warning,
      error: p.danger,
      headerBackground: chrome,
      headerText: p.text,
      headerTint: p.purple3,
      modalBackground: elevated,
      shadow: 'rgba(0,0,0,0.35)',
      inputBackground: 'rgba(255,255,255,0.06)',
      inputBorder: 'rgba(255,255,255,0.12)',
      inputBorderFocused: p.purple3,
      inputText: p.text,
      inputPlaceholder: p.textSubtle,
    },
    aliases: {
      primary: p.purple2,
      onPrimary: '#FFFFFF',
      primaryContainer: p.purple1,
      onPrimaryContainer: '#EDE9FE',
      surface: p.glass,
      surfaceVariant: p.glassStrong,
      onSurface: p.text,
      onSurfaceVariant: p.textMuted,
      outline: p.border,
      background,
      error: p.danger,
      errorContainer: 'rgba(255,92,92,0.18)',
      onErrorContainer: '#FFE4E4',
      onBackground: p.text,
      text: p.text,
      textSecondary: p.textMuted,
      border: p.border,
      success: p.success,
      warning: p.warning,
      info: p.purple3,
      disabled: p.textSubtle,
      cardBackground: p.glass,
    },
  };
};

export const createNextGenTheme = (base: ThemeColors, isDark: boolean): ThemeColors => {
  const overrides = getNextGenThemeOverrides(isDark);
  return {
    ...base,
    ...overrides.root,
    colors: {
      ...base.colors,
      ...overrides.aliases,
    },
  };
};
