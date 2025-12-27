/**
 * VoiceOrb Styles
 * 
 * Extracted styles for the VoiceOrb component per WARP.md guidelines.
 * @module components/super-admin/voice-orb/VoiceOrb.styles
 */

import { StyleSheet } from 'react-native';

// Cosmic color palette
export const COLORS = {
  // Cosmic Nebula Palette
  deepSpace: '#0f172a',
  nebulaBlue: '#3b82f6',
  nebulaPurple: '#8b5cf6',
  nebulaTeal: '#06b6d4',
  nebulaPink: '#ec4899',
  starlight: '#f8fafc',
  
  // Core orb colors
  corePink: '#ec4899',
  violet: '#8b5cf6',
  purple: '#a855f7',
  lavender: '#c4b5fd',
  coreGlow: '#3b82f6',
  
  // State colors
  listening: '#22c55e',
  speaking: '#06b6d4',
  
  // Effects
  shooting: '#fef08a',
  sparkle: '#ffffff',
  particle: '#a5f3fc',
} as const;

export const ORB_SIZE = 200;

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  orbContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  outerGlow: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowGradient: {
    width: '100%',
    height: '100%',
  },
  innerGlow: {
    position: 'absolute',
  },
  coreContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.corePink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 25,
    elevation: 15,
  },
  core: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: {
    tintColor: '#ffffff',
    opacity: 0.95,
  },
  coreHighlight: {
    position: 'absolute',
    top: '12%',
    left: '18%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 100,
    transform: [{ rotate: '-25deg' }],
  },
  sparkleHorizontal: {
    position: 'absolute',
    top: '50%',
    left: 0,
    marginTop: -1,
    borderRadius: 2,
  },
  sparkleVertical: {
    position: 'absolute',
    left: '50%',
    top: 0,
    marginLeft: -1,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 24,
    textAlign: 'center',
  },
  speechIndicator: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  muteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteButtonText: {
    fontSize: 20,
  },
  languageSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  languageOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    minWidth: 50,
    alignItems: 'center',
  },
  languageOptionSelected: {
    borderWidth: 2,
  },
  languageText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hintText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default styles;
