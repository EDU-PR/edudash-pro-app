/**
 * SpotlightOverlay
 *
 * Full-screen dark overlay with an animated cutout around a target element.
 * Uses react-native-svg for the mask and react-native-reanimated for animations.
 *
 * @module components/ui/SpotlightTour/SpotlightOverlay
 */

import React from 'react';
import { StyleSheet, Dimensions, TouchableWithoutFeedback, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, Rect, Mask, Circle, Path } from 'react-native-svg';
import type { SpotlightOverlayProps } from './types';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const ANIMATION_DURATION = 350;

export const SpotlightOverlay: React.FC<
  SpotlightOverlayProps & { onPress?: () => void }
> = ({
  target,
  visible,
  shape = 'rectangle',
  padding = 8,
  overlayOpacity = 0.75,
  onPress,
}) => {
  // Shared values for cutout position/size
  const cx = useSharedValue(SCREEN_W / 2);
  const cy = useSharedValue(SCREEN_H / 2);
  const cw = useSharedValue(0);
  const ch = useSharedValue(0);

  React.useEffect(() => {
    if (target && visible) {
      cx.value = withTiming(target.x - padding, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      cy.value = withTiming(target.y - padding, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      cw.value = withTiming(target.width + padding * 2, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      ch.value = withTiming(target.height + padding * 2, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      cw.value = withTiming(0, { duration: 200 });
      ch.value = withTiming(0, { duration: 200 });
    }
  }, [target, visible, padding, cx, cy, cw, ch]);

  const rectProps = useAnimatedProps(() => ({
    x: cx.value,
    y: cy.value,
    width: cw.value,
    height: ch.value,
    rx: 12,
    ry: 12,
  }));

  const circleProps = useAnimatedProps(() => ({
    cx: cx.value + cw.value / 2,
    cy: cy.value + ch.value / 2,
    r: Math.max(cw.value, ch.value) / 2,
  }));

  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Svg
          width={SCREEN_W}
          height={SCREEN_H}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <Mask id="spotlight-mask">
              {/* White = opaque overlay */}
              <Rect width={SCREEN_W} height={SCREEN_H} fill="white" />
              {/* Black = transparent cutout */}
              {shape === 'circle' ? (
                <AnimatedCircle animatedProps={circleProps} fill="black" />
              ) : (
                <AnimatedRect animatedProps={rectProps} fill="black" />
              )}
            </Mask>
          </Defs>
          <Rect
            width={SCREEN_W}
            height={SCREEN_H}
            fill={`rgba(0,0,0,${overlayOpacity})`}
            mask="url(#spotlight-mask)"
          />
        </Svg>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default SpotlightOverlay;
