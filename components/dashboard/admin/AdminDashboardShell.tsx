import React from 'react';
import { ScrollView, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AdminOperationalCounters } from '@/lib/dashboard/admin/types';
import { useTheme } from '@/contexts/ThemeContext';

interface AdminDashboardShellProps {
  orgName: string;
  orgTypeLabel: string;
  counters: AdminOperationalCounters;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

export function AdminDashboardShell({
  orgName,
  orgTypeLabel,
  counters,
  refreshing = false,
  onRefresh,
  children,
}: AdminDashboardShellProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        ) : undefined
      }
      >
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleRow}>
            <View style={styles.iconBadge}>
              <Ionicons name="settings-outline" size={16} color={theme.onPrimary} />
            </View>
            <Text style={styles.roleBadge}>Admin Command</Text>
          </View>
          <View style={styles.orgTypeBadge}>
            <Text style={styles.orgType}>{orgTypeLabel}</Text>
          </View>
        </View>
        <Text style={styles.orgName} numberOfLines={1}>
          {orgName}
        </Text>
        <Text style={styles.heroSubtitle}>
          Operational control with principal approvals.
        </Text>

        <View style={styles.counterRow}>
          <CounterChip label="Urgent" value={counters.urgent} tone="danger" />
          <CounterChip label="Awaiting Principal" value={counters.awaiting_principal} tone="warning" />
          <CounterChip label="Pending" value={counters.total_pending} tone="info" />
        </View>
      </View>

      {children}
    </ScrollView>
  );
}

function CounterChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'danger' | 'warning' | 'info';
}) {
  const toneMap: Record<string, { bg: string; border: string; text: string }> = {
    danger: { bg: 'rgba(255,255,255,0.18)', border: 'rgba(255,255,255,0.28)', text: '#FCA5A5' },
    warning: { bg: 'rgba(255,255,255,0.18)', border: 'rgba(255,255,255,0.28)', text: '#FDE68A' },
    info: { bg: 'rgba(255,255,255,0.18)', border: 'rgba(255,255,255,0.28)', text: '#93C5FD' },
  };
  const colors = toneMap[tone];

  return (
    <View style={[stylesChip.container, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[stylesChip.value, { color: colors.text }]}>{value}</Text>
      <Text style={[stylesChip.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const stylesChip = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingBottom: 28,
    },
    hero: {
      marginHorizontal: 16,
      marginTop: 14,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      backgroundColor: theme.primary,
      shadowColor: theme.shadow || '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
      elevation: 4,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    heroTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },
    iconBadge: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.24)',
    },
    roleBadge: {
      color: theme.onPrimary,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    orgTypeBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.26)',
      backgroundColor: 'rgba(255,255,255,0.14)',
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    orgType: {
      color: theme.onPrimary,
      fontSize: 12,
      fontWeight: '700',
      opacity: 0.95,
    },
    orgName: {
      color: theme.onPrimary,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 6,
    },
    heroSubtitle: {
      color: theme.onPrimary,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
      marginBottom: 14,
      opacity: 0.9,
    },
    counterRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
  });
