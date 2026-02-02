import React, { useEffect } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text, Pressable, StyleSheet, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { marketingTokens } from './tokens';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'indigo';
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Gradient button with scale press animation
 * Uses LinearGradient for modern aesthetic
 */

export function GradientButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  accessibilityLabel,
  testID,
  loading = false,
  disabled = false,
}: GradientButtonProps) {
  const scale = useSharedValue(1);
  const spin = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(scale.value, { duration: 120 }) }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  useEffect(() => {
    if (loading) {
      spin.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      spin.value = 0;
    }
  }, [loading, spin]);
  
  const gradientColors = variant === 'primary' 
    ? marketingTokens.gradients.primary 
    : marketingTokens.gradients.indigo;
  
  const sizeStyles = {
    sm: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
    md: { paddingHorizontal: 24, paddingVertical: 14, fontSize: 16 },
    lg: { paddingHorizontal: 32, paddingVertical: 16, fontSize: 18 },
  }[size];

  const spinnerSize = {
    sm: 22,
    md: 28,
    lg: 34,
  }[size];
  const logoSize = Math.round(spinnerSize * 0.6);
  const ringWidth = Math.max(2, Math.round(spinnerSize * 0.12));
  
  const isDisabled = disabled || loading;
  
  return (
    <Animated.View style={[styles.container, animatedStyle, isDisabled && styles.disabled, style]}>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={() => { if (!isDisabled) scale.value = 0.98; }}
        onPressOut={() => { scale.value = 1; }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ disabled: isDisabled }}
        testID={testID}
        style={styles.pressable}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.gradient,
            { 
              paddingHorizontal: sizeStyles.paddingHorizontal,
              paddingVertical: sizeStyles.paddingVertical,
            },
          ]}
        >
          <View style={styles.content}>
            {loading && (
              <View style={[styles.spinnerWrap, { width: spinnerSize, height: spinnerSize }]}>
                <Animated.View
                  style={[
                    styles.spinnerRing,
                    spinStyle,
                    {
                      width: spinnerSize,
                      height: spinnerSize,
                      borderRadius: spinnerSize / 2,
                      borderWidth: ringWidth,
                      borderTopColor: marketingTokens.colors.fg.inverse,
                    },
                  ]}
                />
                <View style={[styles.spinnerLogo, { width: logoSize, height: logoSize, borderRadius: logoSize / 2 }]}>
                  <Image
                    source={require('@/assets/icon.png')}
                    style={{ width: logoSize * 0.7, height: logoSize * 0.7 }}
                    resizeMode="contain"
                  />
                </View>
              </View>
            )}
            <Text style={[styles.text, { fontSize: sizeStyles.fontSize }, textStyle]}>
              {label}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: marketingTokens.radii.full,
    overflow: 'hidden',
    // Minimum touch target
    minHeight: 44,
    minWidth: 44,
  },
  disabled: {
    opacity: 0.7,
  },
  pressable: {
    width: '100%',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerWrap: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(10, 14, 22, 0.25)',
  },
  spinnerLogo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  text: {
    color: marketingTokens.colors.fg.inverse,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
