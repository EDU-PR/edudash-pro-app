import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useNextGenTheme } from '@/contexts/K12NextGenThemeContext';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
  blur?: boolean;
}

export function GlassCard({
  children,
  style,
  padding = 16,
  radius = 18,
  blur = true,
}: GlassCardProps) {
  const { theme } = useNextGenTheme();
  const shouldBlur = blur && Platform.OS === 'ios';

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          padding,
        },
        style,
      ]}
    >
      {shouldBlur && (
        <BlurView
          intensity={24}
          tint="dark"
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
  content: {
    zIndex: 2,
  },
});

export default GlassCard;
