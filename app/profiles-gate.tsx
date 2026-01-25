import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { validateUserAccess, routeAfterLogin } from '@/lib/routeAfterLogin';
import { fetchEnhancedUserProfile, type Role } from '@/lib/rbac';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { assertSupabase } from '@/lib/supabase';

const ROLES = [
  {
    value: 'parent' as Role,
    label: 'Parent',
    description: 'Access your child\'s learning journey',
    icon: 'people',
  },
  {
    value: 'teacher' as Role,
    label: 'Teacher',
    description: 'Manage your classroom and students',
    icon: 'school',
  },
  {
    value: 'principal_admin' as Role,
    label: 'Principal/Administrator',
    description: 'Oversee school operations',
    icon: 'business',
  },
] as const;

/**
 * Enhanced Profile Gate Screen
 * - Handles cases where users need profile setup or validation
 * - Integrates with RBAC system for proper role assignment
 * - Provides clear path forward for users with access issues
 */
export default function ProfilesGateScreen() {
  const { user, profile, refreshProfile, loading, profileLoading, signOut } = useAuth();
  const { isOnboardingComplete } = useOnboarding();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveringProfile, setIsRecoveringProfile] = useState(false);
  const [accessValidation, setAccessValidation] = useState<ReturnType<typeof validateUserAccess> | null>(null);
  const navigationInProgressRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);

  useEffect(() => {
    if (loading || !user) return;

    // Check if user needs onboarding (missing DOB, org type, etc.)
    const checkOnboardingNeeded = async () => {
      if (!profile || !user) return;

      // Check if user has completed basic onboarding requirements
      const needsOnboarding = !profile.date_of_birth;

      if (needsOnboarding && !isOnboardingComplete && !navigationInProgressRef.current) {
        console.log('Profiles-gate: User needs onboarding, redirecting...');
        navigationInProgressRef.current = true;
        router.replace('/onboarding');
        return true;
      }
      return false;
    };

    // Try a one-time profile recovery before showing the gate UI.
    const attemptProfileRecovery = async () => {
      if (recoveryAttemptedRef.current || profile) return;
      recoveryAttemptedRef.current = true;
      setIsRecoveringProfile(true);
      console.log('Profiles-gate: No profile found, attempting refresh...');

      const PROFILE_RECOVERY_TIMEOUT_MS = 6000;
      try {
        await Promise.race([
          refreshProfile(),
          new Promise<void>((resolve) => setTimeout(resolve, PROFILE_RECOVERY_TIMEOUT_MS)),
        ]);
      } catch (refreshError) {
        console.error('Profiles-gate: Profile refresh failed:', refreshError);
      } finally {
        setIsRecoveringProfile(false);
      }
    };

    // If profile is still missing after recovery, detect a likely role but
    // avoid routing loops by not redirecting without a real profile.
    const handleExistingUser = async () => {
      if (!profile && user && !selectedRole) {
        console.log('Profiles-gate: No profile found, checking if existing user...');
        try {
          // Try to detect user role from legacy methods
          const { detectRoleAndSchool } = await import('@/lib/routeAfterLogin');
          const { role } = await detectRoleAndSchool(user);
          
          if (role) {
            console.log('Profiles-gate: Found existing user role:', role);
            const supportedRoles: Role[] = ['parent', 'teacher', 'principal_admin'];
            if (supportedRoles.includes(role as Role) && !selectedRole) {
              setSelectedRole(role as Role);
            }
          }
        } catch (error) {
          console.error('Error detecting existing user role:', error);
        }
      }
    };

    if (profile) {
      // Check onboarding first
      checkOnboardingNeeded().then(needsOnboarding => {
        if (needsOnboarding) return; // Already redirected

        const validation = validateUserAccess(profile);
        setAccessValidation(validation);
        
        // If user has valid access, route them appropriately
        if (validation.hasAccess && !navigationInProgressRef.current) {
          navigationInProgressRef.current = true;
          routeAfterLogin(user, profile).catch(console.error);
        }
      });
    } else {
      if (!recoveryAttemptedRef.current) {
        void attemptProfileRecovery();
        return;
      }
      // Try to handle existing users who may not have proper profile data
      void handleExistingUser();
    }
  }, [profile, user, loading, isOnboardingComplete, refreshProfile, selectedRole]);

  const handleRoleSelection = (role: Role) => {
    setSelectedRole(role);
    track('edudash.profile_gate.role_selected', {
      user_id: user?.id,
      selected_role: role,
    });
  };

  const handleContinue = async () => {
    if (!selectedRole || !user) return;

    setIsSubmitting(true);
    
    try {
      console.log('Profile gate: Continuing with selected role:', selectedRole);
      
      track('edudash.profile_gate.role_submitted', {
        user_id: user.id,
        submitted_role: selectedRole,
      });

      // First, try to update the user's profile/metadata with selected role
      try {
        // Update user metadata to persist the selected role
        try {
          const { error: updateError } = await assertSupabase().auth.updateUser({
            data: { 
              role: selectedRole,
              profile_completed: true,
              profile_completion_timestamp: new Date().toISOString()
            }
          });

          if (updateError) {
            console.error('Failed to update user metadata:', updateError);
          } else {
            console.log('Successfully updated user metadata with role:', selectedRole);
          }
        } catch { /* Intentional: non-fatal */ }

      } catch (metadataError) {
        console.error('Error updating user metadata:', metadataError);
        // Continue anyway, as this is not critical for routing
      }

      // Refresh profile to get updated data
      await refreshProfile();
      
      // Try to get enhanced profile first
      let updatedProfile;
      try {
        updatedProfile = await fetchEnhancedUserProfile(user.id);
      } catch (profileError) {
        console.error('Error fetching enhanced profile:', profileError);
      }

      // If we have an enhanced profile with proper role, use enhanced routing
      if (updatedProfile && updatedProfile.role) {
        console.log('Profile gate: Using enhanced routing with profile:', updatedProfile);
        await routeAfterLogin(user, updatedProfile);
        return;
      }
      
      // Fallback: Route directly based on selected role
      console.log('Profile gate: Using fallback routing for role:', selectedRole);
      const routes = {
        'parent': '/screens/parent-dashboard',
        'teacher': '/screens/teacher-dashboard', 
        'principal_admin': '/screens/principal-dashboard',
      };
      
      const targetRoute = routes[selectedRole as keyof typeof routes];
      if (targetRoute && !navigationInProgressRef.current) {
        console.log('Profile gate: Routing to:', targetRoute);
        navigationInProgressRef.current = true;
        router.replace(targetRoute as `/${string}`);
        return;
      }
      // Default fallback to sign-in
      if (!navigationInProgressRef.current) {
        navigationInProgressRef.current = true;
        router.replace('/(auth)/sign-in' as `/${string}`);
      }
      return;
    } catch (error) {
      console.error('Profile gate: Continue failed:', error);
      reportError(new Error('Profile setup failed'), {
        userId: user.id,
        selectedRole,
        error,
      });
      
      Alert.alert(
        'Setup Error',
        'There was a problem setting up your profile. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContactSupport = () => {
    track('edudash.profile_gate.contact_support', {
      user_id: user?.id,
      reason: accessValidation?.reason,
    });
    
    Alert.alert(
      'Contact Support',
      'Please contact your organization administrator or our support team for assistance with your account access.',
      [{ text: 'OK' }]
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Ensure we land on the auth screen immediately after sign-out
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const isProfilePending =
    !!user &&
    !profile &&
    (loading || profileLoading || isRecoveringProfile || !recoveryAttemptedRef.current);

  if (isProfilePending) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <RoleBasedHeader title="Setting up your workspace" />

        <View style={styles.loadingContainer}>
          <View style={styles.pendingCard}>
            <Ionicons name="sparkles-outline" size={36} color="#007AFF" />
            <Text style={styles.pendingTitle}>Restoring your account</Text>
            <Text style={styles.pendingDescription}>
              We are fetching your profile, permissions, and organization access.
            </Text>
            <View style={styles.pendingSpinnerRow}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.pendingSpinnerText}>Almost there...</Text>
            </View>
            <Text style={styles.pendingHint}>
              If this takes too long, you can sign out and try again.
            </Text>
            <TouchableOpacity
              style={styles.pendingActionButton}
              onPress={handleSignOut}
              accessibilityLabel="Sign out and return to sign in"
            >
              <Text style={styles.pendingActionText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // If user has profile but access issues
  if (profile && accessValidation && !accessValidation.hasAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <RoleBasedHeader title="Account Access" />
        
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning-outline" size={64} color="#FF9500" />
          </View>
          
          <Text style={styles.title}>Account Setup Required</Text>
          <Text style={styles.description}>
            Your account needs to be configured with the correct role and permissions.
            Please contact your administrator or select your role below.
          </Text>
          
          <Text style={styles.suggestion}>
            If you're unsure of your role, please contact support for assistance.
          </Text>
          
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleContactSupport}
            accessibilityLabel="Contact support for help"
          >
            <Text style={styles.primaryButtonText}>Contact Support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={handleSignOut}
            accessibilityLabel="Sign out"
          >
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Profile setup flow for users without profiles
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <RoleBasedHeader title="Complete Your Profile" />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="person-add-outline" size={64} color="#007AFF" />
        </View>
        
        <Text style={styles.title}>Welcome to EduDash</Text>
        <Text style={styles.description}>
          To get started, please let us know your role in education.
        </Text>

        {isRecoveringProfile && (
          <View style={styles.recoveringContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.recoveringText}>Restoring your profile...</Text>
          </View>
        )}
        
        <View style={styles.rolesList}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.value}
              style={[
                styles.roleCard,
                selectedRole === role.value && styles.selectedRoleCard,
              ]}
              onPress={() => handleRoleSelection(role.value)}
              accessibilityLabel={`Select ${role.label} role`}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedRole === role.value }}
            >
              <View style={styles.roleCardContent}>
                <Ionicons 
                  name={role.icon as keyof typeof Ionicons.glyphMap} 
                  size={32} 
                  color={selectedRole === role.value ? '#007AFF' : '#666'} 
                />
                <Text style={[
                  styles.roleTitle,
                  selectedRole === role.value && styles.selectedRoleTitle,
                ]}>
                  {role.label}
                </Text>
                <Text style={[
                  styles.roleDescription,
                  selectedRole === role.value && styles.selectedRoleDescription,
                ]}>
                  {role.description}
                </Text>
              </View>
              
              <View style={styles.radioContainer}>
                <View style={[
                  styles.radio,
                  selectedRole === role.value && styles.selectedRadio,
                ]}>
                  {selectedRole === role.value && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedRole || isSubmitting) && styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={!selectedRole || isSubmitting}
          accessibilityLabel="Continue with selected role"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
        >
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pendingCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#f7faff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e3efff',
  },
  pendingTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#0b1b34',
    textAlign: 'center',
  },
  pendingDescription: {
    marginTop: 8,
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 22,
  },
  pendingSpinnerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingSpinnerText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  pendingHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  pendingActionButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0b6bff',
  },
  pendingActionText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  recoveringContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recoveringText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  suggestion: {
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 32,
  },
  rolesList: {
    width: '100%',
    marginBottom: 32,
  },
  roleCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedRoleCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
  },
  roleCardContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 8,
    marginBottom: 4,
  },
  selectedRoleTitle: {
    color: '#007AFF',
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  selectedRoleDescription: {
    color: '#0066CC',
  },
  radioContainer: {
    marginLeft: 16,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRadio: {
    borderColor: '#007AFF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
