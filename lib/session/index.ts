/**
 * Session Manager — Barrel Export
 * 
 * Re-exports all public APIs from the session module.
 */

// Types
export type { UserSession, UserProfile } from './types';

// Storage & Password Recovery
export {
  isPasswordRecoveryInProgress,
  setPasswordRecoveryInProgress,
  getStoredProfileForUser,
  updateStoredProfile,
  clearStoredAuthData,
  syncSessionFromSupabase,
} from './storage';

// Auth Operations
export {
  initializeSession,
  signInWithSession,
  signOut,
  getCurrentSession,
  getCurrentProfile,
  refreshProfile,
} from './auth';
