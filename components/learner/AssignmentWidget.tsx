import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import type { LearnerSubmission } from '@/hooks/useLearnerData';

export interface AssignmentWidgetProps {
  submissions?: LearnerSubmission[];
  onPressSeeAll: () => void;
}

export function AssignmentWidget({ submissions, onPressSeeAll }: AssignmentWidgetProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const upcoming = React.useMemo(() => {
    const now = Date.now();
    const items = (submissions ?? [])
      .filter((s) => !!s.assignment?.due_date)
      .map((s) => ({ s, dueAt: new Date(s.assignment!.due_date).getTime() }))
      .filter(({ dueAt }) => Number.isFinite(dueAt) && dueAt >= now)
      .sort((a, b) => a.dueAt - b.dueAt)
      .slice(0, 3)
      .map(({ s }) => s);
    return items;
  }, [submissions]);

  return (
    <Card padding={20} margin={0} elevation="small">
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Upcoming Assignments</Text>
          <Ionicons name="time-outline" size={20} color={theme.primary} />
        </View>
        <TouchableOpacity onPress={onPressSeeAll} hitSlop={10}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {upcoming.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No upcoming assignment deadlines.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {upcoming.map((submission) => (
            <View key={submission.id} style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name={submission.status === 'draft' ? 'pencil-outline' : 'checkmark-circle-outline'} size={18} color={theme.textSecondary} />
                <View style={styles.itemTextWrap}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {submission.assignment?.title ?? 'Assignment'}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    Due {formatDate(submission.assignment?.due_date)}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusPill, { borderColor: theme.borderLight }]}>
                <Text style={styles.statusPillText}>{submission.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString();
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    title: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
    },
    seeAll: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    empty: {
      paddingVertical: 10,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '500',
    },
    list: {
      gap: 10,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    itemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    itemTextWrap: {
      flex: 1,
    },
    itemTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2,
    },
    itemMeta: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
    statusPill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusPillText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
  });



