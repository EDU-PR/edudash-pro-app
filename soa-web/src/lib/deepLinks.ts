/**
 * Deep Link Utilities for SOA Web → EduDash Pro App
 * 
 * Generates deep links to open the EduDash Pro mobile app after registration/join
 */

const APP_SCHEME = 'edudashpro';
const WEB_FALLBACK_URL = process.env.NEXT_PUBLIC_EDUDASH_URL || 'https://edudashpro.org.za';

export interface DeepLinkParams {
  /** Auth token or session token for auto-login */
  token?: string;
  /** User email for auto-login */
  email?: string;
  /** Flow type: 'registration', 'join', 'login' */
  flow?: string;
  /** Member number (for registration confirmation) */
  memberNumber?: string;
  /** Organization ID */
  organizationId?: string;
}

/**
 * Generate deep link URL for opening the app
 */
export function generateDeepLink(params: DeepLinkParams): string {
  const queryParams = new URLSearchParams();
  
  if (params.token) queryParams.set('token', params.token);
  if (params.email) queryParams.set('email', params.email);
  if (params.flow) queryParams.set('flow', params.flow);
  if (params.memberNumber) queryParams.set('memberNumber', params.memberNumber);
  if (params.organizationId) queryParams.set('organizationId', params.organizationId);
  
  const queryString = queryParams.toString();
  return `${APP_SCHEME}://auth-callback${queryString ? `?${queryString}` : ''}`;
}

/**
 * Generate universal link (for iOS/Android app links)
 */
export function generateUniversalLink(params: DeepLinkParams): string {
  const queryParams = new URLSearchParams();
  
  if (params.token) queryParams.set('token', params.token);
  if (params.email) queryParams.set('email', params.email);
  if (params.flow) queryParams.set('flow', params.flow);
  if (params.memberNumber) queryParams.set('memberNumber', params.memberNumber);
  if (params.organizationId) queryParams.set('organizationId', params.organizationId);
  
  const queryString = queryParams.toString();
  return `${WEB_FALLBACK_URL}/auth-callback${queryString ? `?${queryString}` : ''}`;
}

/**
 * Try to open app via deep link, with fallback to download page
 */
export function openAppOrDownload(params: DeepLinkParams): void {
  if (typeof window === 'undefined') return;
  
  const deepLink = generateDeepLink(params);
  const universalLink = generateUniversalLink(params);
  
  // Try deep link first (custom scheme)
  const deepLinkWindow = window.open(deepLink, '_blank');
  
  // If deep link doesn't work (app not installed), fallback after short delay
  setTimeout(() => {
    if (deepLinkWindow) {
      deepLinkWindow.close();
    }
    // Fallback to universal link or download page
    window.location.href = universalLink;
  }, 500);
}

/**
 * Get app download URLs
 */
export function getAppDownloadUrls() {
  return {
    android: process.env.NEXT_PUBLIC_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.edudashpro.app',
    ios: process.env.NEXT_PUBLIC_APP_STORE_URL || 'https://apps.apple.com/app/edudash-pro/id123456789',
    web: WEB_FALLBACK_URL,
  };
}

/**
 * Detect if user is on mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Get platform-specific download URL
 */
export function getPlatformDownloadUrl(): string {
  const urls = getAppDownloadUrls();
  if (typeof window === 'undefined') return urls.web;
  
  const userAgent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return urls.ios;
  } else if (/Android/i.test(userAgent)) {
    return urls.android;
  }
  return urls.web;
}


