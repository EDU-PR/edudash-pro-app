import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';

interface RegistrationParams {
  code?: string;
  program?: string;
}

export default function LearnerRegistrationScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<RegistrationParams>();
  const [mode, setMode] = useState<'choose' | 'standalone' | 'program'>(
    params.code ? 'program' : 'choose'
  );
  const [programCode, setProgramCode] = useState(params.code || '');
  const [loading, setLoading] = useState(false);
  const [programInfo, setProgramInfo] = useState<any>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Real-time email validation with debouncing
  const checkEmailExists = React.useCallback(async (emailToCheck: string) => {
    if (!emailToCheck.trim() || !emailToCheck.includes('@')) {
      setEmailError(null);
      return;
    }

    const normalizedEmail = emailToCheck.trim().toLowerCase();
    setCheckingEmail(true);
    setEmailError(null);

    try {
      const supabase = assertSupabase();
      
      // Use RPC function to check both auth.users and profiles
      const { data: exists, error } = await supabase.rpc('check_email_exists', {
        p_email: normalizedEmail,
      });

      if (error) {
        console.error('Email check error:', error);
        // Don't show error to user if check fails - let signup proceed
        setEmailError(null);
        return;
      }

      if (exists) {
        setEmailError('This email is already registered. Please sign in instead.');
      } else {
        setEmailError(null);
      }
    } catch (error) {
      console.error('Email validation error:', error);
      setEmailError(null);
    } finally {
      setCheckingEmail(false);
    }
  }, []);

  // Debounced email check
  const emailCheckTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    setEmailError(null); // Clear error immediately when typing

    // Clear existing timeout
    if (emailCheckTimeoutRef.current) {
      clearTimeout(emailCheckTimeoutRef.current);
    }

    // Debounce: check after user stops typing for 800ms
    emailCheckTimeoutRef.current = setTimeout(() => {
      if (newEmail.trim().length > 0) {
        checkEmailExists(newEmail);
      }
    }, 800);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (emailCheckTimeoutRef.current) {
        clearTimeout(emailCheckTimeoutRef.current);
      }
    };
  }, []);

  const handleProgramCodeSubmit = async () => {
    if (!programCode.trim()) {
      Alert.alert('Error', 'Please enter a program code');
      return;
    }

    setLoading(true);
    try {
      const supabase = assertSupabase();

      const { data, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          description,
          course_code,
          organizations (
            id,
            name,
            slug
          )
        `)
        .or(`course_code.eq.${programCode.trim()},id.eq.${programCode.trim()}`)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        Alert.alert('Invalid Code', 'The program code you entered is invalid or the program is no longer active.');
        return;
      }

      setProgramInfo(data);
      setMode('program');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify program code');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (withProgram: boolean = false) => {
    // Validation
    if (!email || !firstName || !lastName || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (withProgram && !programInfo) {
      Alert.alert('Error', 'Please enter a valid program code first');
      return;
    }

    setLoading(true);
    try {
      const supabase = assertSupabase();

      // Double-check if email exists using RPC (checks profiles table - source of truth)
      const { data: emailExists, error: checkError } = await supabase.rpc('check_email_exists', {
        p_email: email.trim().toLowerCase(),
      });

      if (emailExists) {
        Alert.alert(
          'Email Already Registered',
          'This email is already registered. Would you like to sign in instead?',
          [
            { text: 'Use Different Email', style: 'cancel' },
            {
              text: 'Sign In',
              style: 'default',
              onPress: () => router.replace('/(auth)/sign-in'),
            },
          ]
        );
        setLoading(false);
        return;
      }

      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim() || null,
            role: 'student',
            organization_id: withProgram ? programInfo?.organizations?.id : null,
          },
          emailRedirectTo: 'https://www.edudashpro.org.za/landing?flow=email-confirm',
        },
      });

      if (authError) {
        // Handle specific Supabase errors
        if (authError.message?.includes('already registered') || 
            authError.message?.includes('email already') ||
            authError.message?.includes('User already registered')) {
          Alert.alert(
            'Email Already Registered',
            'This email is already registered. Would you like to sign in instead?',
            [
              { text: 'Use Different Email', style: 'cancel' },
              {
                text: 'Sign In',
                style: 'default',
                onPress: () => router.replace('/(auth)/sign-in'),
              },
            ]
          );
          setLoading(false);
          return;
        }
        throw authError;
      }

      // If confirmations are enabled, Supabase returns no session until the email is verified
      if (!authData.session) {
        // Email confirmation required - route to verify email screen
        router.replace({
          pathname: '/screens/verify-your-email',
          params: { email: email.trim() }
        } as any);
        return;
      }

      // Auto-enroll in program if applicable
      if (authData.user && withProgram && programInfo) {
        const { error: enrollError } = await supabase
          .from('enrollments')
          .insert({
            student_id: authData.user.id,
            course_id: programInfo.id,
            organization_id: programInfo.organizations?.id,
            is_active: true,
            enrollment_date: new Date().toISOString(),
          });

        if (enrollError) {
          console.error('Enrollment error:', enrollError);
        }
      }

      // Account created and user can log in immediately (email confirmation disabled or already verified)
      Alert.alert(
        'Registration Successful!',
        'Your account has been created successfully. You can now sign in.',
        [
          {
            text: 'Go to Sign In',
            onPress: () => router.replace('/(auth)/sign-in'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen
          options={{
            title: 'Sign Up as Learner',
            headerStyle: { backgroundColor: theme.background },
            headerTitleStyle: { color: theme.text },
            headerTintColor: theme.primary,
            headerShown: true,
          }}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.chooseContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="school-outline" size={64} color={theme.primary} />
            </View>
            <Text style={styles.title}>How would you like to sign up?</Text>
            <Text style={styles.subtitle}>
              Choose the option that best fits your situation
            </Text>

            {/* Standalone Signup */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setMode('standalone')}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="person-add-outline" size={32} color={theme.primary} />
              </View>
              <Text style={[styles.optionTitle, { color: theme.text }]}>
                Create Account
              </Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Sign up now and join programs later using codes or invitations
              </Text>
              <View style={styles.optionArrow}>
                <Ionicons name="arrow-forward" size={20} color={theme.primary} />
              </View>
            </TouchableOpacity>

            {/* Program Code Signup */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setMode('program')}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="qr-code-outline" size={32} color={theme.primary} />
              </View>
              <Text style={[styles.optionTitle, { color: theme.text }]}>
                Join with Program Code
              </Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                I have a program code from my organization
              </Text>
              <View style={styles.optionArrow}>
                <Ionicons name="arrow-forward" size={20} color={theme.primary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.replace('/(auth)/sign-in')}
            >
              <Text style={[styles.linkText, { color: theme.primary }]}>
                Already have an account? Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === 'program' && !programInfo) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen
          options={{
            title: 'Enter Program Code',
            headerStyle: { backgroundColor: theme.background },
            headerTitleStyle: { color: theme.text },
            headerTintColor: theme.primary,
            headerShown: true,
          }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formContainer}>
              <View style={styles.iconContainer}>
                <Ionicons name="qr-code-outline" size={64} color={theme.primary} />
              </View>
              <Text style={styles.title}>Enter Program Code</Text>
              <Text style={styles.subtitle}>
                Enter the program code provided by your organization
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Program Code</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={programCode}
                  onChangeText={setProgramCode}
                  placeholder="ABC-123456"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={handleProgramCodeSubmit}
                disabled={loading || !programCode.trim()}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setMode('choose')}
              >
                <Text style={[styles.linkText, { color: theme.primary }]}>
                  ← Back to Options
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Registration form (works for both standalone and program enrollment)
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: programInfo ? 'Register & Enroll' : 'Create Your Account',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            {programInfo && (
              <View style={[styles.programCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.programHeader}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                  <Text style={[styles.programTitle, { color: theme.text }]}>
                    {programInfo.title}
                  </Text>
                </View>
                {programInfo.organizations && (
                  <Text style={[styles.orgName, { color: theme.textSecondary }]}>
                    {programInfo.organizations.name}
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.title}>
              {programInfo ? 'Complete Your Registration' : 'Create Your Account'}
            </Text>
            <Text style={styles.subtitle}>
              {programInfo
                ? 'Fill in your details to register and enroll in this program'
                : 'Fill in your details to create your learner account'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address *</Text>
              <View style={styles.emailInputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: theme.card, 
                      color: theme.text, 
                      borderColor: emailError ? '#ef4444' : theme.border,
                      paddingRight: checkingEmail ? 50 : 14,
                    }
                  ]}
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onBlur={() => {
                    // Final check when user leaves the field
                    if (email.trim()) {
                      checkEmailExists(email);
                    }
                  }}
                />
                {checkingEmail && (
                  <View style={styles.emailCheckIndicator}>
                    <ActivityIndicator size="small" color={theme.primary} />
                  </View>
                )}
              </View>
              {emailError && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{emailError}</Text>
                  <TouchableOpacity
                    onPress={() => router.replace('/(auth)/sign-in')}
                    style={styles.signInLink}
                  >
                    <Text style={[styles.signInLinkText, { color: theme.primary }]}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="+27 12 345 6789"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={() => handleRegister(!!programInfo)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>
                    {programInfo ? 'Register & Enroll' : 'Create Account'}
                  </Text>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => programInfo ? setMode('program') : setMode('choose')}
            >
              <Text style={[styles.linkText, { color: theme.primary }]}>
                ← Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.replace('/(auth)/sign-in')}
            >
              <Text style={[styles.linkText, { color: theme.primary }]}>
                Already have an account? Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  chooseContainer: {
    gap: 20,
  },
  formContainer: {
    gap: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  optionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    gap: 12,
    position: 'relative',
  },
  optionIcon: {
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  optionArrow: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  programCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  programTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  orgName: {
    fontSize: 14,
    marginLeft: 32,
  },
  inputGroup: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    paddingRight: 50,
    fontSize: 16,
  },
  passwordToggle: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    padding: 12,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emailInputContainer: {
    position: 'relative',
  },
  emailCheckIndicator: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    flex: 1,
  },
  signInLink: {
    marginLeft: 4,
  },
  signInLinkText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

