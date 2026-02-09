/**
 * Styles for Parent Activity Feed Screen
 * Extracted from parent-activity-feed.tsx for WARP compliance
 */

import { StyleSheet } from 'react-native';

/** Types shared between screen and styles */
export type ActivityFilter = 'all' | 'learning' | 'play' | 'meal' | 'art' | 'outdoor' | 'milestone';

export interface ChildOption {
  id: string;
  first_name: string;
  last_name: string;
  class_name?: string;
}

export const FILTER_OPTIONS: { key: ActivityFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'learning', label: 'Learning', icon: 'school' },
  { key: 'play', label: 'Play', icon: 'game-controller' },
  { key: 'meal', label: 'Meals', icon: 'restaurant' },
  { key: 'art', label: 'Art', icon: 'color-palette' },
  { key: 'outdoor', label: 'Outdoor', icon: 'sunny' },
  { key: 'milestone', label: 'Milestones', icon: 'trophy' },
];

export function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function formatDateLabel(d: Date): string {
  const now = new Date();
  const today = toDateKey(now);
  const yesterday = toDateKey(new Date(now.getTime() - 86_400_000));
  const key = toDateKey(d);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function createActivityFeedStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    childSelector: {
      maxHeight: 52,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    childSelectorScroll: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    childChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 18,
      borderWidth: 1,
      gap: 6,
    },
    childChipText: {
      fontSize: 14,
      fontWeight: '600',
    },
    childChipClass: {
      fontSize: 11,
    },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    dateArrow: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    dateLabelText: {
      fontSize: 15,
      fontWeight: '600',
    },
    filterBar: {
      maxHeight: 46,
    },
    filterScroll: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 16,
      borderWidth: 1,
      gap: 5,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '600',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 280,
    },
    todayBtn: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    todayBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    listContent: {
      paddingVertical: 8,
      paddingBottom: 32,
    },
    feedHeader: {
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    feedHeaderCount: {
      fontSize: 12,
    },
  });
}
