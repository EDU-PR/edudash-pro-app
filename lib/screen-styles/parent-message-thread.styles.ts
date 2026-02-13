/**
 * Styles for ParentMessageThreadScreen
 * Extracted from parent-message-thread.tsx
 */
import { StyleSheet } from 'react-native';

export const COMPOSER_OVERLAY_HEIGHT = 56;
export const COMPOSER_FLOAT_MARGIN = 6;
export const COMPOSER_FLOAT_GAP = 2;

export const WALLPAPER_ACCENTS: Record<string, string> = {
  'purple-glow': '#a78bfa',
  midnight: '#60a5fa',
  'ocean-deep': '#38bdf8',
  'forest-night': '#4ade80',
  'sunset-warm': '#fb923c',
  'dark-slate': '#93c5fd',
};

export const defaultTheme = {
  background: '#0f172a',
  surface: '#1e293b',
  primary: '#3b82f6',
  onPrimary: '#FFFFFF',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  border: 'rgba(148, 163, 184, 0.15)',
  error: '#ef4444',
  elevated: '#1e293b',
};

export function hexToRgba(color: string, alpha: number, fallback: string): string {
  if (!color.startsWith('#')) return fallback;
  const hex = color.slice(1);
  const normalized = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (normalized.length !== 6) return fallback;
  const intValue = Number.parseInt(normalized, 16);
  if (Number.isNaN(intValue)) return fallback;
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const messageThreadStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  contentArea: { flex: 1, position: 'relative' },
  wallpaperOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  messagesClip: { flex: 1, overflow: 'hidden', zIndex: 1 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 16, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, minHeight: 300 },
  loadingText: { marginTop: 12, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  errorText: { marginTop: 12, fontSize: 16, fontWeight: '500', textAlign: 'center', color: '#fff' },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#fff' },
  emptySub: { marginTop: 8, fontSize: 14, textAlign: 'center', color: 'rgba(255,255,255,0.6)' },
  btn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText: { fontSize: 15, fontWeight: '600' },
  composerArea: {
    position: 'absolute', left: COMPOSER_FLOAT_MARGIN, right: COMPOSER_FLOAT_MARGIN,
    bottom: COMPOSER_FLOAT_GAP, zIndex: 100, elevation: 0,
  },
  composerGlass: { display: 'none' },
  scrollToBottomFab: {
    position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.92)', alignItems: 'center', justifyContent: 'center',
    zIndex: 90, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  typingIndicatorContainer: { position: 'absolute', left: 16, zIndex: 99 },
  typingIndicatorBubble: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 8,
  },
  typingIndicatorText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
});
