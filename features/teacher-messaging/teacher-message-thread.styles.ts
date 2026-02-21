/**
 * Teacher Message Thread — Styles & Constants
 * Extracted from teacher-message-thread.tsx per WARP standard.
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

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  headerBtn: {
    padding: 8,
  },
  avatarContainer: {
    marginLeft: 4,
    marginRight: 10,
    position: 'relative',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Messages Area
  messagesWrapper: {
    flex: 1,
    overflow: 'hidden',
    zIndex: 1,
  },
  messagesArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
  },

  // Composer
  composerKeyboard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 30,
  },
  composerArea: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
});
