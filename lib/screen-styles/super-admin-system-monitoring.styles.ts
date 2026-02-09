import { StyleSheet } from 'react-native';

// --- Types ---
export interface SystemHealth {
  database_status: 'healthy' | 'degraded' | 'down';
  database_connections: number;
  database_max_connections: number;
  migration_status: 'up_to_date' | 'pending' | 'failed';
  latest_migration: string | null;
  failed_migrations: string[];
  rls_enabled: boolean;
  system_load: number;
  memory_usage: number;
  disk_usage: number;
  uptime: string;
  last_check: string;
}

export interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  source: string;
  user_id?: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  total_requests_24h: number;
  failed_requests_24h: number;
  average_response_time: number;
  active_users: number;
  peak_concurrent_users: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  bandwidth_used_gb: number;
}

// --- Pure helpers ---
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'healthy':
    case 'up_to_date':
      return '#10b981';
    case 'degraded':
    case 'pending':
      return '#f59e0b';
    case 'down':
    case 'failed':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

export const getLevelColor = (level: string): string => {
  switch (level) {
    case 'error':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'info':
      return '#10b981';
    default:
      return '#6b7280';
  }
};

export const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

export const formatBytes = (bytes: number): string => {
  return `${bytes.toFixed(1)} GB`;
};

export const formatUptime = (uptimeInput: string | number): string => {
  if (typeof uptimeInput === 'string') {
    return uptimeInput; // Already formatted
  }

  const seconds = Math.floor(uptimeInput);
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days} days ${hours} hours`;
  } else if (hours > 0) {
    return `${hours} hours ${minutes} minutes`;
  } else {
    return `${minutes} minutes`;
  }
};

// --- Styles ---
export function createStyles(_theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0b1220',
    },
    deniedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0b1220',
    },
    deniedText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    header: {
      backgroundColor: '#0b1220',
      paddingHorizontal: 16,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
    },
    backButton: {
      padding: 8,
    },
    title: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: '700',
    },
    refreshButton: {
      padding: 8,
    },
    lastCheckContainer: {
      paddingBottom: 16,
    },
    lastCheckText: {
      color: '#9ca3af',
      fontSize: 12,
    },
    content: {
      flex: 1,
      backgroundColor: '#111827',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 64,
    },
    loadingText: {
      color: '#9ca3af',
      marginTop: 16,
    },
    section: {
      backgroundColor: '#1f2937',
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#374151',
    },
    sectionTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
    },
    healthGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    healthCard: {
      flex: 1,
      minWidth: 120,
      backgroundColor: '#374151',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    healthStatus: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    healthLabel: {
      color: '#9ca3af',
      fontSize: 12,
      marginBottom: 4,
    },
    healthValue: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    healthDetail: {
      color: '#6b7280',
      fontSize: 10,
      textAlign: 'center',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    metricCard: {
      flex: 1,
      minWidth: 120,
      backgroundColor: '#374151',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    metricValue: {
      color: '#00f5ff',
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 4,
    },
    metricLabel: {
      color: '#9ca3af',
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 4,
    },
    metricSubtext: {
      color: '#6b7280',
      fontSize: 10,
      textAlign: 'center',
    },
    resourceItem: {
      marginBottom: 16,
    },
    resourceLabel: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    resourceValue: {
      color: '#9ca3af',
      fontSize: 12,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    progressBar: {
      height: 8,
      backgroundColor: '#4b5563',
      borderRadius: 4,
      overflow: 'hidden',
      position: 'relative',
    },
    progressFill: {
      height: '100%',
      position: 'absolute',
      left: 0,
      top: 0,
    },
    logItem: {
      backgroundColor: '#374151',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    logHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    logLevel: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    logLevelText: {
      fontSize: 10,
      fontWeight: '600',
    },
    logTimestamp: {
      color: '#9ca3af',
      fontSize: 12,
    },
    logMessage: {
      color: '#ffffff',
      fontSize: 14,
      marginBottom: 4,
    },
    logSource: {
      color: '#9ca3af',
      fontSize: 12,
      marginBottom: 8,
    },
    logDetails: {
      backgroundColor: '#1f2937',
      padding: 8,
      borderRadius: 6,
      borderLeftWidth: 2,
      borderLeftColor: '#00f5ff',
    },
    logDetailsText: {
      color: '#d1d5db',
      fontSize: 10,
      fontFamily: 'monospace',
    },
  });
}
