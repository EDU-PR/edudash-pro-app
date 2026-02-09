import { StyleSheet } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhatsAppConnection {
  id: string;
  school_id: string;
  school_name: string;
  phone_number: string;
  business_account_id?: string;
  status: 'connected' | 'pending' | 'disconnected' | 'error';
  last_sync: string;
  message_count: number;
  webhook_verified: boolean;
  api_key?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'marketing' | 'utility' | 'authentication';
  language: string;
  status: 'approved' | 'pending' | 'rejected';
  components: any[];
  created_at: string;
}

export interface WhatsAppMetrics {
  total_connections: number;
  active_connections: number;
  messages_sent_today: number;
  messages_sent_month: number;
  delivery_rate: number;
  read_rate: number;
  response_rate: number;
  failed_messages: number;
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'connected': return '#10b981';
    case 'pending': return '#f59e0b';
    case 'disconnected': return '#6b7280';
    case 'error': return '#ef4444';
    default: return '#6b7280';
  }
};

export const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'connected': return 'checkmark-circle';
    case 'pending': return 'time';
    case 'disconnected': return 'close-circle';
    case 'error': return 'warning';
    default: return 'help-circle';
  }
};

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: '700',
    },
    configButton: {
      padding: 8,
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
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    sectionTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#25d36620',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#25d366',
      gap: 4,
    },
    addButtonText: {
      color: '#25d366',
      fontSize: 14,
      fontWeight: '600',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    metricCard: {
      width: '48%',
      backgroundColor: '#1f2937',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    metricValue: {
      color: '#25d366',
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
    },
    metricLabel: {
      color: '#9ca3af',
      fontSize: 12,
      textAlign: 'center',
    },
    connectionCard: {
      backgroundColor: '#1f2937',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#374151',
    },
    connectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    connectionInfo: {
      flex: 1,
    },
    connectionName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    connectionPhone: {
      color: '#9ca3af',
      fontSize: 14,
    },
    connectionMeta: {
      alignItems: 'flex-end',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      gap: 4,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
    },
    connectionStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginBottom: 12,
    },
    statItem: {
      color: '#6b7280',
      fontSize: 12,
    },
    connectionActions: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#374151',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    actionButtonText: {
      color: '#25d366',
      fontSize: 12,
      fontWeight: '600',
    },
    templateCard: {
      backgroundColor: '#1f2937',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#374151',
    },
    templateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    templateName: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    templateStatus: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    templateStatusText: {
      fontSize: 10,
      fontWeight: '600',
    },
    templateMeta: {
      color: '#9ca3af',
      fontSize: 12,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
    },
    emptySubText: {
      color: '#9ca3af',
      fontSize: 14,
      marginTop: 4,
      marginBottom: 24,
    },
    setupButton: {
      backgroundColor: '#25d366',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    setupButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: '#0b1220',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#374151',
    },
    modalTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    saveButton: {
      color: '#25d366',
      fontSize: 16,
      fontWeight: '600',
    },
    modalContent: {
      flex: 1,
      backgroundColor: '#111827',
      padding: 16,
    },
    configNote: {
      color: '#9ca3af',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
      fontStyle: 'italic',
    },
    formSection: {
      marginBottom: 20,
    },
    formLabel: {
      color: '#e5e7eb',
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    formInput: {
      backgroundColor: '#1f2937',
      borderWidth: 1,
      borderColor: '#374151',
      borderRadius: 8,
      padding: 12,
      color: '#ffffff',
      fontSize: 16,
    },
    notConfiguredContainer: {
      flex: 1,
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notConfiguredCard: {
      backgroundColor: '#1f2937',
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: '#374151',
    },
    notConfiguredTitle: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: '700',
      marginTop: 20,
      marginBottom: 12,
      textAlign: 'center',
    },
    notConfiguredDescription: {
      color: '#9ca3af',
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 24,
    },
    configureButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#25d366',
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    configureButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    setupSteps: {
      marginTop: 32,
      width: '100%',
    },
    setupStepsTitle: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 16,
    },
    setupStep: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    setupStepNumber: {
      backgroundColor: '#374151',
      color: '#25d366',
      width: 24,
      height: 24,
      borderRadius: 12,
      textAlign: 'center',
      lineHeight: 24,
      fontSize: 12,
      fontWeight: '700',
    },
    setupStepText: {
      color: '#d1d5db',
      fontSize: 13,
      flex: 1,
    },
  });
}
