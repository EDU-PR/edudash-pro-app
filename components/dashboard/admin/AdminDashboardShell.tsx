import React from 'react';
import { ScrollView, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      <LinearGradient
        colors={['#111827', '#1D4ED8', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <Text style={styles.roleBadge}>Admin Operations</Text>
          <Text style={styles.orgType}>{orgTypeLabel}</Text>
        </View>
        <Text style={styles.orgName} numberOfLines={1}>
          {orgName}
        </Text>
        <Text style={styles.heroSubtitle}>
          Operational control with principal-governed approvals
        </Text>

        <View style={styles.counterRow}>
          <CounterChip label="Urgent" value={counters.urgent} tone="danger" />
          <CounterChip label="Awaiting Principal" value={counters.awaiting_principal} tone="warning" />
          <CounterChip label="Pending" value={counters.total_pending} tone="info" />
        </View>
      </LinearGradient>

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
    danger: { bg: 'rgba(239,68,68,0.18)', border: 'rgba(252,165,165,0.7)', text: '#FEE2E2' },
    warning: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(253,230,138,0.8)', text: '#FFFBEB' },
    info: { bg: 'rgba(14,165,233,0.18)', border: 'rgba(125,211,252,0.7)', text: '#ECFEFF' },
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
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.26,
      shadowRadius: 24,
      elevation: 10,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    roleBadge: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      backgroundColor: 'rgba(15,23,42,0.35)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    orgType: {
      color: '#E2E8F0',
      fontSize: 12,
      fontWeight: '700',
    },
    orgName: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '900',
      marginBottom: 6,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.92)',
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
      marginBottom: 14,
    },
    counterRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
  });
