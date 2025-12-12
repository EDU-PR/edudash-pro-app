import React, { useState, useEffect } from 'react';
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
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

interface RegistrationParams {
  org?: string;
  code?: string;
  program?: string;
}

export default function PublicRegistrationScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<RegistrationParams>();
  const [step, setStep] = useState<'code' | 'details'>('code');
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

  // Fetch program by code
  const { data: program, isLoading: loadingProgram } = useQuery({
    queryKey: ['program-by-code', programCode],
    queryFn: async () => {
      if (!programCode) return null;

      const supabase = assertSupabase();

      // Try to find program by course_code or generated code
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
        .or(`course_code.eq.${programCode},id.eq.${programCode}`)
        .eq('is_active', true)
        .single();

      if (error || !data) return null;
      return data;
    },
    enabled: !!programCode && step === 'details',
  });

  useEffect(() => {
    if (program && step === 'code') {
      setProgramInfo(program);
      setStep('details');
    }
  }, [program, step]);

  const handleCodeSubmit = async () => {
    if (!programCode.trim()) {
      Alert.alert('Error', 'Please enter a program code');
      return;
    }

    setLoading(true);
    try {
      const supabase = assertSupabase();

      // Fetch program
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
      setStep('details');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify program code');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
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

    setLoading(true);
    try {
      const supabase = assertSupabase();

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
            organization_id: programInfo?.organizations?.id,
          },
        },
      });

      if (authError) throw authError;

      // Auto-enroll in program
      if (authData.user && programInfo) {
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
          // Don't fail registration if enrollment fails - user can enroll manually
        }
      }

      Alert.alert(
        'Registration Successful!',
        'Your account has been created. Please check your email to verify your account, then log in to access the program.',
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

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Register for Program',
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
          {step === 'code' ? (
            <View style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <Ionicons name="school-outline" size={64} color={theme.primary} />
              </View>
              <Text style={styles.title}>Enter Program Code</Text>
              <Text style={styles.subtitle}>
                Enter the program code provided by your organization to register
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
                onPress={handleCodeSubmit}
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
                onPress={() => router.replace('/(auth)/sign-in')}
              >
                <Text style={[styles.linkText, { color: theme.primary }]}>
                  Already have an account? Sign In
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.stepContainer}>
              {programInfo && (
                <View style={[styles.programCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.programTitle, { color: theme.text }]}>
                    {programInfo.title}
                  </Text>
                  {programInfo.organizations && (
                    <Text style={[styles.orgName, { color: theme.textSecondary }]}>
                      {programInfo.organizations.name}
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.title}>Create Your Account</Text>
              <Text style={styles.subtitle}>
                Fill in your details to register and enroll in this program
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
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
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                />
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
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Register & Enroll</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setStep('code')}
              >
                <Text style={[styles.linkText, { color: theme.primary }]}>
                  ← Back to Code Entry
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
  stepContainer: {
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
  programCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  programTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  orgName: {
    fontSize: 14,
    marginTop: 4,
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
});

