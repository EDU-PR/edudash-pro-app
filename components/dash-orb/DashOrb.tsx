/**
 * DashOrb — Glass-Ring Particle Orb
 *
 * State-driven animated orb with sparkle particles, rotating gradient ring,
 * and voice-amplitude reactivity. Uses react-native-reanimated v4 and
 * expo-linear-gradient.
 *
 * States: idle · listening · thinking · speaking
 *
 * @module components/dash-orb/DashOrb
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// ── Types ───────────────────────────────────────────────────────────

export type DashOrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface DashOrbProps {
  /** Outer orb diameter in pixels */
  size: number;
  /** Current animation state */
  state?: DashOrbState;
  /** Normalized audio level 0‑1 */
  audioLevel?: number;
  /** Optional viseme ID (0‑n) when speaking */
  visemeId?: number;
}

type RingColors = readonly [string, string, string, string];

// ── Helpers ─────────────────────────────────────────────────────────

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Deterministic PRNG – particles stay put across re-renders */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── ParticleDot ─────────────────────────────────────────────────────

const ParticleDot: React.FC<{
  x: number;
  y: number;
  r: number;
  delayMs: number;
  durationMs: number;
  intensity: number;
}> = ({ x, y, r, delayMs, durationMs, intensity }) => {
  const o = useSharedValue(0);
  const s = useSharedValue(1);

  useEffect(() => {
    o.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(0.0, { duration: 10 }),
          withTiming(0.85, { duration: durationMs * 0.35 }),
          withTiming(0.1, { duration: durationMs * 0.65 }),
        ),
        -1,
        false,
      ),
    );

    s.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: durationMs * 0.4 }),
          withTiming(1.25, { duration: durationMs * 0.2 }),
          withTiming(1.0, { duration: durationMs * 0.4 }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, durationMs, o, s]);

  const st = useAnimatedStyle(() => ({
    opacity: o.value * intensity,
    transform: [{ scale: s.value }],
  }), [intensity]);

  return (
    <Animated.View
      style={[
        styles.particle,
        st,
        { left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r },
      ]}
    />
  );
};

// ── DashOrb ─────────────────────────────────────────────────────────

export function DashOrb({
  size,
  state = 'idle',
  audioLevel = 0,
  visemeId = 0,
}: DashOrbProps) {
  const ringThickness = Math.max(8, Math.round(size * 0.11));
  const innerSize = size - ringThickness * 2;

  const glowPulse = useSharedValue(0);
  const ringSpin = useSharedValue(0);
  const ringBreathe = useSharedValue(1);
  const voiceAmp = useSharedValue(0);

  const a = clamp01(audioLevel || 0);

  const visemeScale = useMemo(() => {
    if (state !== 'speaking') return 1;
    const v = Number(visemeId || 0);
    if (v <= 0) return 1.0;
    if (v <= 3) return 1.03;
    if (v <= 7) return 1.06;
    return 1.08;
  }, [state, visemeId]);

  const palette = useMemo<{
    ring: RingColors;
    glow: string;
    core: string;
    cutout: string;
  }>(() => {
    switch (state) {
      case 'listening':
        return {
          ring: ['rgba(255,255,255,0.95)', 'rgba(140,255,220,0.95)', 'rgba(160,235,255,0.95)', 'rgba(255,210,170,0.85)'],
          glow: 'rgba(140,255,220,0.22)',
          core: 'rgba(255,255,255,0.10)',
          cutout: 'rgba(0,0,0,0.10)',
        };
      case 'thinking':
        return {
          ring: ['rgba(255,255,255,0.90)', 'rgba(170,140,255,0.85)', 'rgba(120,220,255,0.90)', 'rgba(255,180,255,0.75)'],
          glow: 'rgba(160,200,255,0.20)',
          core: 'rgba(255,255,255,0.08)',
          cutout: 'rgba(0,0,0,0.12)',
        };
      case 'speaking':
        return {
          ring: ['rgba(255,255,255,0.95)', 'rgba(255,235,170,0.95)', 'rgba(170,230,255,0.90)', 'rgba(255,190,220,0.80)'],
          glow: 'rgba(255,240,190,0.22)',
          core: 'rgba(255,255,255,0.12)',
          cutout: 'rgba(0,0,0,0.10)',
        };
      case 'idle':
      default:
        return {
          ring: ['rgba(255,255,255,0.85)', 'rgba(160,235,255,0.80)', 'rgba(255,210,170,0.70)', 'rgba(170,140,255,0.70)'],
          glow: 'rgba(255,255,255,0.10)',
          core: 'rgba(255,255,255,0.06)',
          cutout: 'rgba(0,0,0,0.14)',
        };
    }
  }, [state]);

  // ── Drive animations per state ────────────────────────────────────
  useEffect(() => {
    voiceAmp.value = withTiming(a, { duration: 90 });

    const spinMs =
      state === 'speaking' ? 1400 :
      state === 'listening' ? 2200 :
      state === 'thinking' ? 1800 : 3200;

    ringSpin.value = withRepeat(withTiming(1, { duration: spinMs }), -1, false);

    const breathe =
      state === 'speaking'
        ? withRepeat(withTiming(1.09, { duration: 520 }), -1, true)
        : state === 'listening'
          ? withRepeat(withTiming(1.06, { duration: 850 }), -1, true)
          : state === 'thinking'
            ? withRepeat(withTiming(1.05, { duration: 950 }), -1, true)
            : withRepeat(withTiming(1.03, { duration: 1400 }), -1, true);

    ringBreathe.value = breathe as any;

    glowPulse.value =
      state === 'speaking'
        ? withRepeat(withSequence(withTiming(1, { duration: 260 }), withTiming(0.2, { duration: 380 })), -1, false)
        : state === 'listening'
          ? withRepeat(withSequence(withTiming(0.9, { duration: 380 }), withTiming(0.15, { duration: 520 })), -1, false)
          : withRepeat(withSequence(withTiming(0.6, { duration: 650 }), withTiming(0.1, { duration: 850 })), -1, false);
  }, [a, state, glowPulse, ringSpin, ringBreathe, voiceAmp]);

  // ── Particle data ─────────────────────────────────────────────────
  const particleIntensity = useMemo(() => {
    if (state === 'speaking') return 1.0;
    if (state === 'listening') return 0.85;
    if (state === 'thinking') return 0.55;
    return 0.35;
  }, [state]);

  const particles = useMemo(() => {
    const seed = Math.floor(size * 1000) ^ 0x9e3779b9;
    const rnd = mulberry32(seed);
    const count = 16;
    const cx = size / 2;
    const cy = size / 2;
    const bandInner = (size / 2) - ringThickness;
    const bandOuter = size / 2;

    return Array.from({ length: count }).map((_, i) => {
      const t = (i / count) * Math.PI * 2 + rnd() * 0.35;
      const rr = bandInner + rnd() * (bandOuter - bandInner);
      const x = cx + Math.cos(t) * rr;
      const y = cy + Math.sin(t) * rr;
      const dot = Math.max(1.5, size * (0.010 + rnd() * 0.020));
      const delayMs = Math.floor(rnd() * 1200);
      const durationMs = Math.floor(900 + rnd() * 1800);
      return { x, y, r: dot, delayMs, durationMs };
    });
  }, [size, ringThickness]);

  // ── Animated styles ───────────────────────────────────────────────
  const glowStyle = useAnimatedStyle(() => {
    const s = interpolate(glowPulse.value, [0, 1], [0.98, 1.08], Extrapolate.CLAMP);
    const o = interpolate(glowPulse.value, [0, 1], [0.18, 0.38], Extrapolate.CLAMP);
    return { opacity: o, transform: [{ scale: s }] };
  });

  const ringStyle = useAnimatedStyle(() => {
    const rot = `${ringSpin.value * 360}deg`;
    const amp = voiceAmp.value;
    const voiceScale = interpolate(amp, [0, 1], [1.0, state === 'speaking' ? 1.07 : 1.05], Extrapolate.CLAMP);
    return {
      transform: [
        { rotate: rot } as any,
        { scale: ringBreathe.value * voiceScale * visemeScale } as any,
      ],
    };
  }, [state, visemeScale]);

  const innerGlowStyle = useAnimatedStyle(() => {
    const amp = voiceAmp.value;
    const inner = interpolate(amp, [0, 1], [0.9, state === 'speaking' ? 1.25 : 1.15], Extrapolate.CLAMP);
    const o = interpolate(amp, [0, 1], [0.25, 0.65], Extrapolate.CLAMP);
    return { opacity: o, transform: [{ scale: inner }] };
  }, [state]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { width: size, height: size }]}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.glow,
          glowStyle,
          {
            width: size * 1.55,
            height: size * 1.55,
            borderRadius: (size * 1.55) / 2,
            backgroundColor: palette.glow,
          },
        ]}
      />

      {/* Ring */}
      <Animated.View
        style={[
          styles.ringWrap,
          ringStyle,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <LinearGradient
          colors={palette.ring}
          start={{ x: 0.15, y: 0.2 }}
          end={{ x: 0.9, y: 0.85 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Sparkle particles */}
        <View style={StyleSheet.absoluteFill}>
          {particles.map((p, idx) => (
            <ParticleDot
              key={`p-${idx}`}
              x={p.x}
              y={p.y}
              r={p.r}
              delayMs={p.delayMs}
              durationMs={p.durationMs}
              intensity={particleIntensity}
            />
          ))}
        </View>

        {/* Inner cutout (creates ring) */}
        <View
          style={[
            styles.cutout,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              backgroundColor: palette.cutout,
            },
          ]}
        />

        {/* Inner glow / core */}
        <Animated.View
          style={[
            styles.innerGlow,
            innerGlowStyle,
            {
              width: innerSize * 0.86,
              height: innerSize * 0.86,
              borderRadius: (innerSize * 0.86) / 2,
              backgroundColor: palette.core,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

export default DashOrb;

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  glow: {
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 8 },
    }),
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cutout: {
    position: 'absolute',
  },
  innerGlow: {
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.25,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 3 },
    }),
  },
  particle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
});
