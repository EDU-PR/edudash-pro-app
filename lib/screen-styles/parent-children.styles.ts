/**
 * Styles for ParentChildrenScreen
 * Extracted from parent-children.tsx
 */
import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export function createParentChildrenStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { flex: 1 },
    section: { padding: 16 },
    childCard: {
      backgroundColor: theme.surface, borderRadius: 18, padding: 14,
      marginBottom: 12, borderWidth: 1, borderColor: theme.border + 'AA',
      shadowColor: theme.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
      overflow: 'hidden', position: 'relative',
    },
    idTagPunchHole: {
      position: 'absolute', top: 10, right: 12, width: 14, height: 14,
      borderRadius: 999, borderWidth: 2, borderColor: theme.text + '30',
      backgroundColor: theme.background, zIndex: 2,
    },
    idTagGlow: {
      position: 'absolute', right: -16, top: -12, width: 84, height: 84,
      borderRadius: 999, backgroundColor: theme.primary + '1F',
    },
    childHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatarShell: {
      width: 60, height: 60, borderRadius: 14, overflow: 'hidden',
      marginRight: 12, borderWidth: 1, borderColor: theme.border + '88',
      backgroundColor: (theme as any).surfaceVariant || theme.primary + '18',
      justifyContent: 'center', alignItems: 'center',
    },
    avatar: {
      width: '100%', height: '100%', borderRadius: 14,
      backgroundColor: theme.primary + '20', alignItems: 'center',
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
      borderRadius: 999, borderWidth: 1, borderColor: theme.primary + '66',
      backgroundColor: theme.primary + '12', paddingHorizontal: 8, paddingVertical: 4, maxWidth: 104,
    },
    childIdBadgeText: { color: theme.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
    childFooter: {
      marginTop: 10, marginBottom: 10, borderTopWidth: 1,
      borderTopColor: theme.border + '80', paddingTop: 8,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1 },
    statusPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    cardSerialText: { fontSize: 10, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.8 },
    childActions: { flexDirection: 'row', gap: 8 },
    actionButton: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
      backgroundColor: theme.primary + '10', borderWidth: 1, borderColor: theme.primary + '20',
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
