import { StyleSheet } from 'react-native';

// Types

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'content_moderator' | 'support_admin' | 'billing_admin' | 'system_admin';
  department: string;
  permissions: string[];
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  created_by: string;
  schools_assigned?: string[];
  avatar_url?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  color: string;
}

// Constants

export const ADMIN_ROLES = [
  {
    value: 'admin',
    label: 'General Admin',
    description: 'Full administrative access across all areas',
    color: '#3b82f6',
    permissions: ['user_management', 'content_moderation', 'billing', 'system_config', 'analytics'],
  },
  {
    value: 'content_moderator',
    label: 'Content Moderator',
    description: 'Moderate user content and communications',
    color: '#f59e0b',
    permissions: ['content_moderation', 'user_communication'],
  },
  {
    value: 'support_admin',
    label: 'Support Admin',
    description: 'Handle user support and troubleshooting',
    color: '#10b981',
    permissions: ['user_support', 'system_diagnostics', 'user_management'],
  },
  {
    value: 'billing_admin',
    label: 'Billing Admin',
    description: 'Manage subscriptions and billing',
    color: '#ec4899',
    permissions: ['billing', 'subscriptions', 'payments', 'analytics'],
  },
  {
    value: 'system_admin',
    label: 'System Admin',
    description: 'Technical system administration',
    color: '#8b5cf6',
    permissions: ['system_config', 'database_access', 'analytics', 'system_diagnostics'],
  },
];

export const DEPARTMENTS = [
  {
    id: 'customer_success',
    name: 'Customer Success',
    description: 'User support and satisfaction',
    permissions: ['user_support', 'user_communication', 'analytics'],
    color: '#10b981',
  },
  {
    id: 'product',
    name: 'Product Team',
    description: 'Product development and features',
    permissions: ['system_config', 'analytics', 'content_moderation'],
    color: '#3b82f6',
  },
  {
    id: 'operations',
    name: 'Operations',
    description: 'Business operations and billing',
    permissions: ['billing', 'subscriptions', 'analytics', 'user_management'],
    color: '#ec4899',
  },
  {
    id: 'engineering',
    name: 'Engineering',
    description: 'Technical systems and infrastructure',
    permissions: ['system_config', 'database_access', 'system_diagnostics'],
    color: '#8b5cf6',
  },
  {
    id: 'content',
    name: 'Content Team',
    description: 'Content moderation and curation',
    permissions: ['content_moderation', 'user_communication'],
    color: '#f59e0b',
  },
];

// Pure helpers

export function mapUserRole(role: string): AdminUser['role'] {
  const roleMap: Record<string, AdminUser['role']> = {
    admin: 'admin',
    super_admin: 'system_admin',
    superadmin: 'system_admin',
    content_moderator: 'content_moderator',
    support_admin: 'support_admin',
    billing_admin: 'billing_admin',
    system_admin: 'system_admin',
  };
  return roleMap[role.toLowerCase()] || 'admin';
}

export function getPermissionsForRole(role: string): string[] {
  const roleConfig = ADMIN_ROLES.find(r => r.value === mapUserRole(role));
  return roleConfig?.permissions || ['user_management'];
}

export function getRoleInfo(role: AdminUser['role']) {
  return ADMIN_ROLES.find(r => r.value === role) || ADMIN_ROLES[0];
}

export function getDepartmentInfo(departmentId: string) {
  return DEPARTMENTS.find(d => d.id === departmentId) || DEPARTMENTS[0];
}

export function formatLastLogin(lastLogin: string | null): string {
  if (!lastLogin) return 'Never';

  const date = new Date(lastLogin);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
  return `${Math.floor(diffMins / 1440)} days ago`;
}

// Styles

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
    addButton: {
      padding: 8,
      backgroundColor: '#3b82f620',
      borderRadius: 8,
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
    sectionHeader: {
      marginBottom: 16,
    },
    sectionTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 4,
    },
    sectionSubtitle: {
      color: '#9ca3af',
      fontSize: 14,
    },
    userCard: {
      backgroundColor: '#1f2937',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#374151',
    },
    userHeader: {
      marginBottom: 12,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    userAvatarContainer: {
      position: 'relative',
    },
    userAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userAvatarText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
    userStatusIndicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: '#1f2937',
    },
    userDetails: {
      flex: 1,
    },
    userName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    userEmail: {
      color: '#9ca3af',
      fontSize: 14,
      marginBottom: 8,
    },
    userMeta: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    roleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    roleText: {
      fontSize: 10,
      fontWeight: '600',
    },
    deptBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    deptText: {
      fontSize: 10,
      fontWeight: '600',
    },
    userStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginBottom: 12,
    },
    statItem: {
      color: '#6b7280',
      fontSize: 12,
    },
    userActions: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
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
      color: '#3b82f6',
      fontSize: 12,
      fontWeight: '600',
    },
    deptCard: {
      backgroundColor: '#1f2937',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#374151',
    },
    deptHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    deptIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deptInfo: {
      flex: 1,
    },
    deptName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    deptDescription: {
      color: '#9ca3af',
      fontSize: 14,
    },
    permissionsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    permissionChip: {
      backgroundColor: '#374151',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    permissionText: {
      color: '#e5e7eb',
      fontSize: 10,
      fontWeight: '500',
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
    createButton: {
      backgroundColor: '#3b82f6',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    createButtonText: {
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
      color: '#3b82f6',
      fontSize: 16,
      fontWeight: '600',
    },
    modalContent: {
      flex: 1,
      backgroundColor: '#111827',
      padding: 16,
    },
    formSection: {
      marginBottom: 24,
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
    roleOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 8,
    },
    roleOptionContent: {
      flex: 1,
    },
    roleOptionTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    roleOptionDescription: {
      color: '#9ca3af',
      fontSize: 12,
    },
    deptOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 8,
    },
    deptOptionContent: {
      flex: 1,
    },
    deptOptionTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    deptOptionDescription: {
      color: '#9ca3af',
      fontSize: 12,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    switchDescription: {
      color: '#9ca3af',
      fontSize: 12,
      marginTop: 4,
    },
  });
}
