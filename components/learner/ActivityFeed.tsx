import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import type { LearnerSubmission } from '@/hooks/useLearnerData';

export interface ActivityFeedProps {
  submissions?: LearnerSubmission[];
  limit?: number;
}

interface ActivityItem {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
}

export function ActivityFeed({ submissions, limit = 5 }: ActivityFeedProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const items = React.useMemo<ActivityItem[]>(() => {
    const list = (submissions ?? []).slice(0, limit).map((s) => ({
      id: s.id,
      icon: iconForStatus(s.status),
      title: activityTitle(s),
      subtitle: activitySubtitle(s),
    }));
    return list;
  }, [limit, submissions]);

  return (
    <Card padding={20} margin={0} elevation="small">
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Recent Activity</Text>
          <Ionicons name="pulse-outline" size={20} color={theme.primary} />
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyText}>No recent activity yet.</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item, idx) => (
            <View
              key={item.id}
              style={[styles.item, idx === 0 ? { borderTopWidth: 0, paddingTop: 0 } : null]}
            >
              <View style={styles.itemLeft}>
                <Ionicons name={item.icon} size={18} color={theme.textSecondary} />
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function iconForStatus(status: LearnerSubmission['status']): React.ComponentProps<typeof Ionicons>['name'] {
  switch (status) {
    case 'draft':
      return 'pencil-outline';
    case 'submitted':
      return 'paper-plane-outline';
    case 'graded':
      return 'ribbon-outline';
    case 'returned':
      return 'return-up-back-outline';
    default:
      return 'ellipse-outline';
  }
}

function activityTitle(s: LearnerSubmission): string {
  const assignmentTitle = s.assignment?.title ?? 'Assignment';
  switch (s.status) {
    case 'draft':
      return `Draft saved: ${assignmentTitle}`;
    case 'submitted':
      return `Submitted: ${assignmentTitle}`;
    case 'graded':
      return `Graded: ${assignmentTitle}`;
    case 'returned':
      return `Returned: ${assignmentTitle}`;
    default:
      return assignmentTitle;
  }
}

function activitySubtitle(s: LearnerSubmission): string {
  if (s.graded_at) return `Graded ${formatDate(s.graded_at)}`;
  if (s.submitted_at) return `Updated ${formatDate(s.submitted_at)}`;
  if (s.assignment?.due_date) return `Due ${formatDate(s.assignment.due_date)}`;
  return '—';
}

function formatDate(iso: string): string {
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
    emptyText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '500',
      paddingVertical: 10,
    },
    list: {
      gap: 10,
    },
    item: {
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    itemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    itemText: {
      flex: 1,
    },
    itemTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2,
    },
    itemSubtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
  });



