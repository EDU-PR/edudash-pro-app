/**
 * Principal Sign-up Screen
 * 
 * Multi-step registration flow for principals to register their schools.
 * Steps: 1) Personal Info, 2) School Details, 3) Address, 4) Campus Info
 * Feature-flagged: Only active when principal_signup_enabled is true.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// South African Provinces
const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

// Plan tiers
const PLAN_TIERS = [
  { value: 'solo', label: 'Solo (1 Teacher)', description: 'Perfect for individual tutors' },
  { value: 'basic', label: 'Basic (5 Teachers)', description: 'Small preschool or daycare' },
  { value: 'standard', label: 'Standard (15 Teachers)', description: 'Medium-sized school' },
  { value: 'pro', label: 'Pro (50 Teachers)', description: 'Large institution' },
  { value: 'enterprise', label: 'Enterprise (Unlimited)', description: 'Multi-campus organizations' },
];

export default function PrincipalSignUpScreen() {
  const { theme } = useTheme();
  const flags = getFeatureFlagsSync();

  // Step state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: School Details
  const [schoolName, setSchoolName] = useState('');
  const [schoolSlug, setSchoolSlug] = useState('');
  const [planTier, setPlanTier] = useState('basic');
  const [billingEmail, setBillingEmail] = useState('');

  // Step 3: Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('Gauteng');
  const [postalCode, setPostalCode] = useState('');

  // Step 4: Campus
  const [campusName, setCampusName] = useState('');
  const [campusCode, setCampusCode] = useState('');
  const [campusCapacity, setCampusCapacity] = useState('200');

  // Feature flag check
  if (!flags.principal_signup_enabled) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Principal Sign Up' }} />
        <View style={styles.disabledContainer}>
          <Ionicons name="school-outline" size={64} color={theme.muted} />
          <Text style={[styles.disabledText, { color: theme.text }]}>
            Principal registration is not available
          </Text>
          <Text style={[styles.disabledSubtext, { color: theme.muted }]}>
            Please contact support to register your school.
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

  // Auto-generate slug from school name
  const handleSchoolNameChange = (value: string) => {
    setSchoolName(value);
    const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!schoolSlug || schoolSlug === schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) {
      setSchoolSlug(slug);
    }
  };

  // Validation
  const validateStep = (currentStep: number): boolean => {
    setError(null);

    switch (currentStep) {
      case 1:
        if (!fullName || !email || !phone || !password || !confirmPassword) {
          setError('All fields are required');
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

      case 2:
        if (!schoolName || !schoolSlug) {
          setError('School name is required');
          return false;
        }
        if (!/^[a-z0-9-]+$/.test(schoolSlug)) {
          setError('Slug can only contain lowercase letters, numbers, and hyphens');
          return false;
        }
        return true;

      case 3:
        if (!addressLine1 || !city || !province || !postalCode) {
          setError('Address, city, province, and postal code are required');
          return false;
        }
        return true;

      case 4:
        if (!campusName) {
          setError('Campus name is required');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.EXPO_PUBLIC_EDUSITEPRO_API_URL;
      if (!apiUrl) {
        throw new Error('Registration API not configured');
      }

      const response = await fetch(`${apiUrl}/api/organizations/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phoneNumber: phone,
          organizationName: schoolName,
          organizationSlug: schoolSlug,
          planTier,
          billingEmail: billingEmail || email,
          addressLine1,
          addressLine2,
          city,
          province,
          postalCode,
          country: 'ZA',
          campusName,
          campusCode: campusCode || undefined,
          campusAddress: addressLine1,
          campusCapacity: parseInt(campusCapacity) || 200,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      Alert.alert(
        'Registration Submitted',
        'Your registration is pending approval. You will receive an email once approved.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/sign-in'),
          },
        ]
      );
    } catch (err: any) {
      console.error('Registration error:', err);
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
      keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      secureTextEntry?: boolean;
      multiline?: boolean;
    } = {}
  ) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={options.placeholder}
          placeholderTextColor={theme.muted}
          keyboardType={options.keyboardType || 'default'}
          autoCapitalize={options.autoCapitalize || 'sentences'}
          secureTextEntry={options.secureTextEntry && !showPassword}
          multiline={options.multiline}
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
      </View>
    </View>
  );

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <Text style={[styles.stepTitle, { color: theme.text }]}>Personal Information</Text>
            <Text style={[styles.stepDescription, { color: theme.muted }]}>
              Create your principal account
            </Text>
            {renderInput('Full Name *', fullName, setFullName, { placeholder: 'Jane Smith', autoCapitalize: 'words' })}
            {renderInput('Email Address *', email, setEmail, { placeholder: 'jane@school.co.za', keyboardType: 'email-address', autoCapitalize: 'none' })}
            {renderInput('Phone Number *', phone, setPhone, { placeholder: '+27 12 345 6789', keyboardType: 'phone-pad' })}
            {renderInput('Password *', password, setPassword, { placeholder: 'Min. 8 characters', secureTextEntry: true, autoCapitalize: 'none' })}
            {renderInput('Confirm Password *', confirmPassword, setConfirmPassword, { placeholder: 'Confirm password', secureTextEntry: true, autoCapitalize: 'none' })}
          </>
        );

      case 2:
        return (
          <>
            <Text style={[styles.stepTitle, { color: theme.text }]}>School Details</Text>
            <Text style={[styles.stepDescription, { color: theme.muted }]}>
              Tell us about your institution
            </Text>
            {renderInput('School Name *', schoolName, handleSchoolNameChange, { placeholder: 'Bright Futures Preschool', autoCapitalize: 'words' })}
            {renderInput('School Slug *', schoolSlug, setSchoolSlug, { placeholder: 'bright-futures-preschool', autoCapitalize: 'none' })}
            {renderInput('Billing Email', billingEmail, setBillingEmail, { placeholder: 'billing@school.co.za', keyboardType: 'email-address', autoCapitalize: 'none' })}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.muted }]}>Plan Tier *</Text>
              {PLAN_TIERS.map((tier) => (
                <TouchableOpacity
                  key={tier.value}
                  style={[
                    styles.planOption,
                    { backgroundColor: theme.surface, borderColor: planTier === tier.value ? theme.primary : theme.border },
                  ]}
                  onPress={() => setPlanTier(tier.value)}
                >
                  <View style={styles.planRadio}>
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: planTier === tier.value ? theme.primary : theme.border },
                      ]}
                    >
                      {planTier === tier.value && (
                        <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                      )}
                    </View>
                    <View style={styles.planInfo}>
                      <Text style={[styles.planLabel, { color: theme.text }]}>{tier.label}</Text>
                      <Text style={[styles.planDescription, { color: theme.muted }]}>{tier.description}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );

      case 3:
        return (
          <>
            <Text style={[styles.stepTitle, { color: theme.text }]}>School Address</Text>
            <Text style={[styles.stepDescription, { color: theme.muted }]}>
              Where is your school located?
            </Text>
            {renderInput('Street Address *', addressLine1, setAddressLine1, { placeholder: '123 Main Street' })}
            {renderInput('Address Line 2', addressLine2, setAddressLine2, { placeholder: 'Suite, Building (optional)' })}
            {renderInput('City *', city, setCity, { placeholder: 'Johannesburg', autoCapitalize: 'words' })}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.muted }]}>Province *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.provinceScroll}
              >
                {PROVINCES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.provinceChip,
                      {
                        backgroundColor: province === p ? theme.primary : theme.surface,
                        borderColor: province === p ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setProvince(p)}
                  >
                    <Text
                      style={[
                        styles.provinceChipText,
                        { color: province === p ? '#ffffff' : theme.text },
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {renderInput('Postal Code *', postalCode, setPostalCode, { placeholder: '2001', keyboardType: 'numeric' })}
          </>
        );

      case 4:
        return (
          <>
            <Text style={[styles.stepTitle, { color: theme.text }]}>Campus Information</Text>
            <Text style={[styles.stepDescription, { color: theme.muted }]}>
              Set up your first campus
            </Text>
            {renderInput('Campus Name *', campusName, setCampusName, { placeholder: 'Main Campus', autoCapitalize: 'words' })}
            {renderInput('Campus Code', campusCode, (text) => setCampusCode(text.toUpperCase()), { placeholder: 'MAIN-001 (optional)', autoCapitalize: 'characters' })}
            {renderInput('Student Capacity', campusCapacity, setCampusCapacity, { placeholder: '200', keyboardType: 'numeric' })}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: 'Principal Sign Up' }} />

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
            <Text style={styles.headerEmoji}>🏫</Text>
          </LinearGradient>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Register Your School
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
            Create an account to manage your institution
          </Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={[
                styles.progressBar,
                { backgroundColor: step >= s ? theme.primary : theme.border },
              ]}
            />
          ))}
        </View>

        {/* Step Label */}
        <Text style={[styles.stepLabel, { color: theme.primary }]}>
          Step {step} of 4
        </Text>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          {step > 1 && (
            <TouchableOpacity
              style={[styles.navButton, styles.backNavButton, { borderColor: theme.border }]}
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={[styles.navButtonText, { color: theme.text }]}>Back</Text>
            </TouchableOpacity>
          )}

          {step < 4 ? (
            <TouchableOpacity
              style={[styles.navButton, styles.nextButton, { backgroundColor: theme.primary }]}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, styles.submitButton, { backgroundColor: theme.primary }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Submit Registration</Text>
                  <Ionicons name="checkmark" size={20} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Sign In Link */}
        <View style={styles.signInContainer}>
          <Text style={[styles.signInText, { color: theme.muted }]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/sign-in')}>
            <Text style={[styles.signInLink, { color: theme.primary }]}>Sign In</Text>
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
    marginBottom: 24,
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
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
  },
  progressBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    marginBottom: 24,
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
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  eyeButton: {
    padding: 8,
  },
  planOption: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  planRadio: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planInfo: {
    flex: 1,
  },
  planLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  planDescription: {
    fontSize: 12,
  },
  provinceScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  provinceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  provinceChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  backNavButton: {
    borderWidth: 1,
    flex: 0.4,
  },
  nextButton: {
    flex: 0.6,
  },
  submitButton: {
    flex: 1,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signInText: {
    fontSize: 14,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
