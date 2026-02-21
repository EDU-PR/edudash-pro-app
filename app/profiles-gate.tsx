import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signOutAndRedirect } from '@/lib/authActions';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { validateUserAccess, routeAfterLogin, isNavigationLocked } from '@/lib/routeAfterLogin';
import { createProfilesGateStyles } from '@/features/auth/profiles-gate.styles';
import { fetchEnhancedUserProfile, type Role } from '@/lib/rbac';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const TAG = 'ProfilesGate';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
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
  const { user, profile, refreshProfile, loading, profileLoading } = useAuth();
  const { isOnboardingComplete } = useOnboarding();
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createProfilesGateStyles(theme), [theme]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveringProfile, setIsRecoveringProfile] = useState(false);
  const [accessValidation, setAccessValidation] = useState<ReturnType<typeof validateUserAccess> | null>(null);
  const navigationInProgressRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);
  const lastRecoveryUserId = useRef<string | null>(null);

  // Timeout escape: after 12s total, stop showing the pending spinner
  const [pendingTimeout, setPendingTimeout] = useState(false);

  useEffect(() => {
    // Allow recovery to proceed even if AuthContext `loading` stays true for too long
    // (e.g., network timeout). After 5s we force through.
    if (!user) return;
    if (loading && !pendingTimeout) return;

    // Reset recovery when user changes (prevents stale ref blocking a new user)
    if (user.id !== lastRecoveryUserId.current) {
      recoveryAttemptedRef.current = false;
      navigationInProgressRef.current = false;
      lastRecoveryUserId.current = user.id;
    }

    const noteOnboardingNeeds = () => {
      if (!profile || !user) return;
      const needsOnboarding = !profile.date_of_birth;
      if (needsOnboarding && !isOnboardingComplete) {
        logger.info(TAG, 'User missing DOB/profile basics; continuing to dashboard and handling onboarding in-app.');
      }
    };

    // Try a one-time profile recovery before showing the gate UI.
    const attemptProfileRecovery = async () => {
      if (recoveryAttemptedRef.current || profile) return;
      recoveryAttemptedRef.current = true;
      setIsRecoveringProfile(true);
      logger.info(TAG, 'No profile found, attempting refresh...');

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
        logger.info(TAG, 'No profile found, checking if existing user...');
        try {
          // Try to detect user role from legacy methods
          const { detectRoleAndSchool } = await import('@/lib/routeAfterLogin');
          const { role } = await detectRoleAndSchool(user);
          
          if (role) {
            logger.info(TAG, 'Found existing user role:', role);
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
      noteOnboardingNeeds();

      const validation = validateUserAccess(profile);
      setAccessValidation(validation);
      
      // DOB onboarding is non-blocking for existing users with valid role/access.
      if (validation.hasAccess && !navigationInProgressRef.current && !isNavigationLocked(user.id)) {
        navigationInProgressRef.current = true;
        routeAfterLogin(user, profile).catch(console.error);
      }
    } else {
      if (!recoveryAttemptedRef.current) {
        void attemptProfileRecovery();
        return;
      }
      // Try to handle existing users who may not have proper profile data
      void handleExistingUser();
    }
  }, [profile, user, loading, isOnboardingComplete, refreshProfile, selectedRole, pendingTimeout]);

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
      logger.info(TAG, 'Continuing with selected role:', selectedRole);
      
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
            logger.info(TAG, 'Successfully updated user metadata with role:', selectedRole);
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
        logger.info(TAG, 'Using enhanced routing with profile:', updatedProfile);
        await routeAfterLogin(user, updatedProfile);
        return;
      }
      
      // Fallback: Route directly based on selected role
      logger.info(TAG, 'Using fallback routing for role:', selectedRole);
      const routes = {
        'parent': '/screens/parent-dashboard',
        'teacher': '/screens/teacher-dashboard', 
        'principal_admin': '/screens/principal-dashboard',
      };
      
      const targetRoute = routes[selectedRole as keyof typeof routes];
      if (targetRoute && !navigationInProgressRef.current) {
        logger.info(TAG, 'Routing to:', targetRoute);
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
      await signOutAndRedirect({ redirectTo: '/(auth)/sign-in' });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Timeout escape: after 12s total, stop showing the pending spinner
  // regardless of loading state to prevent infinite stuck screen.
  useEffect(() => {
    const timer = setTimeout(() => setPendingTimeout(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  const isProfilePending =
    !pendingTimeout &&
    !!user &&
    !profile &&
    (loading || profileLoading || isRecoveringProfile || !recoveryAttemptedRef.current);

  if (isProfilePending) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

        <View style={styles.loadingContainer}>
          <View style={styles.brandBadge}>
            <Ionicons name="sparkles" size={16} color={theme.primary} />
            <Text style={styles.brandBadgeText}>EduDash Pro</Text>
          </View>
          <View style={styles.pendingCard}>
            <Ionicons name="sparkles-outline" size={36} color={theme.primary} />
            <Text style={styles.pendingTitle}>Restoring your account</Text>
            <Text style={styles.pendingDescription}>
              We are fetching your profile, permissions, and organization access.
            </Text>
            <View style={styles.pendingSpinnerRow}>
              <EduDashSpinner size="small" color={theme.primary} />
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
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
        
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.brandBadge}>
            <Ionicons name="sparkles" size={16} color={theme.primary} />
            <Text style={styles.brandBadgeText}>EduDash Pro</Text>
          </View>
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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.brandBadge}>
          <Ionicons name="sparkles" size={16} color={theme.primary} />
          <Text style={styles.brandBadgeText}>EduDash Pro</Text>
        </View>
        <View style={styles.iconContainer}>
          <Ionicons name="person-add-outline" size={64} color={theme.primary} />
        </View>
        
        <Text style={styles.title}>Welcome to EduDash</Text>
        <Text style={styles.description}>
          To get started, please let us know your role in education.
        </Text>

        {isRecoveringProfile && (
          <View style={styles.recoveringContainer}>
            <EduDashSpinner size="small" color={theme.primary} />
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
                  color={selectedRole === role.value ? theme.primary : theme.textSecondary} 
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
            <EduDashSpinner color="#ffffff" />
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
