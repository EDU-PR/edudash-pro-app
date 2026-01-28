// filepath: /media/king/5e026cdc-594e-4493-bf92-c35c231beea3/home/king/Desktop/dashpro/app/screens/principal-onboarding.tsx
// Principal Onboarding Screen - Refactored for WARP.md compliance (≤500 lines)

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/principal/useOnboarding';
import {
  StepIndicator,
  TypeSelectionStep,
  DetailsStep,
  InvitesStep,
  TemplatesStep,
  ReviewStep,
} from '@/components/principal/onboarding';

export default function PrincipalOnboardingScreen() {
  const { user, profile, refreshProfile } = useAuth();

  // Guard: redirect if not authenticated
  useEffect(() => {
    if (!user) {
      try { router.replace('/(auth)/sign-in'); } catch { /* noop */ }
    }
  }, [user]);

  const onboarding = useOnboarding({ user, profile, refreshProfile });

  const schoolTypeLabel = onboarding.schoolType === 'preschool' 
    ? 'preschool' 
    : onboarding.schoolType === 'k12_school' 
      ? 'school' 
      : 'educational institution';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          title: 'Principal Onboarding',
          headerShown: true,
          headerStyle: { backgroundColor: '#0b1220' },
          headerTitleStyle: { color: '#fff' },
          headerTintColor: '#00f5ff',
        }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>
          Welcome, {onboarding.adminName || profile?.first_name || 'Principal'}
        </Text>
        <Text style={styles.subheading}>
          {onboarding.step === 'type_selection'
            ? 'First, tell us what type of educational institution you run.'
            : `Let's set up your ${schoolTypeLabel} in a few quick steps.`}
        </Text>

        <StepIndicator currentStep={onboarding.step} showSubscriptionStep={onboarding.showSubscriptionStep} />

        {onboarding.step === 'type_selection' && (
          <TypeSelectionStep
            schoolType={onboarding.schoolType}
            onSelectType={onboarding.setSchoolType}
            onContinue={() => onboarding.setStep('details')}
          />
        )}

        {onboarding.step === 'details' && (
          <DetailsStep
            schoolName={onboarding.schoolName}
            adminName={onboarding.adminName}
            phone={onboarding.phone}
            planTier={onboarding.planTier}
            onChangeSchoolName={(v) => onboarding.setField('schoolName', v)}
            onChangeAdminName={(v) => onboarding.setField('adminName', v)}
            onChangePhone={(v) => onboarding.setField('phone', v)}
            onChangePlanTier={(t) => onboarding.setField('planTier', t)}
            canCreate={onboarding.canCreate}
            creating={onboarding.creating}
            onCreate={onboarding.handleCreateSchool}
          />
        )}

        {onboarding.step === 'invites' && (
          <InvitesStep
            emailInput={onboarding.emailInput}
            emails={onboarding.emails}
            sentInvites={onboarding.sentInvites}
            sendingInvites={onboarding.sendingInvites}
            onChangeEmailInput={(v) => onboarding.setField('emailInput', v)}
            onAddEmail={onboarding.addEmail}
            onRemoveEmail={onboarding.removeEmail}
            onSendInvites={onboarding.sendInvites}
            onBack={() => onboarding.setStep('details')}
          />
        )}

        {onboarding.step === 'templates' && (
          <TemplatesStep
            selectedTemplates={onboarding.selectedTemplates}
            onToggleTemplate={onboarding.toggleTemplate}
            onContinue={() => onboarding.setStep(onboarding.showSubscriptionStep ? 'subscription' : 'review')}
            onSkip={() => {
              onboarding.setField('selectedTemplates', []);
              onboarding.setStep(onboarding.showSubscriptionStep ? 'subscription' : 'review');
            }}
            onBack={() => onboarding.setStep('invites')}
          />
        )}

        {onboarding.step === 'subscription' && onboarding.showSubscriptionStep && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Subscription Plan (Optional)</Text>
            <Text style={styles.hint}>Choose a plan to unlock premium features.</Text>
            <View style={styles.planContainer}>
              {['free', 'starter'].map(plan => (
                <TouchableOpacity
                  key={plan}
                  style={[styles.planOption, onboarding.planTier === plan && styles.planOptionActive]}
                  onPress={() => onboarding.setField('planTier', plan)}
                >
                  <View style={[styles.typeRadio, onboarding.planTier === plan && styles.typeRadioActive]} />
                  <View style={styles.typeContent}>
                    <Text style={[styles.typeName, onboarding.planTier === plan && styles.typeNameActive]}>
                      {plan === 'free' ? 'Free Plan' : 'Starter Plan'}
                    </Text>
                    <Text style={styles.typeDesc}>
                      {plan === 'free' ? 'Basic features • Limited seats' : 'More features • 10 teachers'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.button} onPress={() => onboarding.setStep('review')}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onboarding.setStep('templates')} style={styles.linkBtn}>
              <Text style={styles.linkText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {onboarding.step === 'review' && (
          <ReviewStep
            schoolName={onboarding.schoolName}
            planTier={onboarding.planTier}
            emailCount={onboarding.emails.length}
            templateCount={onboarding.selectedTemplates.length}
            onFinish={onboarding.finish}
            onBack={() => onboarding.setStep(onboarding.showSubscriptionStep ? 'subscription' : 'templates')}
          />
        )}

        {/* Sign-in option */}
        <View style={styles.signInContainer}>
          <Text style={styles.signInText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')} style={{ marginTop: 8 }}>
            <Text style={styles.signInLink}>Sign In Instead</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  subheading: { color: '#9CA3AF', marginBottom: 16 },
  label: { color: '#E5E7EB', marginTop: 12, marginBottom: 6, fontWeight: '600' },
  hint: { color: '#9CA3AF', marginTop: 6, fontSize: 13 },
  button: { marginTop: 18, backgroundColor: '#00f5ff', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#000', fontWeight: '800' },
  linkBtn: { marginTop: 10, alignSelf: 'flex-start' },
  linkText: { color: '#00f5ff', textDecorationLine: 'underline' },
  planContainer: { gap: 12, marginTop: 12, marginBottom: 16 },
  planOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827',
    borderWidth: 1, borderColor: '#1f2937', borderRadius: 10, padding: 12, gap: 12,
  },
  planOptionActive: { borderColor: '#00f5ff', backgroundColor: '#0b1f26' },
  typeRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#1f2937' },
  typeRadioActive: { backgroundColor: '#00f5ff', borderColor: '#00f5ff' },
  typeContent: { flex: 1 },
  typeName: { color: '#E5E7EB', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  typeNameActive: { color: '#00f5ff' },
  typeDesc: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
  signInContainer: { marginTop: 32, alignItems: 'center', paddingBottom: 20 },
  signInText: { color: '#9CA3AF', fontSize: 14 },
  signInLink: { color: '#00f5ff', fontSize: 16, fontWeight: '600' },
});
