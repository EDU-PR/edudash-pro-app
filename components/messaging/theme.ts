/**
 * Messaging Theme Constants
 *
 * Shared color palette for messaging components across the app.
 * Aligned with PWA styling for cross-platform consistency.
 */

// === Primary Accent Colors ===
export const CYAN_PRIMARY = '#00d4ff';
export const CYAN_LIGHT = '#22d3ee';
export const CYAN_GLOW = 'rgba(0, 212, 255, 0.25)';
export const CYAN_BORDER = 'rgba(0, 212, 255, 0.3)';
export const CYAN_SHADOW = 'rgba(0, 212, 255, 0.4)';

// === Purple Accent Colors ===
export const PURPLE_PRIMARY = '#7c3aed';
export const PURPLE_SECONDARY = '#6d28d9';
export const PURPLE_LIGHT = '#8b5cf6';
export const PURPLE_INDIGO = '#6366f1';
export const PURPLE_GLOW = 'rgba(124, 58, 237, 0.3)';

// === Recording State Colors (Amber) ===
export const AMBER_PRIMARY = '#f59e0b';
export const AMBER_DARK = '#d97706';
export const AMBER_GLOW = 'rgba(245, 158, 11, 0.5)';
export const AMBER_SHADOW = 'rgba(245, 158, 11, 0.3)';

// === Waveform Colors ===
export const WAVEFORM_RECORDING = '#ec4899'; // Pink for recording energy
export const WAVEFORM_PLAYED = '#ec4899';
export const WAVEFORM_UNPLAYED = 'rgba(236, 72, 153, 0.3)';
export const WAVEFORM_BAR_OWN = 'rgba(255, 255, 255, 0.5)';
export const WAVEFORM_BAR_OWN_PLAYED = '#ffffff';

// === Action Colors ===
export const SUCCESS_GREEN = '#34d399';
export const ERROR_RED = '#ef4444';
export const DELETE_RED = '#dc2626';

// === Background Colors ===
export const DARK_SLATE_PRIMARY = '#0f172a';
export const DARK_SLATE_SECONDARY = '#1e293b';
export const DARK_SLATE_TRANSPARENT = 'rgba(15, 23, 42, 0.98)';
export const INPUT_BACKGROUND = 'rgba(30, 41, 59, 0.85)';
export const OVERLAY_BACKGROUND = 'rgba(0, 0, 0, 0.6)';

// === Gradient Arrays (for LinearGradient) ===
// Type as tuples for expo-linear-gradient compatibility
export const GRADIENT_PURPLE: [string, string] = [PURPLE_PRIMARY, PURPLE_SECONDARY];
export const GRADIENT_PURPLE_INDIGO: [string, string] = [PURPLE_LIGHT, PURPLE_INDIGO];
export const GRADIENT_PURPLE_PINK: [string, string] = [PURPLE_PRIMARY, '#ec4899'];
export const GRADIENT_DARK_SLATE: [string, string] = [DARK_SLATE_PRIMARY, DARK_SLATE_SECONDARY];
export const GRADIENT_AMBER: [string, string] = [AMBER_PRIMARY, AMBER_DARK];
export const GRADIENT_BLUE_INDIGO: [string, string] = ['#3b82f6', PURPLE_INDIGO];
export const GRADIENT_DASH_AI: [string, string] = ['#a855f7', '#ec4899'];

// === Component-Specific Styles ===
export const MIC_BUTTON_IDLE = {
  background: GRADIENT_DARK_SLATE,
  iconColor: CYAN_PRIMARY,
  borderColor: CYAN_BORDER,
  shadowColor: CYAN_PRIMARY,
  glowColor: CYAN_GLOW,
};

export const MIC_BUTTON_RECORDING = {
  background: GRADIENT_AMBER,
  iconColor: '#ffffff',
  borderColor: 'rgba(245, 158, 11, 0.5)',
  shadowColor: AMBER_PRIMARY,
  glowColor: AMBER_GLOW,
};

export const SEND_BUTTON = {
  background: GRADIENT_PURPLE,
  iconColor: '#ffffff',
  shadowColor: PURPLE_PRIMARY,
};

export const PLAY_BUTTON = {
  background: GRADIENT_PURPLE_INDIGO,
  iconColor: '#ffffff',
  shadowColor: PURPLE_LIGHT,
};

// === Shadow Presets ===
export const SHADOW_CYAN = {
  shadowColor: CYAN_PRIMARY,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 6,
};

export const SHADOW_PURPLE = {
  shadowColor: PURPLE_PRIMARY,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 6,
};

export const SHADOW_AMBER = {
  shadowColor: AMBER_PRIMARY,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.5,
  shadowRadius: 12,
  elevation: 8,
};
