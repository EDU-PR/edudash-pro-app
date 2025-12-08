/**
 * Teacher Sign-up Screen
 * 
 * Registration flow for teachers to join a school.
 * Optional: Can include invite code validation for joining existing schools.
 * Feature-flagged: Only active when teacher_signup_enabled is true.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { useTheme } from '@/contexts/ThemeContext';

export default function TeacherSignUpScreen() {
  const { theme } = useTheme();
  const flags = getFeatureFlagsSync();

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; id: string } | null>(null);

  // Feature flag check
  if (!flags.teacher_signup_enabled) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Teacher Sign Up' }} />
        <View style={styles.disabledContainer}>
          <Ionicons name="school-outline" size={64} color={theme.muted} />
          <Text style={[styles.disabledText, { color: theme.text }]}>
            Teacher registration is not available
          </Text>
          <Text style={[styles.disabledSubtext, { color: theme.muted }]}>
            Please contact your school principal for an invitation.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Validate invite code
  const validateInviteCode = async (code: string) => {
    if (!code || code.length < 6) {
      setSchoolInfo(null);
      return;
    }

    setValidatingCode(true);
    try {
      const { data, error } = await supabase.rpc('validate_invitation_code', {
        p_code: code,
      });

      if (error || !data) {
        setSchoolInfo(null);
        return;
      }

      // Fetch school info
      const { data: school } = await supabase
        .from('preschools')
        .select('id, name')
        .eq('id', data.school_id)
        .single();

      if (school) {
        setSchoolInfo({ name: school.name, id: school.id });
      }
    } catch (err) {
      console.warn('Code validation error:', err);
      setSchoolInfo(null);
    } finally {
      setValidatingCode(false);
    }
  };

  // Handle invite code change with debounce
  const handleInviteCodeChange = (code: string) => {
    setInviteCode(code.toUpperCase());
    // Simple debounce
    setTimeout(() => {
      validateInviteCode(code.toUpperCase());
    }, 500);
  };

  // Form validation
  const validateForm = (): boolean => {
    setError(null);

    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'teacher',
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create account');
      }

      // Update profile with role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'teacher',
          first_name: fullName.split(' ')[0],
          last_name: fullName.split(' ').slice(1).join(' '),
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.warn('Profile update error:', profileError);
      }

      // If invite code provided, link teacher to school
      if (inviteCode && schoolInfo) {
        try {
          await supabase.from('teacher_assignments').insert({
            teacher_id: authData.user.id,
            school_id: schoolInfo.id,
            status: 'pending',
            joined_via: 'invite_code',
          });
        } catch (err) {
          console.warn('School linking error:', err);
        }
      }

      Alert.alert(
        'Account Created!',
        'Please check your email to verify your account.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/sign-in'),
          },
        ]
      );
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render input field
  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    options: {
      placeholder?: string;
      keyboardType?: 'default' | 'email-address' | 'phone-pad';
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      secureTextEntry?: boolean;
      required?: boolean;
      icon?: keyof typeof Ionicons.glyphMap;
      suffix?: React.ReactNode;
    } = {}
  ) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: theme.muted }]}>
        {label} {options.required !== false && '*'}
      </Text>
      <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {options.icon && (
          <Ionicons name={options.icon} size={20} color={theme.muted} style={styles.inputIcon} />
        )}
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={options.placeholder}
          placeholderTextColor={theme.muted}
          keyboardType={options.keyboardType || 'default'}
          autoCapitalize={options.autoCapitalize || 'sentences'}
          secureTextEntry={options.secureTextEntry && !showPassword}
        />
        {options.secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={theme.muted}
            />
          </TouchableOpacity>
        )}
        {options.suffix}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: 'Teacher Sign Up' }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.headerIcon}
          >
            <Text style={styles.headerEmoji}>🎓</Text>
          </LinearGradient>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Teacher Sign Up
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
            Create your account and join a school
          </Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Invite Code (Optional) */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.muted }]}>
            School Invite Code (Optional)
          </Text>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.surface,
                borderColor: schoolInfo ? '#22c55e' : theme.border,
              },
            ]}
          >
            <Ionicons name="ticket-outline" size={20} color={theme.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={inviteCode}
              onChangeText={handleInviteCodeChange}
              placeholder="Enter code from your school"
              placeholderTextColor={theme.muted}
              autoCapitalize="characters"
            />
            {validatingCode && <ActivityIndicator size="small" color={theme.primary} />}
            {schoolInfo && <Ionicons name="checkmark-circle" size={20} color="#22c55e" />}
          </View>
          {schoolInfo && (
            <Text style={[styles.schoolInfo, { color: '#22c55e' }]}>
              ✓ You'll be added to {schoolInfo.name}
            </Text>
          )}
        </View>

        {/* Form Fields */}
        {renderInput('Full Name', fullName, setFullName, {
          placeholder: 'Jane Smith',
          autoCapitalize: 'words',
          icon: 'person-outline',
        })}

        {renderInput('Email', email, setEmail, {
          placeholder: 'jane@example.com',
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          icon: 'mail-outline',
        })}

        {renderInput('Phone Number', phone, setPhone, {
          placeholder: '+27 12 345 6789',
          keyboardType: 'phone-pad',
          icon: 'call-outline',
          required: false,
        })}

        {renderInput('Password', password, setPassword, {
          placeholder: 'Min. 8 characters',
          secureTextEntry: true,
          autoCapitalize: 'none',
          icon: 'lock-closed-outline',
        })}

        {renderInput('Confirm Password', confirmPassword, setConfirmPassword, {
          placeholder: 'Confirm your password',
          secureTextEntry: true,
          autoCapitalize: 'none',
          icon: 'lock-closed-outline',
        })}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Create Account</Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </>
          )}
        </TouchableOpacity>

        {/* Sign In Link */}
        <View style={styles.signInContainer}>
          <Text style={[styles.signInText, { color: theme.muted }]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/sign-in')}>
            <Text style={[styles.signInLink, { color: theme.primary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Principal Sign Up Link */}
        <View style={styles.signInContainer}>
          <Text style={[styles.signInText, { color: theme.muted }]}>
            Want to register your school?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/principal-signup')}>
            <Text style={[styles.signInLink, { color: theme.primary }]}>Principal Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  disabledContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  disabledText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  disabledSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerEmoji: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  eyeButton: {
    padding: 8,
  },
  schoolInfo: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signInText: {
    fontSize: 14,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
