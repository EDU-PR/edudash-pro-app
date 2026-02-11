/**
 * DashContextChips Component
 * 
 * Context chips display for learner information (grade, age, school type).
 * Extracted from DashAssistant for WARP.md compliance.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type Theme = ReturnType<typeof useTheme>['theme'];

interface DashContextChipsProps {
  chips: string[];
  contextHint: string | null;
  styles: any;
  theme: Theme;
}

export const DashContextChips: React.FC<DashContextChipsProps> = React.memo(function DashContextChips({
  chips,
  contextHint,
  styles,
  theme,
}) {
  if (chips.length === 0 && !contextHint) return null;

  return (
    <>
      {chips.length > 0 && (
        <View style={[styles.contextStrip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {chips.map((chip, idx) => (
            <View
              key={`${chip}-${idx}`}
              style={[styles.contextChip, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
            >
              <Text style={[styles.contextChipText, { color: theme.textSecondary }]}>{chip}</Text>
            </View>
          ))}
        </View>
      )}
      {contextHint && (
        <Text style={[styles.contextHint, { color: theme.textSecondary }]}>{contextHint}</Text>
      )}
    </>
  );
});
