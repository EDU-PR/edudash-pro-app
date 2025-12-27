/**
 * Voice Orb Module Exports
 * 
 * Barrel export for the refactored VoiceOrb component and its utilities.
 * 
 * @module components/super-admin/voice-orb
 */

// Main component
export { default as VoiceOrb } from './VoiceOrb';
export type { VoiceOrbRef } from './VoiceOrb';

// Hooks
export { useVoiceRecorder } from './useVoiceRecorder';
export { useVoiceSTT, SUPPORTED_LANGUAGES } from './useVoiceSTT';
export type { SupportedLanguage, STTResult } from './useVoiceSTT';
export { useVoiceTTS } from './useVoiceTTS';
export type { TTSOptions } from './useVoiceTTS';

// Animations
export {
  FloatingParticle,
  ShootingStar,
  PulsingRing,
  generateParticles,
  generateShootingStars,
  generateRings,
} from './VoiceOrbAnimations';

// Styles and constants
export { styles, COLORS, ORB_SIZE } from './VoiceOrb.styles';
