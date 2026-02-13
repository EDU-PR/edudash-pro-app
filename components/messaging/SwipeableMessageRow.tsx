/**
 * SwipeableMessageRow — wraps a message row with swipe-right-to-reply gesture.
 *
 * Uses react-native-gesture-handler Gesture.Pan + react-native-reanimated.
 * Swipe right → reveals a reply icon → triggers onSwipeReply callback.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const SWIPE_THRESHOLD = 64;
const MAX_TRANSLATE = 80;

interface SwipeableMessageRowProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  enabled?: boolean;
}

export const SwipeableMessageRow: React.FC<SwipeableMessageRowProps> = ({
  children,
  onSwipeReply,
  enabled = true,
}) => {
  const translateX = useSharedValue(0);

  const triggerReply = useCallback(() => {
    onSwipeReply();
  }, [onSwipeReply]);

  const panGesture = Gesture.Pan()
    .activeOffsetX(20)
    .failOffsetY([-15, 15])
    .enabled(enabled)
    .onUpdate((e) => {
      // Only allow right swipe (positive translateX), capped
      translateX.value = Math.min(Math.max(e.translationX, 0), MAX_TRANSLATE);
    })
    .onEnd(() => {
      if (translateX.value >= SWIPE_THRESHOLD) {
        runOnJS(triggerReply)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
      [0, 0.4, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, SWIPE_THRESHOLD],
          [0.5, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  if (!enabled) return <>{children}</>;

  return (
    <View style={styles.wrapper}>
      {/* Reply icon behind the row */}
      <Animated.View style={[styles.iconContainer, iconStyle]}>
        <View style={styles.iconCircle}>
          <Ionicons name="arrow-undo" size={18} color="#fff" />
        </View>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  iconContainer: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SwipeableMessageRow;
