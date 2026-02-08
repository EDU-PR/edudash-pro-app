/**
 * GlowContainer — Ambient urgency glow wrapper
 * 
 * Wraps any child component in an animated glowing border/shadow
 * that breathes based on urgency level. Runs entirely on the UI thread
 * via react-native-reanimated worklets.
 * 
 * Combined with spring-based elevation for priority sections that
 * "float forward" when they need attention.
 * 
 * @example
 * <GlowContainer urgency="critical" elevated>
 *   <CollapsibleSection ... />
 * </GlowContainer>
 */

import React, { useEffect } from 'react';
import { Platform, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
  interpolateColor,
} from 'react-native-reanimated';

import type { AttentionPriority } from './SectionAttentionDot';

const GLOW_COLORS: Record<AttentionPriority, { from: string; to: string }> = {
  critical: { from: '#EF444400', to: '#EF444455' },
  action:   { from: '#F59E0B00', to: '#F59E0B40' },
  info:     { from: '#3B82F600', to: '#3B82F620' },
  none:     { from: '#00000000', to: '#00000000' },
};

const BORDER_COLORS: Record<AttentionPriority, { from: string; to: string }> = {
  critical: { from: '#EF444430', to: '#EF4444AA' },
  action:   { from: '#F59E0B20', to: '#F59E0B80' },
  info:     { from: '#3B82F615', to: '#3B82F640' },
  none:     { from: '#00000000', to: '#00000000' },
};

const CYCLE_MS: Record<AttentionPriority, number> = {
  critical: 1200,
  action: 1500,
  info: 0,
  none: 0,
};

interface GlowContainerProps {
  urgency: AttentionPriority;
  /** Whether the container should spring upward to "float" */
  elevated?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlowContainer: React.FC<GlowContainerProps> = ({
  urgency,
  elevated = false,
  children,
  style,
}) => {
  const glowProgress = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);

  // Glow breathing animation
  useEffect(() => {
    if (urgency === 'none' || urgency === 'info') {
      glowProgress.value = urgency === 'info' ? 0.5 : 0;
      return;
    }

    const duration = CYCLE_MS[urgency];
    glowProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    return () => {
      cancelAnimation(glowProgress);
    };
  }, [urgency, glowProgress]);

  // Elevation spring animation
  useEffect(() => {
    translateY.value = withSpring(elevated ? -4 : 0, {
      damping: 14,
      stiffness: 90,
      mass: 0.8,
    });
    cardScale.value = withSpring(elevated ? 1.012 : 1, {
      damping: 16,
      stiffness: 100,
    });
  }, [elevated, translateY, cardScale]);

  const containerStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      glowProgress.value,
      [0, 1],
      [BORDER_COLORS[urgency].from, BORDER_COLORS[urgency].to],
    );

    const base: Record<string, unknown> = {
      transform: [
        { translateY: translateY.value },
        { scale: cardScale.value },
      ],
      borderWidth: urgency !== 'none' ? 1.5 : 0,
      borderColor,
      borderRadius: 16,
    };

    // iOS gets real shadows; Android uses elevation
    if (Platform.OS === 'ios') {
      const shadowColor = interpolateColor(
        glowProgress.value,
        [0, 1],
        [GLOW_COLORS[urgency].from, GLOW_COLORS[urgency].to],
      );
      base.shadowColor = shadowColor;
      base.shadowOffset = { width: 0, height: 0 };
      base.shadowOpacity = 1;
      base.shadowRadius = elevated ? 16 : 10;
    } else {
      base.elevation = urgency === 'critical' ? 10 : urgency === 'action' ? 6 : 2;
    }

    return base as ViewStyle;
  });

  // No glow needed — render children directly to save a View layer
  if (urgency === 'none') {
    return <>{children}</>;
  }

  return (
    <Animated.View style={[styles.container, containerStyle, style]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
});

export default GlowContainer;
