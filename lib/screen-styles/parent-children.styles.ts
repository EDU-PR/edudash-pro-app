/**
 * Styles for ParentChildrenScreen
 * Extracted from parent-children.tsx
 */
import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

const withAlpha = (color: string | undefined, alpha: number, fallback = 'rgba(255,255,255,0.12)') => {
  const value = String(color || '').trim();
  if (!value) return fallback;
  const safeAlpha = Math.max(0, Math.min(alpha, 1));

  const rgba = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const [r, g, b] = rgba[1].split(',').map((part) => Number(part.trim()));
    if ([r, g, b].every((part) => Number.isFinite(part))) {
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }
  }

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const normalized = raw.length === 3
      ? raw.split('').map((char) => char + char).join('')
      : raw;
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  return fallback;
};

export function createParentChildrenStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { flex: 1 },
    section: { padding: 16 },
    childCard: {
      backgroundColor: theme.surface, borderRadius: 18, padding: 14,
      marginBottom: 12, borderWidth: 1, borderColor: withAlpha(theme.border, 0.66),
      shadowColor: theme.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
      overflow: 'hidden', position: 'relative',
    },
    idTagPunchHole: {
      position: 'absolute', top: 10, right: 12, width: 14, height: 14,
      borderRadius: 999, borderWidth: 2, borderColor: withAlpha(theme.text, 0.3),
      backgroundColor: theme.background, zIndex: 2,
    },
    idTagGlow: {
      position: 'absolute', right: -16, top: -12, width: 84, height: 84,
      borderRadius: 999, backgroundColor: withAlpha(theme.primary, 0.12),
    },
    childHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatarShell: {
      width: 60, height: 60, borderRadius: 14, overflow: 'hidden',
      marginRight: 12, borderWidth: 1, borderColor: withAlpha(theme.border, 0.53),
      backgroundColor: (theme as any).surfaceVariant || withAlpha(theme.primary, 0.1),
      justifyContent: 'center', alignItems: 'center',
    },
    avatar: {
      width: '100%', height: '100%', borderRadius: 14,
      backgroundColor: withAlpha(theme.primary, 0.13), alignItems: 'center',
      justifyContent: 'center', position: 'relative', overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%', borderRadius: 14 },
    avatarText: { fontSize: 18, fontWeight: '700', color: theme.onPrimary || '#fff' },
    avatarUploadButton: {
      position: 'absolute', bottom: 2, right: 2,
      backgroundColor: theme.primary, borderRadius: 12,
      width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.surface,
    },
    childInfo: { flex: 1 },
    childName: { fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 4 },
    childDetails: { fontSize: 13, color: theme.textSecondary, marginBottom: 2 },
    childIdBadge: {
      borderRadius: 999, borderWidth: 1, borderColor: withAlpha(theme.primary, 0.4),
      backgroundColor: withAlpha(theme.primary, 0.07), paddingHorizontal: 8, paddingVertical: 4, maxWidth: 104,
    },
    childIdBadgeText: { color: theme.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
    childFooter: {
      marginTop: 10, marginBottom: 10, borderTopWidth: 1,
      borderTopColor: withAlpha(theme.border, 0.5), paddingTop: 8,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1 },
    statusPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    cardSerialText: { fontSize: 10, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.8 },
    childActions: { flexDirection: 'row', gap: 8 },
    actionButton: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
      backgroundColor: withAlpha(theme.primary, 0.06), borderWidth: 1, borderColor: withAlpha(theme.primary, 0.13),
    },
    actionButtonText: { fontSize: 14, fontWeight: '500', color: theme.primary, marginLeft: 4 },
    emptyState: { alignItems: 'center', padding: 40 },
    emptyIcon: { marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 8, textAlign: 'center' },
    emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    addButton: { backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    addButtonText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600' },
    addChildSection: { marginTop: 16, paddingHorizontal: 16, paddingBottom: 24 },
    addChildButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.primary, paddingVertical: 14, paddingHorizontal: 20,
      borderRadius: 12, gap: 8,
    },
    addChildButtonText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600' },
    secondaryButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.primary,
      paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginTop: 12, gap: 8,
    },
    secondaryButtonText: { color: theme.primary, fontSize: 14, fontWeight: '600' },
  });
}
