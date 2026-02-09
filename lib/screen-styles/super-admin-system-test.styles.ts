import { StyleSheet } from 'react-native';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  error?: string;
  duration?: number;
  details?: Record<string, any>;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: TestResult[];
  status: 'pending' | 'running' | 'completed';
  startTime?: number;
  endTime?: number;
}

// ── Pure helpers ───────────────────────────────────────────────────────────

export function getStatusColor(status: string): string {
  switch (status) {
    case 'passed':
      return '#10b981';
    case 'failed':
      return '#ef4444';
    case 'running':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────

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
    runButton: {
      padding: 8,
      backgroundColor: '#00f5ff20',
      borderRadius: 8,
    },
    content: {
      flex: 1,
      backgroundColor: '#111827',
    },
    overallStatus: {
      backgroundColor: '#1f2937',
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#374151',
    },
    overallStatusText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
    },
    summaryStats: {
      backgroundColor: '#374151',
      padding: 12,
      borderRadius: 8,
    },
    summaryText: {
      color: '#9ca3af',
      fontSize: 14,
      textAlign: 'center',
    },
    suiteCard: {
      backgroundColor: '#1f2937',
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#374151',
    },
    suiteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    suiteInfo: {
      flex: 1,
    },
    suiteName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    suiteDescription: {
      color: '#9ca3af',
      fontSize: 14,
    },
    suiteActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    suiteStatus: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    suiteStatusText: {
      fontSize: 10,
      fontWeight: '600',
    },
    runSuiteButton: {
      padding: 8,
      backgroundColor: '#374151',
      borderRadius: 6,
    },
    testsContainer: {
      gap: 8,
    },
    testItem: {
      backgroundColor: '#374151',
      padding: 12,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#00f5ff',
    },
    testHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    testInfo: {
      flex: 1,
    },
    testName: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 2,
    },
    testDescription: {
      color: '#9ca3af',
      fontSize: 12,
    },
    testStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    testDuration: {
      color: '#6b7280',
      fontSize: 10,
    },
    testError: {
      marginTop: 8,
      padding: 8,
      backgroundColor: '#7f1d1d20',
      borderRadius: 6,
      borderLeftWidth: 2,
      borderLeftColor: '#ef4444',
    },
    testErrorText: {
      color: '#fca5a5',
      fontSize: 12,
    },
    testDetails: {
      marginTop: 8,
      padding: 8,
      backgroundColor: '#1f2937',
      borderRadius: 6,
    },
    testDetailsText: {
      color: '#d1d5db',
      fontSize: 10,
      fontFamily: 'monospace',
    },
  });
}
