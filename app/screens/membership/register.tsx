/**
 * Public Member Registration Screen
 * Multi-step registration flow for new members joining Soil of Africa
 * 
 * Refactored to use modular step components following WARP.md standards
 */
import React, { useState, useRef, useEffect } from 'react';
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
import { Stack, router, useLocalSearchParams } from 'expo-router';
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
  const params = useLocalSearchParams<{ inviteCode?: string }>();
  
  const [currentStep, setCurrentStep] = useState<StepType>('region');
  const [formData, setFormData] = useState<RegistrationData>(initialRegistrationData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedMemberNumber, setGeneratedMemberNumber] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Handle invite code from URL params - fetch details including role
  useEffect(() => {
    async function fetchInviteDetails() {
      if (!params?.inviteCode) return;
      
      setInviteCode(params.inviteCode);
      setFormData(prev => ({ ...prev, invite_code: params.inviteCode }));
      
      try {
        const supabase = assertSupabase();
        const { data: invite } = await supabase
          .from('join_requests')
          .select('requested_role, organizations(name)')
          .eq('invite_code', params.inviteCode.toUpperCase())
          .eq('status', 'pending')
          .single();
        
        if (invite) {
          const role = invite.requested_role || 'youth_member';
          setInviteRole(role);
          // Map requested_role to member_type
          // Most roles map to themselves, some have different display names
          const memberTypeMap: Record<string, string> = {
            'youth_member': 'learner',
            'youth_volunteer': 'volunteer',
            'youth_coordinator': 'facilitator',
            'regional_manager': 'regional_manager',
            'provincial_manager': 'provincial_manager',
            'national_coordinator': 'national_coordinator',
            'executive': 'executive',
            'president': 'president',
            'ceo': 'ceo',
          };
          setFormData(prev => ({ 
            ...prev, 
            member_type: (memberTypeMap[role] || role) as any,  // Fallback to role itself if not in map
          }));
          
          const org = invite.organizations as any;
          if (org?.name) {
            setInviteOrgName(org.name);
          }
        }
      } catch (e) {
        console.error('Error fetching invite details:', e);
      }
    }
    
    fetchInviteDetails();
  }, [params?.inviteCode]);

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
        // Validate email format properly
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          Alert.alert('Invalid Email', 'Please enter a valid email address (e.g., user@example.com)');
          return false;
        }
        if (!formData.password || formData.password.length < 6) {
          Alert.alert('Password Required', 'Please enter a password with at least 6 characters');
          return false;
        }
        if (formData.password !== formData.confirm_password) {
          Alert.alert('Password Mismatch', 'Passwords do not match');
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
      
      // Check if user is already logged in
      let { data: { user } } = await supabase.auth.getUser();
      
      // If not logged in, create a new account with the provided credentials
      if (!user) {
        console.log('[Register] Creating new user account...');
        
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.first_name,
              last_name: formData.last_name,
              phone: formData.phone,
            },
            // Redirect to Soil of Africa website after email confirmation
            emailRedirectTo: 'https://www.soilofafrica.org/auth/callback?flow=email-confirm',
          },
        });
        
        if (signUpError) {
          console.error('[Register] Sign up error:', signUpError);
          if (signUpError.message.includes('already registered')) {
            Alert.alert(
              'Account Exists',
              'An account with this email already exists. Would you like to sign in instead?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Sign In', 
                  onPress: () => router.push(`/(auth)/sign-in?email=${encodeURIComponent(formData.email)}`)
                }
              ]
            );
          } else {
            Alert.alert('Sign Up Failed', signUpError.message);
          }
          return;
        }
        
        if (!signUpData.user) {
          Alert.alert('Error', 'Failed to create account. Please try again.');
          return;
        }
        
        user = signUpData.user;
        console.log('[Register] User created successfully:', user.id);
        
        // IMPORTANT: Create membership record BEFORE checking session
        // This ensures the user is added to the org even if email confirmation is required
        
        // Generate random 6-digit member number (unique within org)
        const generateRandomMemberNumber = async (): Promise<string> => {
          let memberNum: string;
          let isUnique = false;
          let attempts = 0;
          
          while (!isUnique && attempts < 10) {
            // Generate random 6-digit number (100000-999999)
            const randomNum = Math.floor(100000 + Math.random() * 900000);
            memberNum = String(randomNum);
            
            // Check if it's unique within the organization
            const { count } = await supabase
              .from('organization_members')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', SOIL_OF_AFRICA_ORG_ID)
              .eq('member_number', memberNum);
            
            if (count === 0) {
              isUnique = true;
            }
            attempts++;
          }
          
          return memberNum!;
        };
        
        const memberNumber = await generateRandomMemberNumber();
        
        // Create organization member record (with pending status if email not confirmed)
        const membershipStatus = signUpData.session ? 'active' : 'pending_verification';
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: SOIL_OF_AFRICA_ORG_ID,
            region_id: formData.region_id,
            user_id: user.id,
            member_number: memberNumber,
            member_type: formData.member_type || 'learner',
            membership_tier: formData.membership_tier || 'standard',
            membership_status: membershipStatus,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            id_number: formData.id_number,
            role: 'member',
            join_date: new Date().toISOString(),
            invite_code_used: inviteCode || null,
            joined_via: inviteCode ? 'invite_code' : 'direct_registration',
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
        
        // IMPORTANT: Update the user's profile to link them to the organization
        // This ensures the routing system can find their organization_membership
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ 
            organization_id: SOIL_OF_AFRICA_ORG_ID,
            first_name: formData.first_name,
            last_name: formData.last_name,
          })
          .eq('id', user.id);
        
        if (profileUpdateError) {
          console.error('[Register] Error updating profile with org:', profileUpdateError);
          // Non-fatal - continue with registration
        } else {
          console.log('[Register] Profile updated with organization_id');
        }
        
        // If invite code was used, mark it as used
        if (inviteCode) {
          await supabase
            .from('join_requests')
            .update({ 
              status: 'approved',
              reviewed_at: new Date().toISOString(),
            })
            .eq('invite_code', inviteCode.toUpperCase())
            .eq('status', 'pending');
        }
        
        setGeneratedMemberNumber(memberNumber);
        
        // Check if we have a session - if not, email confirmation is required
        if (!signUpData.session) {
          console.log('[Register] No session after signup - email confirmation required');
          // Email confirmation is required
          Alert.alert(
            'Account Created! 🎉',
            `Your account was created successfully!\n\nYour Member Number: ${memberNumber}\n\nPlease check your email to confirm your account, then sign in.`,
            [{ text: 'OK', onPress: () => router.push('/(auth)/sign-in') }]
          );
          setIsSubmitting(false);
          return;
        }
        
        console.log('[Register] Session available after signup - membership setup complete');
      }

      // If user already exists (was signed in), we still need to create membership
      // But only if it wasn't already created above for new signups
      if (!signUpData) {
        // Existing user - generate random member number
        const generateRandomMemberNumberForExisting = async (): Promise<string> => {
          let memberNum: string;
          let isUnique = false;
          let attempts = 0;
          
          while (!isUnique && attempts < 10) {
            const randomNum = Math.floor(100000 + Math.random() * 900000);
            memberNum = String(randomNum);
            
            const { count } = await supabase
              .from('organization_members')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', SOIL_OF_AFRICA_ORG_ID)
              .eq('member_number', memberNum);
            
            if (count === 0) {
              isUnique = true;
            }
            attempts++;
          }
          
          return memberNum!;
        };
        
        const existingMemberNumber = await generateRandomMemberNumberForExisting();
        
        const { error: existingMemberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: SOIL_OF_AFRICA_ORG_ID,
            region_id: formData.region_id,
            user_id: user.id,
            member_number: existingMemberNumber,
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
            invite_code_used: inviteCode || null,
            joined_via: inviteCode ? 'invite_code' : 'direct_registration',
          });

        if (existingMemberError) {
          console.error('[Register] Error creating member:', existingMemberError);
          if (existingMemberError.code === '23505') {
            Alert.alert('Already Registered', 'You are already a member of this organization.');
          } else {
            throw existingMemberError;
          }
          return;
        }
        
        // If invite code was used, mark it as used
        if (inviteCode) {
          await supabase
            .from('join_requests')
            .update({ 
              status: 'approved',
              reviewed_at: new Date().toISOString(),
            })
            .eq('invite_code', inviteCode.toUpperCase())
            .eq('status', 'pending');
        }
        
        setGeneratedMemberNumber(existingMemberNumber);
      }

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
            inviteRole={inviteRole}
            inviteOrgName={inviteOrgName}
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
