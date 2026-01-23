/**
 * Role-Based Access Control (RBAC) System
 * 
 * Re-exports from split RBAC modules for backwards compatibility.
 * 
 * SPLIT INTO:
 * - lib/rbac/constants.ts - Role and capability definitions
 * - lib/rbac/profile-utils.ts - Profile utilities and permission checking
 * - lib/rbac/fetch-profile.ts - Profile fetching logic
 * - lib/rbac/audit.ts - Audit and security utilities
 * - lib/rbac/index.ts - Main entry point
 */

// Re-export everything from the RBAC module
export * from './rbac/index';
