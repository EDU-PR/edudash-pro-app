/**
 * Re-export barrel — consumers import from here.
 * Standalone file follows the established modular hook pattern
 * (see hooks/usePrincipalHub.ts).
 */

export { useEnhancedUserManagement } from './enhanced-user-management';
export type {
  EnhancedUser,
  UserFilter,
  UserSuspensionOptions,
  UserDeletionRequest,
  BulkOperation,
} from './enhanced-user-management';
export { getRoleColor, getRiskColor, formatLastActivity } from './enhanced-user-management';
