import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useTheme, type ThemeColors, type ThemeOverride } from '@/contexts/ThemeContext';
import { createNextGenTheme } from '@/contexts/theme/nextGenVariant';

export type K12ThemeOverride = ThemeOverride;

const K12NextGenThemeContext = createContext<ThemeColors | null>(null);

function applyK12ThemeOverride(baseTheme: ThemeColors, override?: K12ThemeOverride): ThemeColors {
  if (!override) return baseTheme;

  const { colors: colorOverride, typography: typographyOverride, ...rootOverride } = override;

  const mergedTypography = (
    Object.keys(baseTheme.typography) as Array<keyof ThemeColors['typography']>
  ).reduce((acc, key) => {
    acc[key] = {
      ...baseTheme.typography[key],
      ...(typographyOverride?.[key] || {}),
    };
    return acc;
  }, {} as ThemeColors['typography']);

  return {
    ...baseTheme,
    ...rootOverride,
    colors: {
      ...baseTheme.colors,
      ...(colorOverride || {}),
    },
    typography: mergedTypography,
  };
}

export function K12NextGenThemeProvider({
  children,
  override,
}: {
  children: ReactNode;
  override?: K12ThemeOverride;
}) {
  const { theme, isDark } = useTheme();
  const inheritedTheme = useContext(K12NextGenThemeContext);

  const nextGenTheme = useMemo(() => {
    const baseTheme = inheritedTheme || createNextGenTheme(theme, isDark);
    return applyK12ThemeOverride(baseTheme, override);
  }, [inheritedTheme, override, theme, isDark]);

  return (
    <K12NextGenThemeContext.Provider value={nextGenTheme}>
      {children}
    </K12NextGenThemeContext.Provider>
  );
}

export function K12ThemeOverrideProvider({
  children,
  override,
}: {
  children: ReactNode;
  override?: K12ThemeOverride;
}) {
  return (
    <K12NextGenThemeProvider override={override}>
      {children}
    </K12NextGenThemeProvider>
  );
}

export function useNextGenTheme(): ReturnType<typeof useTheme> {
  const baseThemeContext = useTheme();
  const overrideTheme = useContext(K12NextGenThemeContext);

  if (!overrideTheme) {
    return baseThemeContext;
  }

  return {
    ...baseThemeContext,
    theme: overrideTheme,
    colors: overrideTheme.colors,
  };
}
