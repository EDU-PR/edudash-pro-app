/**
 * Change Password Required Screen
 * 
 * This screen is shown to users who were created by an admin
 * and need to change their temporary password on first login.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/marketing/GlassCard';
import { GradientButton } from '@/components/marketing/GradientButton';
import { marketingTokens } from '@/components/marketing/tokens';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { clearAllNavigationLocks, routeAfterLogin } from '@/lib/routeAfterLogin';
import type { User } from '@supabase/supabase-js';

export default function ChangePasswordRequiredScreen() {
  const { theme } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  const { showAlert, alertProps } = useAlertModal();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const continueToDashboard = async (updatedUser?: User | null) => {
    try {
      const supabase = assertSupabase();
      await refreshProfile();

      const authUser =
        updatedUser ??
        (await supabase.auth.getUser()).data.user ??
        user ??
        null;

      if (authUser) {
        clearAllNavigationLocks();
        await routeAfterLogin(authUser as any, profile as any);
        return;
      }

      router.replace('/profiles-gate');
    } catch (error) {
      console.error('[ChangePasswordRequired] Post-update routing failed:', error);
      router.replace('/profiles-gate');
    }
  };

  const handleChangePassword = async () => {
    // Validate passwords
    if (!password || !confirmPassword) {
      showAlert({
        title: 'Error',
        message: 'Please fill in all fields',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (password !== confirmPassword) {
      showAlert({
        title: 'Error',
        message: 'Passwords do not match',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (password.length < 8) {
      showAlert({
        title: 'Error',
        message: 'Password must be at least 8 characters long',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    // Check password strength (basic requirements)
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      showAlert({
        title: 'Weak Password',
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = assertSupabase();
      const nowIso = new Date().toISOString();
      
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      // Clear the force_password_change flag
      const { data: metadataData, error: metadataError } = await supabase.auth.updateUser({
        data: {
          force_password_change: false,
          password_changed_at: nowIso,
        },
      });

      if (metadataError) {
        console.warn('Failed to clear force_password_change flag:', metadataError);
        // Continue anyway - password was updated successfully
      }

      const userForRouting = ((metadataData?.user || user || null) as User | null);
      const patchedUserForRouting = userForRouting
        ? ({
            ...userForRouting,
            user_metadata: {
              ...(userForRouting.user_metadata || {}),
              force_password_change: false,
              password_changed_at: nowIso,
            },
          } as User)
        : null;

      showAlert({
        title: 'Password Updated',
        message: 'Your password has been successfully updated. You can now continue using the app.',
        type: 'success',
        buttons: [
          {
            text: 'Continue',
            style: 'default',
            onPress: async () => {
              await continueToDashboard(patchedUserForRouting);
            },
          },
        ],
      });
    } catch (e: any) {
      console.error('[ChangePasswordRequired] Error:', e);
      showAlert({
        title: 'Error',
        message: e?.message || 'Failed to update password. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setLoading(false);
    }
  };

  const userEmail = user?.email;

  return (
    <LinearGradient
      colors={['#0a0a0f', '#1a1a2e', '#0a0a0f']}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <GlassCard style={styles.card}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={[marketingTokens.colors.accent.cyan400, marketingTokens.colors.accent.indigo500]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Ionicons name="shield-checkmark" size={32} color="#fff" />
                </LinearGradient>
              </View>

              <Text style={styles.title}>Create Your Password</Text>
              
              {userEmail && (
                <Text style={styles.subtitle}>
                  Welcome! Please set your own password to continue.
                </Text>
              )}

              <Text style={styles.instructions}>
                Your account was created by an administrator with a temporary password.
                For security, please create your own password now.
              </Text>

              {/* New Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="rgba(255,255,255,0.5)"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="rgba(255,255,255,0.5)"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <PasswordStrengthIndicator 
                  password={password}
                  userInfo={{ email: userEmail || undefined }}
                />
              )}

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="rgba(255,255,255,0.5)"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleChangePassword}
                  />
                </View>
              </View>

              {/* Password requirements */}
              <View style={styles.requirements}>
                <PasswordRequirement met={password.length >= 8} text="At least 8 characters" />
                <PasswordRequirement met={/[A-Z]/.test(password)} text="One uppercase letter" />
                <PasswordRequirement met={/[a-z]/.test(password)} text="One lowercase letter" />
                <PasswordRequirement met={/[0-9]/.test(password)} text="One number" />
                <PasswordRequirement
                  met={password.length > 0 && password === confirmPassword}
                  text="Passwords match"
                />
              </View>

              {/* Submit Button */}
              <GradientButton
                label={loading ? 'Updating...' : 'Set My Password'}
                onPress={handleChangePassword}
                disabled={loading}
                loading={loading}
                style={styles.submitButton}
              />
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <AlertModal {...alertProps} />
    </LinearGradient>
  );
}

// Password requirement indicator component
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={styles.requirementRow}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={met ? '#10B981' : 'rgba(255,255,255,0.3)'}
      />
      <Text style={[styles.requirementText, met && styles.requirementMet]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  card: {
    padding: 24,
    gap: 16,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 8,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  eyeButton: {
    padding: 16,
  },
  requirements: {
    gap: 8,
    paddingTop: 8,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  requirementMet: {
    color: '#10B981',
  },
  submitButton: {
    marginTop: 16,
  },
});
