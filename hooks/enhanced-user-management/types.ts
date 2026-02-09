/**
 * Types for Enhanced User Management
 *
 * Shared interfaces used by the hook subfolder and component.
 */

export interface EnhancedUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  role: string;
  organizationId?: string;
  organizationName?: string;
  isActive: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  suspensionExpiresAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  profileCompleteness: number;
  riskScore: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface UserDeletionRequest {
  userId: string;
  deletionType: 'soft' | 'hard' | 'gdpr_compliance';
  reason: string;
  retentionPeriod?: number;
  adminId: string;
  scheduledFor?: Date;
}

export interface BulkOperation {
  operation: 'suspend' | 'activate' | 'delete' | 'export' | 'notify';
  userIds: string[];
  parameters: Record<string, any>;
  reason: string;
}

export interface UserFilter {
  role: string;
  status: 'all' | 'active' | 'suspended' | 'deleted';
  organization: string;
  riskLevel: 'all' | 'low' | 'medium' | 'high' | 'critical';
  lastActivity: 'all' | 'today' | 'week' | 'month' | 'inactive';
  search: string;
}

export interface UserSuspensionOptions {
  reason: string;
  duration?: number; // hours
  restrictLogin: boolean;
  restrictDataAccess: boolean;
  notifyUser: boolean;
  escalationLevel: 'warning' | 'suspension' | 'termination';
  autoExpiry: boolean;
}

export const DEFAULT_FILTERS: UserFilter = {
  role: 'all',
  status: 'all',
  organization: 'all',
  riskLevel: 'all',
  lastActivity: 'all',
  search: '',
};

export const DEFAULT_SUSPENSION_OPTIONS: UserSuspensionOptions = {
  reason: '',
  restrictLogin: true,
  restrictDataAccess: false,
  notifyUser: true,
  escalationLevel: 'warning',
  autoExpiry: true,
};
