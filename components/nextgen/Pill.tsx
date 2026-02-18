import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNextGenTheme } from '@/contexts/K12NextGenThemeContext';

type PillTone = 'default' | 'success' | 'accent';

interface PillProps {
  label: string;
  tone?: PillTone;
  compact?: boolean;
}

export function Pill({ label, tone = 'default', compact = false }: PillProps) {
  const { theme } = useNextGenTheme();

  const toneStyle = (() => {
    if (tone === 'success') {
      return {
        backgroundColor: `${theme.success}22`,
        borderColor: `${theme.success}55`,
        textColor: theme.success,
      };
    }
    if (tone === 'accent') {
      return {
        backgroundColor: `${theme.primary}22`,
        borderColor: `${theme.primary}66`,
        textColor: theme.primaryLight || theme.primary,
      };
    }
    return {
      backgroundColor: theme.surfaceVariant,
      borderColor: theme.border,
      textColor: theme.textSecondary,
    };
  })();

  return (
    <View
      style={[
        styles.pill,
        compact ? styles.compact : styles.regular,
        { backgroundColor: toneStyle.backgroundColor, borderColor: toneStyle.borderColor },
      ]}
    >
      <Text style={[styles.text, compact && styles.compactText, { color: toneStyle.textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
  },
  regular: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compact: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
  compactText: {
    fontSize: 11,
  },
});

export default Pill;
