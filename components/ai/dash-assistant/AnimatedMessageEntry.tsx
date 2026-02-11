/**
 * AnimatedMessageEntry — Animated entrance wrapper for message bubbles
 *
 * Provides smooth slide-up + fade-in animation when new messages appear.
 * Uses native driver for 60fps performance. Wraps existing DashMessageBubble.
 *
 * @module components/ai/dash-assistant/AnimatedMessageEntry
 * @max-lines 80
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface AnimatedMessageEntryProps {
  children: React.ReactNode;
  /** Whether to animate (only newest messages should animate) */
  animate?: boolean;
  /** Delay before animation starts (ms) — stagger effect */
  delay?: number;
}

export const AnimatedMessageEntry = React.memo(function AnimatedMessageEntry({
  children,
  animate = true,
  delay = 0,
}: AnimatedMessageEntryProps) {
  const translateY = useRef(new Animated.Value(animate ? 16 : 0)).current;
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 200,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [animate, delay, translateY, opacity]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
});

export default AnimatedMessageEntry;
