/**
 * Celebration Components Export
 * 
 * ECD/Preschool celebration and gamification components.
 * Includes badges, stickers, celebration overlays, and progress animations.
 * 
 * @module components/shared/celebrations
 */

// Achievement badges
export { 
  AchievementBadge, 
  type AchievementBadgeProps,
  type BadgeType,
} from './AchievementBadge';

// Full-screen celebration overlay
export { 
  CelebrationOverlay, 
  type CelebrationOverlayProps,
  type CelebrationType,
} from './CelebrationOverlay';

// Progress stickers
export { 
  ProgressSticker, 
  type ProgressStickerProps,
  type StickerTheme,
} from './ProgressSticker';

// Re-export default for convenience
export { default as AchievementBadgeDefault } from './AchievementBadge';
export { default as CelebrationOverlayDefault } from './CelebrationOverlay';
export { default as ProgressStickerDefault } from './ProgressSticker';
