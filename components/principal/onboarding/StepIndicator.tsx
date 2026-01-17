// Step indicator component for onboarding wizard

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { OnboardingStep } from './types';

interface StepIndicatorProps {
  currentStep: OnboardingStep;
  showSubscriptionStep: boolean;
}

const STEP_NAMES: Record<OnboardingStep, string> = {
  'type_selection': 'Type',
  'details': 'School',
  'invites': 'Teachers',
  'templates': 'Setup',
  'subscription': 'Plan',
  'review': 'Review',
};

export function StepIndicator({ currentStep, showSubscriptionStep }: StepIndicatorProps) {
  const steps: OnboardingStep[] = showSubscriptionStep
    ? ['type_selection', 'details', 'invites', 'templates', 'subscription', 'review']
    : ['type_selection', 'details', 'invites', 'templates', 'review'];

  return (
    <View style={styles.stepper}>
      {steps.map((s, idx) => (
        <View key={s} style={styles.stepItem}>
          <View style={[styles.stepDot, currentStep === s ? styles.stepDotActive : styles.stepDotInactive]} />
          <Text style={[styles.stepLabel, currentStep === s && styles.stepLabelActive]}>
            {idx + 1}. {STEP_NAMES[s]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepDotActive: { backgroundColor: '#00f5ff' },
  stepDotInactive: { backgroundColor: '#1f2937' },
  stepLabel: { color: '#9CA3AF', fontSize: 12 },
  stepLabelActive: { color: '#E5E7EB', fontWeight: '700' },
});
