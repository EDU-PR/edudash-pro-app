/**
 * VoiceOrb Animations
 * 
 * Reanimated animation components for the VoiceOrb.
 * Extracted per WARP.md guidelines.
 * Updated with Cosmic Nebula design.
 * 
 * @module components/super-admin/voice-orb/VoiceOrbAnimations
 */

import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, ORB_SIZE } from './VoiceOrb.styles';

// ============================================================================
// Nebula Cloud Component
// ============================================================================

interface NebulaCloudProps {
  size: number;
  colors: readonly [string, string, ...string[]];
  duration: number;
  delay: number;
  reverse?: boolean;
}

export const NebulaCloud: React.FC<NebulaCloudProps> = ({
  size,
  colors,
  duration,
  delay,
  reverse = false,
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    rotation.value = withDelay(
      delay,
      withRepeat(
        withTiming(reverse ? -360 : 360, { duration, easing: Easing.linear }),
        -1,
        false
      )
    );
    
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: duration * 0.3 }),
          withTiming(0.4, { duration: duration * 0.7 })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <LinearGradient
        colors={colors}
        style={{ width: '100%', height: '100%', borderRadius: size / 2 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
};

// ============================================================================
// Floating Particle Component
// ============================================================================

interface FloatingParticleProps {
  centerX: number;
  centerY: number;
  angle: number;
  distance: number;
  size: number;
  delay: number;
  duration: number;
  color?: string;
}

export const FloatingParticle: React.FC<FloatingParticleProps> = ({
  centerX,
  centerY,
  angle,
  distance,
  size,
  delay,
  duration,
  color = COLORS.particle,
}) => {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: duration * 0.3 }),
          withTiming(0.3, { duration: duration * 0.7 })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const currentAngle = (angle + progress.value * 360) * (Math.PI / 180);
    const x = centerX + Math.cos(currentAngle) * distance - size / 2;
    const y = centerY + Math.sin(currentAngle) * distance - size / 2;
    
    return {
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
      opacity: opacity.value,
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
    } as ViewStyle;
  });

  return <Animated.View style={animatedStyle} />;
};

// ============================================================================
// Shooting Star Component
// ============================================================================

interface ShootingStarProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  duration?: number;
}

export const ShootingStar: React.FC<ShootingStarProps> = ({
  startX,
  startY,
  endX,
  endY,
  delay,
  duration = 1500,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const x = startX + (endX - startX) * progress.value;
    const y = startY + (endY - startY) * progress.value;
    const opacity = progress.value < 0.8 ? progress.value * 1.2 : (1 - progress.value) * 5;
    
    return {
      position: 'absolute',
      left: x,
      top: y,
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: COLORS.shooting,
      opacity: Math.max(0, Math.min(1, opacity)),
      shadowColor: COLORS.shooting,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
    } as ViewStyle;
  });

  return <Animated.View style={animatedStyle} />;
};

// ============================================================================
// Pulsing Ring Component
// ============================================================================

interface PulsingRingProps {
  size: number;
  delay: number;
  colors: readonly [string, string, ...string[]];
}

export const PulsingRing: React.FC<PulsingRingProps> = ({ size, delay, colors }) => {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.95, { duration: 2000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 2000 }),
          withTiming(0.3, { duration: 2000 })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <LinearGradient
        colors={colors}
        style={{ width: '100%', height: '100%', borderRadius: size / 2 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
};

// ============================================================================
// Generate Animation Data
// ============================================================================

export function generateParticles(count: number = 12): FloatingParticleProps[] {
  const particles: FloatingParticleProps[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      centerX: ORB_SIZE / 2,
      centerY: ORB_SIZE / 2,
      angle: (i * 360) / count + Math.random() * 20,
      distance: ORB_SIZE * 0.35 + Math.random() * 15,
      size: 2 + Math.random() * 3,
      delay: i * 150,
      duration: 3000 + Math.random() * 2000,
      color: Math.random() > 0.5 ? COLORS.particle : COLORS.nebulaTeal,
    });
  }
  return particles;
}

export function generateShootingStars(count: number = 4): ShootingStarProps[] {
  const stars: ShootingStarProps[] = [];
  for (let i = 0; i < count; i++) {
    const startAngle = Math.random() * Math.PI * 2;
    const startDist = ORB_SIZE * 0.25;
    const endDist = ORB_SIZE * 0.48;
    
    stars.push({
      startX: ORB_SIZE / 2 + Math.cos(startAngle) * startDist,
      startY: ORB_SIZE / 2 + Math.sin(startAngle) * startDist,
      endX: ORB_SIZE / 2 + Math.cos(startAngle) * endDist,
      endY: ORB_SIZE / 2 + Math.sin(startAngle) * endDist,
      delay: i * 2000,
      duration: 1000 + Math.random() * 500,
    });
  }
  return stars;
}

export function generateRings(): PulsingRingProps[] {
  return [
    {
      size: ORB_SIZE * 0.65,
      delay: 0,
      colors: [`${COLORS.nebulaBlue}40`, `${COLORS.nebulaPurple}20`, 'transparent'] as const,
    },
    {
      size: ORB_SIZE * 0.8,
      delay: 500,
      colors: [`${COLORS.nebulaPurple}30`, `${COLORS.nebulaTeal}15`, 'transparent'] as const,
    },
    {
      size: ORB_SIZE * 0.95,
      delay: 1000,
      colors: [`${COLORS.nebulaTeal}20`, `${COLORS.nebulaBlue}10`, 'transparent'] as const,
    },
  ];
}

export function generateNebulaClouds(): NebulaCloudProps[] {
  return [
    {
      size: ORB_SIZE * 0.9,
      colors: [`${COLORS.nebulaBlue}30`, 'transparent'] as const,
      duration: 15000,
      delay: 0,
      reverse: false,
    },
    {
      size: ORB_SIZE * 0.85,
      colors: [`${COLORS.nebulaPurple}30`, 'transparent'] as const,
      duration: 12000,
      delay: 500,
      reverse: true,
    },
    {
      size: ORB_SIZE * 0.8,
      colors: [`${COLORS.nebulaTeal}30`, 'transparent'] as const,
      duration: 18000,
      delay: 1000,
      reverse: false,
    },
  ];
}
