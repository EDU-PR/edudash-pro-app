export const nextGenPalette = {
  // Base backgrounds
  bg0: '#0F121E',
  bg1: '#181C2B',
  bg2: '#22283A',

  // Glass surfaces
  glass: 'rgba(255,255,255,0.05)',
  glassStrong: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.10)',

  // Text
  text: '#EAF0FF',
  textMuted: 'rgba(234,240,255,0.72)',
  textSubtle: 'rgba(234,240,255,0.55)',

  // Green accent
  green0: '#22433F',
  green1: '#284F46',
  green2: '#3C8E62',
  green3: '#67A884',

  // Purple accent
  purple0: '#23214D',
  purple1: '#2F2863',
  purple2: '#5A409D',
  purple3: '#9584C0',

  // Status
  danger: '#FF5C5C',
  warning: '#FFCC66',
  success: '#3C8E62',
} as const;

export const nextGenRadii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
} as const;

export const nextGenSpacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

export const nextGenGradients = {
  green: ['#22433F', '#284F46', '#3C8E62'] as [string, string, string],
  purple: ['#23214D', '#2F2863', '#5A409D'] as [string, string, string],
} as const;
