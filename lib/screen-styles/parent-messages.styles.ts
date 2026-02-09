/**
 * Styles for ParentMessagesScreen
 * Extracted from parent-messages.tsx
 */
import { StyleSheet, Platform } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export function createParentMessagesStyles(theme: ThemeColors, insets: { bottom: number }) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContainer: { flex: 1, padding: 16 },
    skeletonItem: { marginBottom: 12 },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    errorIcon: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: theme.error + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    errorTitle: { fontSize: 20, fontWeight: '600', color: theme.text, marginBottom: 8, textAlign: 'center' },
    errorText: {
      fontSize: 15, color: theme.textSecondary, textAlign: 'center',
      lineHeight: 22, marginBottom: 24, paddingHorizontal: 20,
    },
    retryButton: { backgroundColor: theme.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
    retryButtonText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: theme.primary + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    },
    emptyTitle: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 12, textAlign: 'center' },
    emptySubtitle: {
      fontSize: 15, color: theme.textSecondary, textAlign: 'center',
      lineHeight: 22, marginBottom: 28, paddingHorizontal: 20,
    },
    emptyButton: {
      backgroundColor: theme.primary, paddingHorizontal: 32, paddingVertical: 14,
      borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    },
    emptyButtonText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600', marginLeft: 8 },
    searchContainer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.background },
    searchInputContainer: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
      borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: theme.border,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 0 },
    searchClear: { padding: 4, marginLeft: 4 },
    listContent: { paddingTop: 8, paddingBottom: insets.bottom + 160 },
    fab: {
      position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30,
      alignItems: 'center', justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
        android: { elevation: 8 },
      }),
    },
    fabPrimary: { backgroundColor: theme.primary, bottom: insets.bottom + 20 },
    fabSecondary: {
      backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.primary,
      bottom: insets.bottom + 90,
    },
  });
}
