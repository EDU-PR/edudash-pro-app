import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrgAdminMetrics } from '@/hooks/useOrgAdminMetrics';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

interface MetricsCardsProps {
  theme: any;
}

interface KPIConfig {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  getValue: (m: any) => string;
}

export function MetricsCards({ theme }: MetricsCardsProps) {
  const { data: metrics, isLoading, error } = useOrgAdminMetrics();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const kpis: KPIConfig[] = useMemo(() => [
    {
      title: 'Active Learners',
      icon: 'people',
      color: theme.primary,
      getValue: (m: any) => m?.activeLearners?.toString() || '0',
    },
    {
      title: 'Completion Rate',
      icon: 'checkmark-circle',
      color: '#10B981',
      getValue: (m: any) => `${m?.completionRate?.toFixed(1) || '0'}%`,
    },
    {
      title: 'Cert Pipeline',
      icon: 'ribbon',
      color: '#F59E0B',
      getValue: (m: any) => m?.certPipeline?.toString() || '0',
    },
    {
      title: 'MRR',
      icon: 'wallet',
      color: '#8B5CF6',
      getValue: (m: any) => `R${((m?.mrr || 0) / 100).toFixed(0)}`,
    },
  ], [theme.primary]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <EduDashSpinner size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading metrics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load metrics</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {kpis.map((kpi) => (
        <View key={kpi.title} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: kpi.color + '18' }]}>
              <Ionicons name={kpi.icon} size={18} color={kpi.color} />
            </View>
          </View>
          <Text style={styles.value}>{kpi.getValue(metrics)}</Text>
          <Text style={styles.title}>{kpi.title}</Text>
        </View>
      ))}
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
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 100,
    justifyContent: 'flex-end',
  },
  cardHeader: {
    marginBottom: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  title: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    color: theme.error,
  },
});

