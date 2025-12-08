/**
 * EduDash Pro Branding Components
 * 
 * Official brand assets and components for consistent visual identity.
 * All assets follow the brand guidelines in assets/branding/README.md
 */

export { Logo, BrandColors } from './Logo';
export type { LogoVariant, LogoSize } from './Logo';

// Brand color constants for use throughout the app
export const BrandGradients = {
  primary: ['#33C3D4', '#1E6FBF', '#7B3FF2'],
  edu: ['#33C3D4', '#1E6FBF'],
  dash: ['#7B3FF2', '#9B5FF2'],
  bookmark: ['#FF4D8F', '#FF8C5F', '#FFD54D'],
} as const;

// Direct asset paths for cases where you need the raw images
export const BrandAssets = {
  icon: require('@/assets/icon.png'),
  adaptiveIcon: require('@/assets/adaptive-icon.png'),
  splashIcon: require('@/assets/splash-icon.png'),
  notificationIcon: require('@/assets/notification-icon.png'),
} as const;
