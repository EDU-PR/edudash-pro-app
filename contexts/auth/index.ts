/**
 * Auth Context Exports
 * 
 * Re-exports auth-related utilities and handlers.
 */
export { 
  fetchProfileWithStateUpdate,
  handleSignedIn,
  handleSignedOut,
  identifyUserInMonitoring,
  createAuthStateChangeHandler,
  type AuthStateSetters,
  type AuthEventHandlerOptions,
} from './authEventHandlers';
