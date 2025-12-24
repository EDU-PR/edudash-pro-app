/**
 * Public Member Registration Screen
 * Multi-step registration flow for new members joining Soil of Africa
 * 
 * Refactored to use modular step components following WARP.md standards
 */
import React, { useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Text,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import {
  RegionStep,
  PersonalStep,
  MembershipStep,
  PaymentStep,
  CompleteStep,
  REGISTRATION_STEPS,
  initialRegistrationData,
  type RegistrationStep as StepType,
  type RegistrationData,
  type RegionConfig,
} from '@/components/membership/registration';

// Soil Of Africa organization ID
const SOIL_OF_AFRICA_ORG_ID = '63b6139a-e21f-447c-b322-376fb0828992';

export default function MemberRegistrationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [currentStep, setCurrentStep] = useState<StepType>('region');
  const [formData, setFormData] = useState<RegistrationData>(initialRegistrationData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedMemberNumber, setGeneratedMemberNumber] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const currentStepIndex = REGISTRATION_STEPS.findIndex(s => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / REGISTRATION_STEPS.length) * 100;

  const updateField = (field: keyof RegistrationData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectRegion = (region: RegionConfig) => {
    setFormData(prev => ({
      ...prev,
      region_id: region.id,
      region_name: region.name,
      region_code: region.code,
    }));
  };

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 'region':
        if (!formData.region_id) {
          Alert.alert('Required', 'Please select your region');
          return false;
        }
        return true;
      case 'personal':
        if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone) {
          Alert.alert('Required', 'Please fill in all required fields');
          return false;
        }
        if (!formData.email.includes('@')) {
          Alert.alert('Invalid', 'Please enter a valid email address');
          return false;
        }
        return true;
      case 'membership':
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validateStep()) return;
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < REGISTRATION_STEPS.length) {
      setCurrentStep(REGISTRATION_STEPS[nextIndex].key);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(REGISTRATION_STEPS[prevIndex].key);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Sign In Required', 'Please sign in or create an account first.');
        router.push('/(auth)/sign-in');
        return;
      }

      // Get next sequence number for the region
      const { count } = await supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('region_id', formData.region_id);
      
      // Generate member number
      const year = new Date().getFullYear().toString().slice(-2);
      const sequence = String((count || 0) + 1).padStart(5, '0');
      const memberNumber = `SOA-${formData.region_code}-${year}-${sequence}`;
      
      // Create organization member record
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: SOIL_OF_AFRICA_ORG_ID,
          region_id: formData.region_id,
          user_id: user.id,
          member_number: memberNumber,
          member_type: formData.member_type || 'learner',
          membership_tier: formData.membership_tier || 'standard',
          membership_status: 'active',
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          id_number: formData.id_number,
          role: 'member',
          join_date: new Date().toISOString(),
        });

      if (memberError) {
        console.error('[Register] Error creating member:', memberError);
        if (memberError.code === '23505') {
          Alert.alert('Already Registered', 'You are already a member of this organization.');
        } else {
          throw memberError;
        }
        return;
      }

      setGeneratedMemberNumber(memberNumber);
      setCurrentStep('complete');
    } catch (error) {
      console.error('[Register] Registration error:', error);
      Alert.alert('Error', 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'region':
        return (
          <RegionStep
            data={formData}
            onSelectRegion={selectRegion}
            theme={theme}
          />
        );
      case 'personal':
        return (
          <PersonalStep
            data={formData}
            onUpdate={updateField}
            theme={theme}
          />
        );
      case 'membership':
        return (
          <MembershipStep
            data={formData}
            onUpdate={updateField}
            theme={theme}
          />
        );
      case 'payment':
        return (
          <PaymentStep
            data={formData}
            theme={theme}
          />
        );
      case 'complete':
        return (
          <CompleteStep
            memberNumber={generatedMemberNumber}
            theme={theme}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: currentStep === 'complete' ? 'Registration Complete' : 'Join Soil of Africa',
          headerLeft: currentStep === 'complete' ? () => null : undefined,
        }}
      />

      {currentStep !== 'complete' && (
        <>
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBg, { backgroundColor: theme.border }]}>
              <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progress}%` }]} />
            </View>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              Step {currentStepIndex + 1} of {REGISTRATION_STEPS.length}
            </Text>
          </View>

          {/* Step Indicators */}
          <View style={styles.stepsIndicator}>
            {REGISTRATION_STEPS.slice(0, -1).map((step, index) => (
              <View key={step.key} style={styles.stepIndicator}>
                <View style={[
                  styles.stepDot,
                  { backgroundColor: index <= currentStepIndex ? theme.primary : theme.border }
                ]}>
                  {index < currentStepIndex ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Ionicons 
                      name={step.icon} 
                      size={14} 
                      color={index === currentStepIndex ? '#fff' : theme.textSecondary} 
                    />
                  )}
                </View>
                <Text style={[
                  styles.stepLabel,
                  { color: index <= currentStepIndex ? theme.text : theme.textSecondary }
                ]}>
                  {step.title}
                </Text>
                {index < REGISTRATION_STEPS.length - 2 && (
                  <View style={[
                    styles.stepLine,
                    { backgroundColor: index < currentStepIndex ? theme.primary : theme.border }
                  ]} />
                )}
              </View>
            ))}
          </View>
        </>
      )}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderCurrentStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Navigation */}
      {currentStep !== 'complete' && (
        <View style={[styles.bottomNav, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
          {currentStepIndex > 0 && (
            <TouchableOpacity 
              style={[styles.backButton, { borderColor: theme.border }]}
              onPress={prevStep}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={[styles.backText, { color: theme.text }]}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[
              styles.nextButton, 
              { backgroundColor: theme.primary },
              currentStepIndex === 0 && { flex: 1 }
            ]}
            onPress={currentStep === 'payment' ? handleSubmit : nextStep}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextText}>
                  {currentStep === 'payment' ? 'Complete Registration' : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  stepsIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepIndicator: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 10,
    marginLeft: 4,
    display: 'none',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  nextText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
