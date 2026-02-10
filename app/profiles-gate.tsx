import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signOutAndRedirect } from '@/lib/authActions';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { validateUserAccess, routeAfterLogin } from '@/lib/routeAfterLogin';
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
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveringProfile, setIsRecoveringProfile] = useState(false);
  const [accessValidation, setAccessValidation] = useState<ReturnType<typeof validateUserAccess> | null>(null);
  const navigationInProgressRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);

  useEffect(() => {
    if (loading || !user) return;

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
      if (validation.hasAccess && !navigationInProgressRef.current) {
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

  const isProfilePending =
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

function withAlpha(color: string | undefined, alpha: number, fallback: string): string {
  const base = color && color.startsWith('#') ? color.slice(1) : '';
  if (base.length !== 6) return fallback;
  const r = parseInt(base.slice(0, 2), 16);
  const g = parseInt(base.slice(2, 4), 16);
  const b = parseInt(base.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return fallback;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createStyles(theme: ThemeColors) {
  const primary = theme?.primary || '#0b6bff';
  const primarySoft = withAlpha(primary, 0.12, '#e8f1ff');
  const primaryBorder = withAlpha(primary, 0.24, '#d7e6ff');
  const border = theme?.borderLight || theme?.border || '#e5e7eb';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme?.background || '#ffffff',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
    },
    pendingCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: primarySoft,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: primaryBorder,
    },
    pendingTitle: {
      marginTop: 12,
      fontSize: 20,
      fontWeight: '700',
      color: theme?.text || '#0b1b34',
      textAlign: 'center',
    },
    pendingDescription: {
      marginTop: 8,
      fontSize: 15,
      color: theme?.textSecondary || '#4b5563',
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
      color: primary,
    },
    pendingHint: {
      marginTop: 12,
      fontSize: 13,
      color: theme?.textSecondary || '#6b7280',
      textAlign: 'center',
      lineHeight: 18,
    },
    pendingActionButton: {
      marginTop: 16,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: primary,
    },
    pendingActionText: {
      color: theme?.onPrimary || '#ffffff',
      fontWeight: '700',
      fontSize: 14,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 24,
      paddingTop: 40,
      alignItems: 'center',
    },
    brandBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: primarySoft,
      borderWidth: 1,
      borderColor: primaryBorder,
      marginBottom: 20,
    },
    brandBadgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme?.text || '#0b1b34',
      letterSpacing: 0.2,
    },
    iconContainer: {
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme?.text || '#000',
      textAlign: 'center',
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      color: theme?.textSecondary || '#666',
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
      color: primary,
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
      backgroundColor: theme?.surface || '#f8f9fa',
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: 'transparent',
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectedRoleCard: {
      backgroundColor: primarySoft,
      borderColor: primary,
    },
    roleCardContent: {
      flex: 1,
    },
    roleTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme?.text || '#000',
      marginTop: 8,
      marginBottom: 4,
    },
    selectedRoleTitle: {
      color: primary,
    },
    roleDescription: {
      fontSize: 14,
      color: theme?.textSecondary || '#666',
      lineHeight: 20,
    },
    selectedRoleDescription: {
      color: theme?.textSecondary || '#0066CC',
    },
    radioContainer: {
      marginLeft: 16,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedRadio: {
      borderColor: primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: primary,
    },
    continueButton: {
      backgroundColor: primary,
      borderRadius: 12,
      height: 56,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    disabledButton: {
      backgroundColor: border,
    },
    continueButtonText: {
      color: theme?.onPrimary || '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    primaryButton: {
      backgroundColor: primary,
      borderRadius: 12,
      height: 56,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    primaryButtonText: {
      color: theme?.onPrimary || '#ffffff',
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
      color: primary,
      fontSize: 16,
      fontWeight: '500',
    },
  });
}
