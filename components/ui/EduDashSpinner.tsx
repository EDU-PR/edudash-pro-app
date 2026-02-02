import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

export interface EduDashSpinnerProps {
  size?: 'small' | 'large' | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  animating?: boolean;
  hidesWhenStopped?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

const SIZE_MAP = {
  small: 22,
  large: 40,
} as const;

function resolveSize(size: EduDashSpinnerProps['size']) {
  if (typeof size === 'number' && size > 0) {
    return size;
  }
  if (size === 'small' || size === 'large') {
    return SIZE_MAP[size];
  }
  return SIZE_MAP.large;
}

const EduDashSpinner: React.FC<EduDashSpinnerProps> = ({
  size = 'large',
  color,
  style,
  animating = true,
  hidesWhenStopped = true,
  testID,
  accessibilityLabel = 'Loading',
}) => {
  const { theme } = useTheme();
  const spin = useSharedValue(0);
  const sizePx = resolveSize(size);
  const ringWidth = Math.max(2, Math.round(sizePx * 0.12));
  const logoWrap = Math.max(12, Math.round(sizePx * 0.7));
  const logoSize = Math.max(10, Math.round(sizePx * 0.48));
  const spinnerColor = color || theme.primary;
  const ringTrackColor = theme.borderLight || 'rgba(10, 14, 22, 0.2)';
  const logoBackground = theme.surfaceVariant || 'rgba(255, 255, 255, 0.2)';

  useEffect(() => {
    if (animating) {
      spin.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      spin.value = 0;
    }
  }, [animating, spin]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  if (!animating && hidesWhenStopped) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { width: sizePx, height: sizePx },
        style,
      ]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
    >
      <Animated.View
        style={[
          styles.ring,
          ringStyle,
          {
            width: sizePx,
            height: sizePx,
            borderRadius: sizePx / 2,
            borderWidth: ringWidth,
            borderColor: ringTrackColor,
            borderTopColor: spinnerColor,
            borderRightColor: spinnerColor,
          },
        ]}
      />
      <View
        style={[
          styles.logoWrap,
          {
            width: logoWrap,
            height: logoWrap,
            borderRadius: logoWrap / 2,
            backgroundColor: logoBackground,
            borderColor: ringTrackColor,
          },
        ]}
      >
        <Image
          source={require('@/assets/icon.png')}
          style={{ width: logoSize, height: logoSize }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

export default EduDashSpinner;
