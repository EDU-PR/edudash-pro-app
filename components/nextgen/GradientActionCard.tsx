import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { nextGenGradients, nextGenPalette } from '@/contexts/theme/nextGenTokens';
import { useNextGenTheme } from '@/contexts/K12NextGenThemeContext';
import { Pill } from './Pill';

type Tone = 'green' | 'purple';

interface GradientActionCardProps {
  title: string;
  description: string;
  cta: string;
  onPress: () => void;
  tone: Tone;
  gradientColors?: [string, string] | [string, string, string];
  ctaBackgroundColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  badgeLabel?: string;
  disabled?: boolean;
}

export function GradientActionCard({
  title,
  description,
  cta,
  onPress,
  tone,
  gradientColors,
  ctaBackgroundColor,
  icon = 'sparkles-outline',
  badgeLabel,
  disabled = false,
}: GradientActionCardProps) {
  const { theme } = useNextGenTheme();
  const gradient = gradientColors || (tone === 'green' ? nextGenGradients.green : nextGenGradients.purple);
  const accent = tone === 'green' ? nextGenPalette.green3 : nextGenPalette.purple3;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled}
      onPress={onPress}
      style={[styles.touchable, disabled && styles.disabled]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.shell, { borderColor: theme.border }]}
      >
        <View style={styles.badgeRow}>
          {badgeLabel ? (
            <Pill label={badgeLabel} tone={tone === 'green' ? 'success' : 'accent'} compact />
          ) : (
            <View />
          )}
          <Ionicons name={icon} size={18} color={accent} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <View
          style={[
            styles.cta,
            {
              borderColor: 'rgba(255,255,255,0.28)',
              backgroundColor: ctaBackgroundColor || 'rgba(15,23,42,0.24)',
            },
          ]}
        >
          <Text style={styles.ctaText}>{cta}</Text>
          <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.62,
  },
  shell: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    minHeight: 144,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 10,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
  },
  description: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default GradientActionCard;
