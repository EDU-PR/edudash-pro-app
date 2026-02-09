/**
 * ChildProgressBadges styles, types, and helpers
 */

import { StyleSheet } from 'react-native';

// --- Types ---

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned_at?: string;
  progress?: number; // 0-100, undefined = fully earned
}

export interface ProgressStat {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: string;
}

// --- AppState helper ---

type AppStateModule = {
  addEventListener?: (
    type: 'change',
    handler: (state: string) => void,
  ) => { remove: () => void };
};

export const getAppState = (): AppStateModule | null => {
  try {
    const mod = require('react-native') as { AppState?: AppStateModule };
    return mod?.AppState ?? null;
  } catch {
    return null;
  }
};

// --- Styles ---

export const createStyles = (theme: any, compact: boolean) =>
  StyleSheet.create({
    container: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    lastUpdated: {
      fontSize: 11,
    },
    progressStatsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 16,
    },
    progressItem: {
      alignItems: 'center',
      gap: 8,
    },
    progressRing: {
      width: compact ? 60 : 70,
      height: compact ? 60 : 70,
      borderRadius: compact ? 30 : 35,
      borderWidth: 4,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressRingProgress: {
      position: 'absolute',
      bottom: 0,
      width: '100%',
      borderRadius: 8,
    },
    progressValue: {
      fontSize: compact ? 14 : 16,
      fontWeight: '700',
    },
    progressLabel: {
      fontSize: 12,
      textAlign: 'center',
    },
    badgesContainer: {
      gap: 12,
    },
    badgeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(128, 128, 128, 0.2)',
    },
    badgeItemLocked: {
      opacity: 0.7,
    },
    badgeIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    progressBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      backgroundColor: '#111827',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    progressBadgeText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '600',
    },
    badgeInfo: {
      flex: 1,
      marginLeft: 12,
    },
    badgeName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    badgeDescription: {
      fontSize: 12,
      lineHeight: 16,
    },
    earnedBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryContainer: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
    },
    summaryText: {
      fontSize: 13,
      textAlign: 'center',
    },
  });
