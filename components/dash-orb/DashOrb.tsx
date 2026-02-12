/**
 * DashOrb — #NEXT-GEN Viseme-Reactive ZA-Inspired Voice Orb
 *
 * A premium, state-driven animated orb for the Dash voice interface.
 * Uses react-native-reanimated (already installed v4.1.1) and expo-linear-gradient.
 *
 * States:
 *  - idle:      gentle breathing pulse, slow gradient rotation
 *  - listening:  glow expands, scale driven by audio metering (voice amplitude)
 *  - thinking:   shrinks + fast rotation, teal shimmer
 *  - speaking:   viseme-reactive scale + borderRadius via amplitude proxy
 *
 * ZA-inspired palette: Gold (#FFD700), Emerald (#007A33), Deep Blue (#002395)
 * blended into the existing dark-cosmic UI.
 *
 * @module components/dash-orb/DashOrb
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

// ── ZA-Inspired Color Palette ───────────────────────────────────────
const ZA = {
  gold: '#FFD700',
  emerald: '#007A33',
  deepBlue: '#002395',
  goldSoft: '#FFC83D',
  emeraldSoft: '#00A347',
  deepBlueSoft: '#1E3A8A',
  // Blended accent colors for state
  listeningGlow: '#00C853',   // bright emerald for "I hear you"
  speakingGlow: '#FFD700',    // warm gold for "I'm speaking"
  thinkingGlow: '#00BCD4',    // teal shimmer for processing
  idleGlow: '#FFD70060',      // subtle gold ambient
} as const;

export interface DashOrbProps {
  /** Orb diameter in pixels */
  size?: number;
  /** Current animation state */
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  /** Normalized audio level 0–1 from microphone metering */
  audioLevel?: number;
  /** Azure viseme ID 0–21 (optional, degrades gracefully to amplitude) */
  visemeId?: number;
}

// ── Viseme → animation mapping ──────────────────────────────────────
// Open vowels = larger, closed consonants = tighter
function visemeToAnimation(id: number): { scale: number; radius: number } {
  // Open vowels: Ah(1), Oh(2), Ow(11), Uh(20)
  if ([1, 2, 11, 20].includes(id)) return { scale: 1.3, radius: 80 };
  // Semi-open: Ee(6), Ih(3), Eh(4)
  if ([3, 4, 6].includes(id)) return { scale: 1.2, radius: 90 };
  // Closed consonants: F/V(18), Th(19), M/B/P(21)
  if ([18, 19, 21].includes(id)) return { scale: 1.05, radius: 110 };
  // Default mid-position
  return { scale: 1.15, radius: 100 };
}

export const DashOrb: React.FC<DashOrbProps> = ({
  size = 150,
  state,
  audioLevel = 0,
  visemeId = 0,
}) => {
  // ── Shared animation values ─────────────────────────────────────
  const coreScale = useSharedValue(1);
  const corePulse = useSharedValue(1);
  const coreRotation = useSharedValue(0);
  const glowScale = useSharedValue(1.1);
  const glowOpacity = useSharedValue(0.2);
  const voiceAmplitude = useSharedValue(1);
  const borderRadiusFactor = useSharedValue(1);

  // Ring ripple values
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.4);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.3);

  // ── Audio metering → voiceAmplitude ──────────────────────────────
  useEffect(() => {
    if (state === 'listening' || state === 'speaking') {
      const clamped = Math.max(0, Math.min(1, audioLevel));
      const target = 1 + clamped * 0.3; // scale 1.0 → 1.3
      voiceAmplitude.value = withTiming(target, {
        duration: state === 'speaking' ? 80 : 100,
        easing: Easing.out(Easing.quad),
      });
    } else {
      voiceAmplitude.value = withTiming(1, { duration: 300 });
    }
  }, [audioLevel, state]);

  // ── Viseme → scale + radius (speaking only) ──────────────────────
  useEffect(() => {
    if (state !== 'speaking') {
      borderRadiusFactor.value = withTiming(1, { duration: 200 });
      return;
    }
    const anim = visemeToAnimation(visemeId);
    coreScale.value = withTiming(anim.scale, {
      duration: 80,
      easing: Easing.out(Easing.quad),
    });
    borderRadiusFactor.value = withTiming(anim.radius / 100, {
      duration: 80,
      easing: Easing.out(Easing.quad),
    });
  }, [visemeId, state]);

  // ── State-based animation loops ──────────────────────────────────
  useEffect(() => {
    // Cancel previous loops
    cancelAnimation(corePulse);
    cancelAnimation(coreRotation);
    cancelAnimation(glowScale);
    cancelAnimation(glowOpacity);
    cancelAnimation(ring1Scale);
    cancelAnimation(ring1Opacity);
    cancelAnimation(ring2Scale);
    cancelAnimation(ring2Opacity);

    switch (state) {
      case 'idle':
        // Gentle breathing: scale 1 ↔ 1.05 over 2500ms
        corePulse.value = withRepeat(
          withSequence(
            withTiming(1.05, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.0, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
        coreScale.value = withTiming(1, { duration: 300 });
        // Slow rotation
        coreRotation.value = withRepeat(
          withTiming(360, { duration: 30000, easing: Easing.linear }),
          -1,
          false,
        );
        // Subtle glow
        glowScale.value = withRepeat(
          withSequence(
            withTiming(1.15, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.05, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.35, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.2, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
        // Ripple rings
        ring1Scale.value = withRepeat(
          withSequence(
            withTiming(1.3, { duration: 3000, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring1Opacity.value = withRepeat(
          withSequence(
            withTiming(0, { duration: 3000, easing: Easing.out(Easing.ease) }),
            withTiming(0.4, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring2Scale.value = withRepeat(
          withSequence(
            withTiming(1.5, { duration: 4000, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring2Opacity.value = withRepeat(
          withSequence(
            withTiming(0, { duration: 4000, easing: Easing.out(Easing.ease) }),
            withTiming(0.3, { duration: 0 }),
          ),
          -1,
          false,
        );
        break;

      case 'listening':
        // Listen mode: glow expands, rings pulse with audio
        corePulse.value = withRepeat(
          withSequence(
            withTiming(1.06, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
        coreScale.value = withTiming(1, { duration: 200 });
        coreRotation.value = withRepeat(
          withTiming(360, { duration: 25000, easing: Easing.linear }),
          -1,
          false,
        );
        glowScale.value = withTiming(1.4, { duration: 400 });
        glowOpacity.value = withTiming(0.55, { duration: 300 });
        // Faster ripple
        ring1Scale.value = withRepeat(
          withSequence(
            withTiming(1.4, { duration: 2000, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring1Opacity.value = withRepeat(
          withSequence(
            withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
            withTiming(0.5, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring2Scale.value = withRepeat(
          withSequence(
            withTiming(1.6, { duration: 2500, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring2Opacity.value = withRepeat(
          withSequence(
            withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) }),
            withTiming(0.35, { duration: 0 }),
          ),
          -1,
          false,
        );
        break;

      case 'thinking':
        // Shrink + fast rotation + teal shimmer
        coreScale.value = withTiming(0.9, { duration: 300, easing: Easing.out(Easing.quad) });
        corePulse.value = withRepeat(
          withSequence(
            withTiming(1.04, { duration: 600, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.96, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
        coreRotation.value = withRepeat(
          withTiming(360, { duration: 4000, easing: Easing.linear }),
          -1,
          false,
        );
        glowScale.value = withRepeat(
          withSequence(
            withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 800 }),
            withTiming(0.3, { duration: 800 }),
          ),
          -1,
          false,
        );
        // No ripple rings while thinking
        ring1Opacity.value = withTiming(0, { duration: 300 });
        ring2Opacity.value = withTiming(0, { duration: 300 });
        break;

      case 'speaking':
        // Speaking: viseme-reactive (handled by visemeId effect)
        // Base pulse is faster; amplitude overlays on top
        corePulse.value = withRepeat(
          withSequence(
            withTiming(1.08, { duration: 400, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.0, { duration: 400, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
        coreRotation.value = withRepeat(
          withTiming(360, { duration: 20000, easing: Easing.linear }),
          -1,
          false,
        );
        glowScale.value = withTiming(1.25, { duration: 300 });
        glowOpacity.value = withTiming(0.5, { duration: 200 });
        // Gentle ripple
        ring1Scale.value = withRepeat(
          withSequence(
            withTiming(1.3, { duration: 2500, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring1Opacity.value = withRepeat(
          withSequence(
            withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) }),
            withTiming(0.35, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring2Opacity.value = withTiming(0, { duration: 200 });
        break;
    }

    return () => {
      cancelAnimation(corePulse);
      cancelAnimation(coreRotation);
      cancelAnimation(glowScale);
      cancelAnimation(glowOpacity);
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);
    };
  }, [state]);

  // ── Glow color per state ─────────────────────────────────────────
  const glowColor = useMemo(() => {
    switch (state) {
      case 'listening': return ZA.listeningGlow;
      case 'speaking':  return ZA.speakingGlow;
      case 'thinking':  return ZA.thinkingGlow;
      default:          return ZA.gold;
    }
  }, [state]);

  // ── Animated styles ──────────────────────────────────────────────
  const coreAnimatedStyle = useAnimatedStyle(() => {
    const baseRadius = size / 2;
    return {
      transform: [
        { scale: coreScale.value * corePulse.value * voiceAmplitude.value },
        { rotate: `${coreRotation.value}deg` },
      ] as any,
      borderRadius: baseRadius * borderRadiusFactor.value,
    };
  });

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }] as any,
    opacity: glowOpacity.value,
  }));

  const ring1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }] as any,
    opacity: ring1Opacity.value,
  }));

  const ring2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }] as any,
    opacity: ring2Opacity.value,
  }));

  // ── Render ───────────────────────────────────────────────────────
  const glowSize = size * 1.5;
  const ringSize = size * 1.2;

  return (
    <View style={[orbStyles.container, { width: size * 2, height: size * 2 }]}>
      {/* Outer glow */}
      <Animated.View
        style={[
          orbStyles.glow,
          { width: glowSize, height: glowSize, borderRadius: glowSize / 2, backgroundColor: glowColor },
          glowAnimatedStyle,
        ]}
      />

      {/* Ripple ring 1 */}
      <Animated.View
        style={[
          orbStyles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: ZA.gold + '60',
          },
          ring1AnimatedStyle,
        ]}
      />

      {/* Ripple ring 2 */}
      <Animated.View
        style={[
          orbStyles.ring,
          {
            width: ringSize * 1.15,
            height: ringSize * 1.15,
            borderRadius: (ringSize * 1.15) / 2,
            borderColor: ZA.emerald + '40',
          },
          ring2AnimatedStyle,
        ]}
      />

      {/* Core orb */}
      <Animated.View
        style={[
          orbStyles.core,
          { width: size, height: size, borderRadius: size / 2 },
          coreAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={[ZA.gold, ZA.emerald, ZA.deepBlue] as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[orbStyles.coreGradient, { width: size, height: size, borderRadius: size / 2 }]}
        />
        {/* Inner highlight for depth */}
        <View
          style={[
            orbStyles.highlight,
            {
              width: size * 0.35,
              height: size * 0.2,
              borderRadius: size * 0.15,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
};

const orbStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  core: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  coreGradient: {
    position: 'absolute',
  },
  highlight: {
    position: 'absolute',
    top: '15%',
    left: '20%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ rotate: '-20deg' }],
  },
});

export default DashOrb;
