/**
 * Progress steps indicator component for activity builder
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { activityBuilderStyles as styles } from './activity-builder.styles';
import { ActivityStep } from '@/hooks/useActivityBuilder';

interface ProgressStepsProps {
  currentStep: ActivityStep;
}

const STEPS: ActivityStep[] = ['type', 'details', 'content'];

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  const { colors } = useTheme();
  
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <View style={[styles.stepsBar, { backgroundColor: colors.cardBackground }]}>
      {STEPS.map((s, i) => (
        <View key={s} style={styles.stepWrapper}>
          <View
            style={[
              styles.stepDot,
              {
                backgroundColor:
                  s === currentStep ? colors.primary
                    : currentIndex > i ? '#4CAF50'
                    : colors.border,
              },
            ]}
          >
            {currentIndex > i ? (
              <Ionicons name="checkmark" size={12} color="#fff" />
            ) : (
              <Text style={styles.stepNum}>{i + 1}</Text>
            )}
          </View>
          <Text style={[
            styles.stepLabel,
            { color: s === currentStep ? colors.primary : colors.textSecondary },
          ]}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Text>
        </View>
      ))}
    </View>
  );
}
