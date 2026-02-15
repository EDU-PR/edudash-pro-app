import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { useAlertModal, AlertModal } from '@/components/ui/AlertModal';
/**
 * Screen for logged-in learners to enroll in programs using program codes.
 * This does NOT create a new account - it just enrolls the existing user.
 */
export default function EnrollByProgramCodeScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  
  const [programCode, setProgramCode] = useState(params?.code || '');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [programInfo, setProgramInfo] = useState<any>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [autoEnrolling, setAutoEnrolling] = useState(false);
  const autoEnrollAttempted = useRef(false);
  const codeFromParams = useRef(!!params?.code); // Track if code came from URL params

  const { showAlert, alertProps } = useAlertModal();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Check if user is logged in
  useEffect(() => {
    if (!user) {
      showAlert({
        title: 'Sign In Required',
        message: 'You need to be signed in to enroll in programs. Would you like to sign in?',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
          { text: 'Sign In', onPress: () => router.replace('/(auth)/sign-in') },
        ],
      });
    }
  }, [user]);

  // Auto-enroll ONLY if code was provided via URL params (e.g., from QR code scan)
  // Don't auto-validate when user is manually typing
  useEffect(() => {
    if (user?.id && codeFromParams.current && programCode.trim() && !autoEnrollAttempted.current && !validating && !enrolling && !autoEnrolling) {
      autoEnrollAttempted.current = true;
      setAutoEnrolling(true);
      // Auto-validate and enroll
      (async () => {
        try {
          const supabase = assertSupabase();
          
          // Validate program code
          const { data, error } = await supabase.rpc('validate_program_code', {
            p_code: programCode.trim(),
          });

          if (error) throw error;

          if (!data || typeof data !== 'object' || !(data as any).valid) {
            // Invalid code - show error but don't auto-enroll
            showAlert({
              title: 'Invalid Code',
              message: (data as any)?.error || 'The program code you entered is invalid or the program is no longer active.',
              type: 'error',
            });
            setAutoEnrolling(false);
            return;
          }

          // Extract program info from RPC response
          // The RPC returns: { valid, course: { id, title, description, course_code }, organization: { id, name, slug } }
          const course = (data as any).course;
          const org = (data as any).organization;
          
          const program = {
            id: String(course?.id ?? ''),
            title: String(course?.title ?? ''),
            description: course?.description ?? null,
            course_code: String(course?.course_code ?? programCode.trim()),
            organization: org?.id
              ? { id: String(org.id), name: String(org.name ?? '') }
              : null,
          };

          if (!program.id) {
            showAlert({ title: 'Invalid Code', message: 'Could not find program details.', type: 'error' });
            setAutoEnrolling(false);
            return;
          }

          setProgramInfo(program);

          // Check if already enrolled
          const { data: existingEnrollment } = await supabase
            .from('enrollments')
            .select('id, is_active')
            .eq('course_id', program.id)
            .eq('student_id', user.id)
            .maybeSingle();

          if (existingEnrollment) {
            if (existingEnrollment.is_active) {
              showAlert({
                title: 'Already Enrolled',
                message: `You are already enrolled in "${program.title}".`,
                type: 'info',
                buttons: [{ text: 'OK', onPress: () => router.replace('/screens/learner-dashboard') }],
              });
              setAutoEnrolling(false);
              return;
            } else {
              // Re-activate enrollment
              const { error: updateError } = await supabase
                .from('enrollments')
                .update({ is_active: true, enrolled_at: new Date().toISOString() })
                .eq('id', existingEnrollment.id);

              if (updateError) throw updateError;

              showAlert({
                title: 'Enrollment Reactivated',
                message: `You have been re-enrolled in "${program.title}".`,
                type: 'success',
                buttons: [{ text: 'OK', onPress: () => router.replace('/screens/learner-dashboard') }],
              });
              setAutoEnrolling(false);
              return;
            }
          }

          // Create new enrollment
          const { error: enrollError } = await supabase.from('enrollments').insert({
            student_id: user.id,
            course_id: program.id,
            enrollment_method: 'join_code',
            is_active: true,
            enrolled_at: new Date().toISOString(),
          });

          if (enrollError) {
            console.error('Auto-enrollment error:', enrollError);
            throw enrollError;
          }

          // Success - show alert and navigate
          showAlert({
            title: 'Enrollment Successful!',
            message: `You have been automatically enrolled in "${program.title}".`,
            type: 'success',
            buttons: [{ text: 'OK', onPress: () => router.replace('/screens/learner-dashboard') }],
          });
        } catch (error: any) {
          console.error('Auto-enrollment error:', error);
          
          // Show user-friendly error message for RLS errors
          if (error?.code === '42501' || error?.code === 'PGRST301' || error?.message?.includes('row-level security') || error?.message?.includes('RLS')) {
            showAlert({
              title: 'Enrollment Failed',
              message: 'Unable to enroll automatically. Please try enrolling manually using the button below.',
              type: 'error',
            });
          }
          
          // Set programInfo so user can manually enroll if validation succeeded
          // (programInfo should already be set if validation passed)
        } finally {
          setAutoEnrolling(false);
        }
      })();
    }
  }, [user?.id, programCode, validating, enrolling, autoEnrolling]);

  const validateProgramCode = async () => {
    if (!programCode.trim()) {
      showAlert({ title: 'Error', message: 'Please enter a program code', type: 'error' });
      return;
    }

    setValidating(true);
    setProgramInfo(null);

    try {
      const supabase = assertSupabase();
      
      // Use public RPC to validate program code
      const { data, error } = await supabase.rpc('validate_program_code', {
        p_code: programCode.trim(),
      });

      if (error) throw error;

      if (!data || typeof data !== 'object' || !(data as any).valid) {
        showAlert({
          title: 'Invalid Code',
          message: (data as any)?.error || 'The program code you entered is invalid or the program is no longer active.',
          type: 'error',
        });
        return;
      }

      // Extract program info from RPC response
      const course = (data as any).course;
      const org = (data as any).organization;
      
      const program = {
        id: String(course?.id ?? ''),
        title: String(course?.title ?? ''),
        description: course?.description ?? null,
        course_code: String(course?.course_code ?? ''),
        organization: org?.id
          ? { id: String(org.id), name: String(org.name ?? '') }
          : null,
      };

      if (!program.id) {
        showAlert({ title: 'Invalid Code', message: 'Could not find program details.', type: 'error' });
        return;
      }

      setProgramInfo(program);
      showAlert({ title: 'Code Valid', message: `You can enroll in: ${program.title}`, type: 'success' });
    } catch (error: any) {
      console.error('Program code validation error:', error);
      showAlert({ title: 'Error', message: error.message || 'Failed to validate program code', type: 'error' });
    } finally {
      setValidating(false);
    }
  };

  const handleEnroll = async () => {
    if (!user?.id) {
      showAlert({ title: 'Error', message: 'You must be signed in to enroll', type: 'error' });
      return;
    }

    if (!programInfo?.id) {
      showAlert({ title: 'Error', message: 'Please validate a program code first', type: 'error' });
      return;
    }

    setEnrolling(true);

    try {
      const supabase = assertSupabase();

      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id, is_active')
        .eq('course_id', programInfo.id)
        .eq('student_id', user.id)
        .maybeSingle();

      if (existingEnrollment) {
        if (existingEnrollment.is_active) {
          showAlert({
            title: 'Already Enrolled',
            message: `You are already enrolled in "${programInfo.title}".`,
            type: 'info',
            buttons: [{ text: 'OK', onPress: () => router.back() }],
          });
        } else {
          // Re-activate enrollment
          const { error: updateError } = await supabase
            .from('enrollments')
            .update({ is_active: true, enrolled_at: new Date().toISOString() })
            .eq('id', existingEnrollment.id);

          if (updateError) throw updateError;

          showAlert({
            title: 'Enrollment Reactivated',
            message: `You have been re-enrolled in "${programInfo.title}".`,
            type: 'success',
            buttons: [{ text: 'OK', onPress: () => router.back() }],
          });
        }
        return;
      }

      // Create new enrollment
      const { error: enrollError } = await supabase.from('enrollments').insert({
        student_id: user.id,
        course_id: programInfo.id,
        enrollment_method: 'join_code',
        is_active: true,
        enrolled_at: new Date().toISOString(),
      });

      if (enrollError) {
        console.error('Enrollment error:', enrollError);
        throw enrollError;
      }

      showAlert({
        title: 'Enrollment Successful!',
        message: `You have been enrolled in "${programInfo.title}".`,
        type: 'success',
        buttons: [{ text: 'OK', onPress: () => router.replace('/screens/learner-dashboard') }],
      });
    } catch (error: any) {
      console.error('Enrollment error:', error);
      showAlert({
        title: 'Enrollment Failed',
        message: error.message || 'Failed to enroll in program. Please try again.',
        type: 'error',
      });
    } finally {
      setEnrolling(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen
          options={{
            title: 'Enroll in Program',
            headerStyle: { backgroundColor: theme.background },
            headerTitleStyle: { color: theme.text },
            headerTintColor: theme.primary,
          }}
        />
        <View style={styles.centerContent}>
          <Text style={[styles.message, { color: theme.text }]}>
            Please sign in to enroll in programs.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Enroll in Program',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconContainer}>
          <Ionicons name="qr-code-outline" size={64} color={theme.primary} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Enter Program Code</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Enter the program code provided by your organization to enroll in a program.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Program Code</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.card,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={programCode}
            onChangeText={setProgramCode}
            placeholder="ABC-123456"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!validating && !enrolling}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.primary },
            (validating || !programCode.trim()) && styles.buttonDisabled,
          ]}
          onPress={validateProgramCode}
          disabled={validating || !programCode.trim()}
        >
          {validating ? (
            <EduDashSpinner color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Validate Code</Text>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        {programInfo && (
          <View
            style={[
              styles.programCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.programHeader}>
              <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
              <Text style={[styles.programTitle, { color: theme.text }]}>
                {programInfo.title}
              </Text>
            </View>
            {programInfo.description && (
              <Text style={[styles.programDescription, { color: theme.textSecondary }]}>
                {programInfo.description}
              </Text>
            )}
            {programInfo.organization && (
              <Text style={[styles.orgName, { color: theme.textSecondary }]}>
                {programInfo.organization.name}
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.enrollButton,
                { backgroundColor: theme.primary },
                enrolling && styles.buttonDisabled,
              ]}
              onPress={handleEnroll}
              disabled={enrolling}
            >
              {enrolling ? (
                <EduDashSpinner color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Enroll Now</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.back()}
          disabled={enrolling}
        >
          <Text style={[styles.linkText, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 20,
      gap: 24,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    inputGroup: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
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
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    programCard: {
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      gap: 12,
    },
    programHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    programTitle: {
      fontSize: 18,
      fontWeight: '700',
      flex: 1,
    },
    programDescription: {
      fontSize: 14,
      lineHeight: 20,
    },
    orgName: {
      fontSize: 14,
      fontStyle: 'italic',
    },
    enrollButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 10,
      gap: 8,
      marginTop: 8,
    },
    linkButton: {
      padding: 12,
      alignItems: 'center',
    },
    linkText: {
      fontSize: 14,
      fontWeight: '600',
    },
    message: {
      fontSize: 16,
      textAlign: 'center',
    },
  });

