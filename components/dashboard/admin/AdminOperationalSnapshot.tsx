import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { AdminOperationalSnapshot as AdminOperationalSnapshotData } from '@/hooks/useAdminOperationalSnapshot';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface AdminOperationalSnapshotProps {
  metrics?: AdminOperationalSnapshotData | null;
  loading?: boolean;
  hideFinancialMetrics?: boolean;
}

function formatMoney(value: number): string {
  return `R${Number(value || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatMonth(monthIso: string): string {
  const parsed = new Date(monthIso);
  if (Number.isNaN(parsed.getTime())) return monthIso;
  return parsed.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === 'success' && { color: '#22C55E' },
          tone === 'warning' && { color: '#F59E0B' },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export function AdminOperationalSnapshot({
  metrics,
  loading = false,
  hideFinancialMetrics = false,
}: AdminOperationalSnapshotProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  if (loading && !metrics) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingWrap}>
          <EduDashSpinner size="small" color={theme.primary} />
          <Text style={styles.loadingText}>Loading school snapshot...</Text>
        </View>
      </View>
    );
  }

  const safe = metrics || {
    openApplications: 0,
    students: 0,
    classes: 0,
    feesDueThisMonth: 0,
    feesCollectedThisMonth: 0,
    feesOutstandingThisMonth: 0,
    monthIso: new Date().toISOString(),
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>School Snapshot</Text>
        <Text style={styles.monthText}>{formatMonth(safe.monthIso)}</Text>
      </View>
      <Text style={styles.subtitle}>Live operations and finance at a glance</Text>

      <View style={styles.grid}>
        <MetricCard label="Open Applications" value={String(safe.openApplications)} />
        <MetricCard label="Students" value={String(safe.students)} />
        <MetricCard label="Classes" value={String(safe.classes)} />
        {!hideFinancialMetrics ? (
          <MetricCard label="Fees Due" value={formatMoney(safe.feesDueThisMonth)} tone="warning" />
        ) : null}
        {!hideFinancialMetrics ? (
          <MetricCard label="Fees Collected" value={formatMoney(safe.feesCollectedThisMonth)} tone="success" />
        ) : null}
        {!hideFinancialMetrics ? (
          <MetricCard label="Fees Outstanding" value={formatMoney(safe.feesOutstandingThisMonth)} tone="warning" />
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    monthText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    subtitle: {
      marginTop: 3,
      marginBottom: 12,
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metricCard: {
      flexBasis: '48%',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 10,
      minHeight: 78,
      justifyContent: 'space-between',
    },
    metricLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    metricValue: {
      marginTop: 6,
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
    },
    loadingWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 70,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
  });
