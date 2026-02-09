import { StyleSheet } from 'react-native';

// --- Types ---
export interface PlatformStats {
  totalSchools: number;
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  activeSubscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  aiUsageThisMonth: number;
  averageSchoolSize: number;
  churnRate: number;
  growthRate: number;
}

export interface RevenueByPlan {
  plan: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface UsageMetrics {
  totalApiCalls: number;
  aiTokensUsed: number;
  storageUsed: number; // in GB
  bandwidthUsed: number; // in GB
}

// --- Pure helpers ---
export const getStartDate = (range: string): string => {
  const now = new Date();
  switch (range) {
    case '7d':
      now.setDate(now.getDate() - 7);
      break;
    case '30d':
      now.setDate(now.getDate() - 30);
      break;
    case '90d':
      now.setDate(now.getDate() - 90);
      break;
    case '1y':
      now.setFullYear(now.getFullYear() - 1);
      break;
  }
  return now.toISOString().split('T')[0];
};

export const formatCurrency = (amount: number): string => {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
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
    exportButton: {
      padding: 8,
    },
    timeRangeContainer: {
      flexDirection: 'row',
      gap: 8,
      paddingBottom: 16,
    },
    timeRangeButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: '#1f2937',
    },
    timeRangeButtonActive: {
      backgroundColor: '#00f5ff',
    },
    timeRangeText: {
      color: '#9ca3af',
      fontSize: 14,
      fontWeight: '500',
    },
    timeRangeTextActive: {
      color: '#0b1220',
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
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      padding: 16,
    },
    metricCard: {
      flex: 1,
      minWidth: 150,
      backgroundColor: '#1f2937',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#374151',
    },
    metricValue: {
      color: '#00f5ff',
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
    },
    metricLabel: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 4,
    },
    metricTrend: {
      color: '#10b981',
      fontSize: 12,
      fontWeight: '500',
    },
    metricSubLabel: {
      color: '#9ca3af',
      fontSize: 12,
    },
    section: {
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
    },
    planCard: {
      backgroundColor: '#1f2937',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#374151',
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    planName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    planRevenue: {
      color: '#00f5ff',
      fontSize: 16,
      fontWeight: '600',
    },
    planDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    planCount: {
      color: '#9ca3af',
      fontSize: 12,
    },
    planPercentage: {
      color: '#9ca3af',
      fontSize: 12,
    },
    planBar: {
      height: 4,
      backgroundColor: '#374151',
      borderRadius: 2,
      overflow: 'hidden',
    },
    planBarFill: {
      height: '100%',
      backgroundColor: '#00f5ff',
    },
    usageGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    usageCard: {
      flex: 1,
      backgroundColor: '#1f2937',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#374151',
    },
    usageValue: {
      color: '#00f5ff',
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 4,
    },
    usageLabel: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
    },
    healthCard: {
      backgroundColor: '#1f2937',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#374151',
    },
    healthItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    healthIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 12,
    },
    healthGreen: {
      backgroundColor: '#10b981',
    },
    healthLabel: {
      flex: 1,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
    },
    healthStatus: {
      color: '#9ca3af',
      fontSize: 12,
    },
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    actionCard: {
      flex: 1,
      minWidth: 120,
      backgroundColor: '#1f2937',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#374151',
    },
    actionText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '500',
      marginTop: 8,
      textAlign: 'center',
    },
  });
}
