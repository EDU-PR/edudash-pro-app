/**
 * Session Manager — Backward-compatible re-export barrel
 * 
 * The implementation has been split into lib/session/ for maintainability.
 * This file re-exports everything so existing imports continue to work.
 * 
 * @see lib/session/types.ts    — Interfaces & constants
 * @see lib/session/storage.ts  — Storage adapters & CRUD
 * @see lib/session/profile.ts  — Profile fetching & capabilities
 * @see lib/session/refresh.ts  — Token refresh & auto-refresh
 * @see lib/session/auth.ts     — Sign-in, sign-out, initialization
 * @see lib/session/helpers.ts  — Timeout utilities
 */

export type { UserSession, UserProfile } from './session';
export {
  isPasswordRecoveryInProgress,
  setPasswordRecoveryInProgress,
  getStoredProfileForUser,
  updateStoredProfile,
  clearStoredAuthData,
  syncSessionFromSupabase,
  initializeSession,
  signInWithSession,
  signOut,
  getCurrentSession,
  getCurrentProfile,
  refreshProfile,
} from './session';

