/**
 * Re-export barrel for aftercare registration hook
 * Implementation split into hooks/aftercare-registration/ (WARP.md compliance)
 */
export { useAftercareRegistration } from './aftercare-registration';
export type { Grade, ShowAlert } from './useAftercareRegistration.helpers';
export {
  COMMUNITY_SCHOOL_ID, EARLY_BIRD_LIMIT,
  REGISTRATION_FEE_ORIGINAL, REGISTRATION_FEE_DISCOUNTED,
  GRADES,
} from './useAftercareRegistration.helpers';