import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { AdminWorkflowItem, AdminWorkflowLane } from '@/lib/dashboard/admin/types';

interface AdminWorkflowLanesProps {
  workflows: Record<AdminWorkflowLane, AdminWorkflowItem[]>;
  laneRoutes: Record<AdminWorkflowLane, string>;
  hiddenLanes?: AdminWorkflowLane[];
  screeningRequestId?: string | null;
  onOpenLaneRoute: (lane: AdminWorkflowLane) => void;
  onOpenWorkflowItem: (item: AdminWorkflowItem) => void;
  onScreenAction: (
    item: AdminWorkflowItem,
    status: 'recommended' | 'hold' | 'reject_recommended'
  ) => void;
}

const LANE_META: Record<
  AdminWorkflowLane,
  { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; accent: string }
> = {
  hiring: {
    title: 'Hiring & Staff Screening',
    subtitle: 'Review staff candidates and prep for principal decisions',
    icon: 'people-circle-outline',
    accent: '#6366F1',
  },
  admissions: {
    title: 'Admissions & Parent Links',
    subtitle: 'Screen joins, claims, and enrollment workflows',
    icon: 'person-add-outline',
    accent: '#0EA5E9',
  },
  finance_ops: {
    title: 'Finance & Ops Exceptions',
    subtitle: 'Triage payment and operational exception queues',
    icon: 'alert-circle-outline',
    accent: '#F59E0B',
  },
};

function canScreen(item: AdminWorkflowItem): boolean {
  return item.request_type === 'teacher_invite' || item.request_type === 'staff_invite';
}

export function AdminWorkflowLanes({
  workflows,
  laneRoutes,
  hiddenLanes = [],
  screeningRequestId,
  onOpenLaneRoute,
  onOpenWorkflowItem,
  onScreenAction,
}: AdminWorkflowLanesProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrapper}>
      {(Object.keys(LANE_META) as AdminWorkflowLane[]).map((lane) => {
        if (hiddenLanes.includes(lane)) return null;
        const laneMeta = LANE_META[lane];
        const items = workflows[lane] || [];

        return (
          <View key={lane} style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${laneMeta.accent}22` }]}>
                  <Ionicons name={laneMeta.icon} size={19} color={laneMeta.accent} />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{laneMeta.title}</Text>
                  <Text style={styles.subtitle}>{laneMeta.subtitle}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => onOpenLaneRoute(lane)}>
                <Text style={[styles.openLink, { color: laneMeta.accent }]}>Open</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No items currently in this lane.</Text>
              </View>
            ) : (
              <View style={styles.itemList}>
                {items.slice(0, 3).map((item) => {
                  const isSubmitting = screeningRequestId === item.request_id;
                  return (
                    <View key={item.id} style={styles.itemCard}>
                      <TouchableOpacity onPress={() => onOpenWorkflowItem(item)} activeOpacity={0.8}>
                        <View style={styles.itemTop}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {item.urgent ? <Text style={styles.urgentBadge}>Urgent</Text> : null}
                        </View>
                        <Text style={styles.itemSubtitle} numberOfLines={2}>
                          {item.subtitle}
                        </Text>
                        <Text style={styles.itemMeta}>
                          Status: {item.screening_status.replace(/_/g, ' ')}
                        </Text>
                      </TouchableOpacity>

                      {canScreen(item) ? (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            disabled={isSubmitting}
                            style={[styles.actionButton, styles.recommendButton]}
                            onPress={() => onScreenAction(item, 'recommended')}
                          >
                            <Text style={styles.actionText}>{isSubmitting ? '...' : 'Recommend'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={isSubmitting}
                            style={[styles.actionButton, styles.holdButton]}
                            onPress={() => onScreenAction(item, 'hold')}
                          >
                            <Text style={styles.actionText}>{isSubmitting ? '...' : 'Hold'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={isSubmitting}
                            style={[styles.actionButton, styles.rejectButton]}
                            onPress={() => onScreenAction(item, 'reject_recommended')}
                          >
                            <Text style={styles.actionText}>{isSubmitting ? '...' : 'Reject'}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    wrapper: {
      marginHorizontal: 16,
      marginTop: 14,
      gap: 12,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    headerText: {
      flex: 1,
      paddingRight: 8,
    },
    title: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 1,
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
    },
    openLink: {
      fontSize: 12,
      fontWeight: '800',
    },
    empty: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 10,
      backgroundColor: theme.card,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    itemList: {
      gap: 8,
    },
    itemCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.card,
      padding: 10,
    },
    itemTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    itemTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
      marginRight: 6,
    },
    urgentBadge: {
      color: '#B91C1C',
      backgroundColor: '#FEE2E2',
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      fontSize: 10,
      fontWeight: '900',
      overflow: 'hidden',
    },
    itemSubtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 15,
    },
    itemMeta: {
      marginTop: 5,
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 10,
    },
    actionButton: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recommendButton: {
      backgroundColor: '#2563EB',
    },
    holdButton: {
      backgroundColor: '#D97706',
    },
    rejectButton: {
      backgroundColor: '#DC2626',
    },
    actionText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },
  });
