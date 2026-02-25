/**
 * expo-local-authentication stub for web
 * Biometrics are not available on web - export a no-op API
 */

const noopArrayAsync = () => Promise.resolve([]);
const noopFalseAsync = () => Promise.resolve(false);
const noopRejectAsync = () =>
  Promise.resolve({ success: false, error: 'Not supported on web' });

export const supportedAuthenticationTypesAsync = noopArrayAsync;
export const getEnrolledLevelAsync = () => Promise.resolve(null);
export const hasHardwareAsync = noopFalseAsync;
export const isEnrolledAsync = noopFalseAsync;
export const authenticateAsync = noopRejectAsync;
export const cancelAuthenticate = () => {};
export const securityLevel = { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 };
export const authenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
};

const stub = {
  supportedAuthenticationTypesAsync,
  getEnrolledLevelAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  authenticateAsync,
  cancelAuthenticate,
  securityLevel,
  authenticationType,
};

export default stub;
