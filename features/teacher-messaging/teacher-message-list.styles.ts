/**
 * Styles & utilities for TeacherMessageListScreen.
 * Factory accepts theme + insets so the StyleSheet is created once and memoised by the caller.
 */

import { StyleSheet, Platform } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

// ─── Shared utility ────────────────────────────────────────────────────────────

/** Human-friendly relative timestamp for message threads. */
export const formatMessageTime = (timestamp: string): string => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInHours = Math.abs(now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 168) {
    return messageTime.toLocaleDateString([], { weekday: 'short' });
  } else {
    return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

// ─── Screen-level styles ────────────────────────────────────────────────────────

export const createStyles = (theme: any, insets: EdgeInsets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      padding: 16,
    },
    skeletonItem: {
      marginBottom: 12,
    },
    // Error state
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.error + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
      paddingHorizontal: 20,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    // Empty state
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 28,
      paddingHorizontal: 20,
    },
    emptyButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    emptyButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    // List
    listContent: {
      paddingTop: 8,
      paddingBottom: insets.bottom + 100,
    },
    // FAB
    fab: {
      position: 'absolute',
      right: 20,
      bottom: insets.bottom + 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        },
        android: { elevation: 8 },
      }),
    },
  });
