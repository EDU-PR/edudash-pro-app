import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useOrgAdminMetrics } from '@/hooks/useOrgAdminMetrics';

interface MetricsCardsProps {
  theme: any;
}

export function MetricsCards({ theme }: MetricsCardsProps) {
  const { data: metrics, isLoading, error } = useOrgAdminMetrics();

  if (isLoading) {
    return (
      <View style={createStyles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[createStyles(theme).loadingText, { color: theme.textSecondary }]}>
          Loading metrics...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={createStyles(theme).errorContainer}>
        <Text style={[createStyles(theme).errorText, { color: theme.error }]}>
          Failed to load metrics
        </Text>
      </View>
    );
  }

  return (
    <View style={createStyles(theme).row}>
      <KPICard
        title="Active Learners"
        value={metrics?.activeLearners?.toString() || '0'}
        theme={theme}
      />
      <KPICard
        title="Completion Rate"
        value={`${metrics?.completionRate?.toFixed(1) || '0'}%`}
        theme={theme}
      />
      <KPICard
        title="Cert Pipeline"
        value={metrics?.certPipeline?.toString() || '0'}
        theme={theme}
      />
      <KPICard
        title="MRR"
        value={`R${((metrics?.mrr || 0) / 100).toFixed(2)}`}
        theme={theme}
      />
    </View>
  );
}

function KPICard({ title, value, theme }: { title: string; value: string; theme: any }) {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flexBasis: '48%',
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 90,
    justifyContent: 'center',
  },
  value: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  title: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

