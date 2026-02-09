/**
 * SectionAttentionDot — Next-Gen breathing pulse indicator
 * 
 * A reanimated-powered dot that communicates urgency through
 * scale, opacity, and color on the UI thread with zero JS overhead.
 * 
 * Priority tiers:
 *  - critical: Red breathing glow, 2s cycle
 *  - important: Amber breathing glow, 2.2s cycle
 *  - action:   Amber pulse, 2.5s cycle  
 *  - info:     Blue static dot (no animation)
 *  - none:     Hidden
 * 
 * @example
 * <SectionAttentionDot priority="critical" count={3} />
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

export type AttentionPriority = 'critical' | 'important' | 'action' | 'info' | 'none';

const PRIORITY_COLORS: Record<AttentionPriority, string> = {
  critical: '#EF4444',
  important: '#F59E0B',
  action: '#F59E0B',
  info: '#3B82F6',
  none: 'transparent',
};

const CYCLE_MS: Record<AttentionPriority, number> = {
  critical: 1000,
  important: 1100,
  action: 1250,
  info: 0,
  none: 0,
};

interface SectionAttentionDotProps {
  priority: AttentionPriority;
  /** Optional count badge shown next to the dot */
  count?: number;
  size?: number;
}

export const SectionAttentionDot: React.FC<SectionAttentionDotProps> = ({
  priority,
  count,
  size = 8,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(priority === 'info' ? 0.9 : 0.5);

  useEffect(() => {
    if (priority === 'none') return;
    const duration = CYCLE_MS[priority];
    if (duration <= 0) {
      // Static dot for 'info'
      scale.value = 1;
      opacity.value = 0.9;
      return;
    }

    // Breathing animation — runs entirely on UI thread
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [priority, scale, opacity]);

  // Hooks must be called before any conditional return (Rules of Hooks)
  const color = PRIORITY_COLORS[priority];
  const showCount = typeof count === 'number' && count > 0;

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * 2.2 }],
    opacity: opacity.value * 0.25,
  }));

  if (priority === 'none') return null;

  return (
    <View style={styles.wrapper}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size * 2.5,
            height: size * 2.5,
            borderRadius: size * 1.25,
            backgroundColor: color,
          },
          glowStyle,
        ]}
        pointerEvents="none"
      />
      {/* Core dot */}
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          dotStyle,
        ]}
      />
      {/* Count badge */}
      {showCount && (
        <View style={[styles.countBadge, { backgroundColor: color }]}>
          <Text style={styles.countText}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

export default SectionAttentionDot;
