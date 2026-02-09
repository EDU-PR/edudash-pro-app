import { StyleSheet } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  is_enabled: boolean;
  rollout_percentage: number;
  target_roles: string[];
  target_schools: string[];
  environment: 'development' | 'staging' | 'production';
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface FeatureFlagForm {
  name: string;
  key: string;
  description: string;
  is_enabled: boolean;
  rollout_percentage: number;
  target_roles: string[];
  environment: 'development' | 'staging' | 'production';
}

// ─── Pure Helpers ─────────────────────────────────────────────────────

export const getEnvironmentColor = (environment: string): string => {
  switch (environment) {
    case 'production':
      return '#ef4444';
    case 'staging':
      return '#f59e0b';
    case 'development':
      return '#10b981';
    default:
      return '#6b7280';
  }
};

// ─── Styles ───────────────────────────────────────────────────────────

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
    addButton: {
      padding: 8,
    },
    statsContainer: {
      paddingBottom: 16,
    },
    statsText: {
      color: '#9ca3af',
      fontSize: 14,
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
    flagCard: {
      backgroundColor: '#1f2937',
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#374151',
    },
    flagHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    flagInfo: {
      flex: 1,
      paddingRight: 16,
    },
    flagName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    flagKey: {
      color: '#00f5ff',
      fontSize: 12,
      fontFamily: 'monospace',
      marginBottom: 4,
    },
    flagDescription: {
      color: '#9ca3af',
      fontSize: 14,
      lineHeight: 20,
    },
    flagControls: {
      alignItems: 'center',
    },
    flagMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    flagBadges: {
      flexDirection: 'row',
      gap: 8,
    },
    environmentBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    environmentText: {
      fontSize: 10,
      fontWeight: '600',
    },
    rolloutBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: '#374151',
    },
    rolloutText: {
      color: '#9ca3af',
      fontSize: 10,
      fontWeight: '500',
    },
    flagActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: '#374151',
    },
    targetRoles: {
      marginBottom: 12,
    },
    targetRolesLabel: {
      color: '#9ca3af',
      fontSize: 12,
      marginBottom: 4,
    },
    rolesList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    roleChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: '#374151',
    },
    roleChipText: {
      color: '#ffffff',
      fontSize: 10,
    },
    flagFooter: {
      borderTopWidth: 1,
      borderTopColor: '#374151',
      paddingTop: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    flagTimestamp: {
      color: '#6b7280',
      fontSize: 11,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 64,
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
    saveButtonText: {
      color: '#00f5ff',
      fontSize: 16,
      fontWeight: '600',
    },
    modalContent: {
      flex: 1,
      backgroundColor: '#111827',
    },
    formSection: {
      marginHorizontal: 16,
      marginBottom: 24,
    },
    formLabel: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 8,
    },
    formInput: {
      backgroundColor: '#1f2937',
      color: '#ffffff',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      fontSize: 16,
      borderWidth: 1,
      borderColor: '#374151',
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sliderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    percentageInput: {
      backgroundColor: '#1f2937',
      color: '#ffffff',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      fontSize: 16,
      borderWidth: 1,
      borderColor: '#374151',
      width: 80,
      textAlign: 'center',
    },
    percentageLabel: {
      color: '#9ca3af',
      fontSize: 16,
    },
    environmentPicker: {
      flexDirection: 'row',
      gap: 8,
    },
    environmentOption: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      backgroundColor: '#1f2937',
    },
    environmentOptionActive: {
      backgroundColor: 'transparent',
    },
    environmentOptionText: {
      color: '#9ca3af',
      fontSize: 14,
      fontWeight: '500',
    },
    rolesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    roleOption: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: '#1f2937',
      borderWidth: 1,
      borderColor: '#374151',
    },
    roleOptionActive: {
      backgroundColor: '#00f5ff20',
      borderColor: '#00f5ff',
    },
    roleOptionText: {
      color: '#9ca3af',
      fontSize: 14,
      fontWeight: '500',
    },
    roleOptionTextActive: {
      color: '#00f5ff',
    },
  });
}
