/**
 * Age-Adaptive Tutor Theme System.
 *
 * Returns colors, typography, layout, and mascot configuration
 * that adapt to the learner's age band. Used by the Dash Tutor screen
 * and tutor-specific components.
 *
 * Age bands follow `resolveAgeBand()` from learnerContext.ts:
 *  - '3-5'   → Preschool / ECD (play-based, bright primary colors, large text)
 *  - '6-8'   → Foundation Phase (friendly, colorful, medium text)
 *  - '9-12'  → Intermediate Phase (balanced, modern, regular text)
 *  - '13-15' → Senior Phase (clean, semi-professional)
 *  - '16-18' → FET Phase (professional, subtle accents)
 *
 * @module tutorTheme
 */

export type AgeBand = '3-5' | '6-8' | '9-12' | '13-15' | '16-18';

export interface TutorThemeColors {
  /** Primary accent color */
  primary: string;
  /** Secondary accent for highlights */
  secondary: string;
  /** Bubble background for assistant messages */
  bubbleBg: string;
  /** Text on assistant bubbles */
  bubbleText: string;
  /** User bubble gradient start */
  userGradientStart: string;
  /** User bubble gradient end */
  userGradientEnd: string;
  /** Screen background */
  background: string;
  /** Card/surface background */
  surface: string;
  /** Success/correct color */
  success: string;
  /** Error/incorrect color */
  error: string;
  /** Star/celebration color */
  star: string;
  /** Mascot accent glow */
  mascotGlow: string;
}

export interface TutorThemeTypography {
  /** Base font size for body text */
  bodySize: number;
  /** Heading font size */
  headingSize: number;
  /** Line height multiplier */
  lineHeight: number;
  /** Font weight for body: 'normal' | 'bold' etc. */
  bodyWeight: '300' | '400' | '500' | '600' | '700';
  /** Whether to use rounded/playful fonts */
  roundedFont: boolean;
}

export interface TutorThemeLayout {
  /** Border radius for bubbles and cards */
  borderRadius: number;
  /** Padding inside bubbles */
  bubblePadding: number;
  /** Avatar/mascot size */
  avatarSize: number;
  /** Whether to show animated mascot */
  showMascot: boolean;
  /** Whether to show celebration confetti effects */
  celebrationEffects: boolean;
  /** Maximum bubble width as fraction of screen width */
  maxBubbleWidth: number;
  /** Spacing between messages */
  messageSpacing: number;
}

export interface TutorThemeMascot {
  /** Mascot name displayed */
  name: string;
  /** Emoji fallback when animation not available */
  emoji: string;
  /** Speech style description for AI prompt */
  personality: string;
  /** Whether to show animated Dash character */
  animated: boolean;
}

export interface TutorTheme {
  ageBand: AgeBand;
  colors: TutorThemeColors;
  typography: TutorThemeTypography;
  layout: TutorThemeLayout;
  mascot: TutorThemeMascot;
}

// ---------------------------------------------------------------------------
// Theme Definitions
// ---------------------------------------------------------------------------

const PRESCHOOL_THEME: TutorTheme = {
  ageBand: '3-5',
  colors: {
    primary: '#FF6B6B',        // Warm coral
    secondary: '#4ECDC4',      // Turquoise
    bubbleBg: '#FFF9E6',       // Warm cream
    bubbleText: '#2D3436',     // Dark charcoal
    userGradientStart: '#6C5CE7',
    userGradientEnd: '#A29BFE',
    background: '#FFEAA7',     // Soft yellow
    surface: '#FFFFFF',
    success: '#00B894',        // Mint green
    error: '#FF7675',          // Soft red
    star: '#FDCB6E',           // Gold
    mascotGlow: '#74B9FF',     // Sky blue
  },
  typography: {
    bodySize: 20,
    headingSize: 26,
    lineHeight: 1.6,
    bodyWeight: '600',
    roundedFont: true,
  },
  layout: {
    borderRadius: 24,
    bubblePadding: 18,
    avatarSize: 64,
    showMascot: true,
    celebrationEffects: true,
    maxBubbleWidth: 0.88,
    messageSpacing: 16,
  },
  mascot: {
    name: 'Dash',
    emoji: '🤖',
    personality: 'playful, warm, uses simple words, celebrates every attempt, says "Well done!" and "You are a superstar!"',
    animated: true,
  },
};

const FOUNDATION_THEME: TutorTheme = {
  ageBand: '6-8',
  colors: {
    primary: '#0984E3',        // Bright blue
    secondary: '#00CEC9',      // Teal
    bubbleBg: '#F0F7FF',       // Light blue tint
    bubbleText: '#2D3436',
    userGradientStart: '#6C5CE7',
    userGradientEnd: '#A29BFE',
    background: '#F5F6FA',
    surface: '#FFFFFF',
    success: '#00B894',
    error: '#FF7675',
    star: '#FDCB6E',
    mascotGlow: '#74B9FF',
  },
  typography: {
    bodySize: 17,
    headingSize: 22,
    lineHeight: 1.5,
    bodyWeight: '500',
    roundedFont: true,
  },
  layout: {
    borderRadius: 20,
    bubblePadding: 16,
    avatarSize: 52,
    showMascot: true,
    celebrationEffects: true,
    maxBubbleWidth: 0.85,
    messageSpacing: 14,
  },
  mascot: {
    name: 'Dash',
    emoji: '🤖',
    personality: 'friendly, encouraging, uses age-appropriate language, gives clear step-by-step help',
    animated: true,
  },
};

const INTERMEDIATE_THEME: TutorTheme = {
  ageBand: '9-12',
  colors: {
    primary: '#6C5CE7',        // Purple
    secondary: '#00CEC9',
    bubbleBg: '#F8F9FE',       // Very light purple tint
    bubbleText: '#2D3436',
    userGradientStart: '#0984E3',
    userGradientEnd: '#74B9FF',
    background: '#F5F6FA',
    surface: '#FFFFFF',
    success: '#00B894',
    error: '#D63031',
    star: '#FDCB6E',
    mascotGlow: '#A29BFE',
  },
  typography: {
    bodySize: 15,
    headingSize: 20,
    lineHeight: 1.45,
    bodyWeight: '400',
    roundedFont: false,
  },
  layout: {
    borderRadius: 16,
    bubblePadding: 14,
    avatarSize: 44,
    showMascot: true,
    celebrationEffects: true,
    maxBubbleWidth: 0.82,
    messageSpacing: 12,
  },
  mascot: {
    name: 'Dash',
    emoji: '🤖',
    personality: 'knowledgeable, uses clear explanations with examples, motivating but not patronizing',
    animated: false,
  },
};

const SENIOR_THEME: TutorTheme = {
  ageBand: '13-15',
  colors: {
    primary: '#2D3436',        // Charcoal
    secondary: '#0984E3',
    bubbleBg: '#F5F6FA',
    bubbleText: '#2D3436',
    userGradientStart: '#636E72',
    userGradientEnd: '#2D3436',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    success: '#00B894',
    error: '#D63031',
    star: '#FDCB6E',
    mascotGlow: '#74B9FF',
  },
  typography: {
    bodySize: 14,
    headingSize: 18,
    lineHeight: 1.4,
    bodyWeight: '400',
    roundedFont: false,
  },
  layout: {
    borderRadius: 14,
    bubblePadding: 12,
    avatarSize: 38,
    showMascot: false,
    celebrationEffects: false,
    maxBubbleWidth: 0.80,
    messageSpacing: 10,
  },
  mascot: {
    name: 'Dash',
    emoji: '🤖',
    personality: 'professional tutor, direct and clear, uses CAPS curriculum terminology',
    animated: false,
  },
};

const FET_THEME: TutorTheme = {
  ageBand: '16-18',
  colors: {
    primary: '#1A1A2E',        // Dark navy
    secondary: '#0984E3',
    bubbleBg: '#F0F2F5',
    bubbleText: '#1A1A2E',
    userGradientStart: '#2D3436',
    userGradientEnd: '#636E72',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    success: '#00B894',
    error: '#D63031',
    star: '#FDCB6E',
    mascotGlow: '#74B9FF',
  },
  typography: {
    bodySize: 14,
    headingSize: 17,
    lineHeight: 1.4,
    bodyWeight: '400',
    roundedFont: false,
  },
  layout: {
    borderRadius: 12,
    bubblePadding: 12,
    avatarSize: 34,
    showMascot: false,
    celebrationEffects: false,
    maxBubbleWidth: 0.78,
    messageSpacing: 8,
  },
  mascot: {
    name: 'Dash',
    emoji: '🤖',
    personality: 'academic advisor, uses formal CAPS terminology, exam-focused, provides structured revision strategies',
    animated: false,
  },
};

// ---------------------------------------------------------------------------
// Theme Resolver
// ---------------------------------------------------------------------------

const THEME_MAP: Record<AgeBand, TutorTheme> = {
  '3-5': PRESCHOOL_THEME,
  '6-8': FOUNDATION_THEME,
  '9-12': INTERMEDIATE_THEME,
  '13-15': SENIOR_THEME,
  '16-18': FET_THEME,
};

/**
 * Resolve the tutor theme for a given age band.
 * Falls back to intermediate (9-12) theme if unknown.
 */
export function getTutorTheme(ageBand?: string | null): TutorTheme {
  if (!ageBand) return INTERMEDIATE_THEME;
  return THEME_MAP[ageBand as AgeBand] || INTERMEDIATE_THEME;
}

/**
 * Check if the age band is preschool/ECD (play-based learning).
 */
export function isPreschoolBand(ageBand?: string | null): boolean {
  return ageBand === '3-5';
}

/**
 * Check if the age band is foundation phase (Grade R-3).
 */
export function isFoundationBand(ageBand?: string | null): boolean {
  return ageBand === '6-8';
}

/**
 * Check if the learner is young enough for mascot animations.
 */
export function shouldShowMascot(ageBand?: string | null): boolean {
  const theme = getTutorTheme(ageBand);
  return theme.layout.showMascot;
}

/**
 * Get the AI personality prompt snippet for a given age band.
 */
export function getMascotPersonality(ageBand?: string | null): string {
  const theme = getTutorTheme(ageBand);
  return theme.mascot.personality;
}
