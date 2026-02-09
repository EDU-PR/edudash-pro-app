/**
 * Offer Letter Screen
 * 
 * Allows principals to generate and send formal offer letters
 * to candidates who have been through the interview process.
 * 
 * Features:
 * - Salary & benefits configuration
 * - Employment terms (probation, notice, leave)
 * - Preview before sending
 * - Custom AlertModal (no Alert.alert)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import HiringHubService from '@/lib/services/HiringHubService';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { EmploymentType, getEmploymentTypeLabel } from '@/types/hiring';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

export default function OfferLetterScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<any>(null);

  // Form state
  const [salary, setSalary] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(EmploymentType.FULL_TIME);
  const [probationMonths, setProbationMonths] = useState('3');
  const [noticeDays, setNoticeDays] = useState('30');
  const [leaveDays, setLeaveDays] = useState('21');
  const [workHours, setWorkHours] = useState('07:30 - 15:30');
  const [benefits, setBenefits] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  useEffect(() => {
    loadApplication();
  }, [applicationId]);

  const loadApplication = async () => {
    if (!applicationId) return;
    try {
      setLoading(true);
      const data = await HiringHubService.getApplicationById(applicationId);
      setApplication(data);
      // Pre-fill salary from job posting
      if (data?.job_posting?.salary_range_min) {
        setSalary(String(data.job_posting.salary_range_min));
      }
      if (data?.job_posting?.employment_type) {
        setEmploymentType(data.job_posting.employment_type);
      }
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to load application',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setStartDate(selectedDate);
  };

  const handleSubmit = useCallback(async () => {
    if (!salary.trim() || isNaN(Number(salary))) {
      showAlert({
        title: 'Validation Error',
        message: 'Please enter a valid salary amount.',
        type: 'warning',
        icon: 'alert-circle',
      });
      return;
    }

    if (startDate < new Date()) {
      showAlert({
        title: 'Validation Error',
        message: 'Start date must be in the future.',
        type: 'warning',
      });
      return;
    }

    showAlert({
      title: 'Send Offer Letter',
      message: `Send an offer of R${Number(salary).toLocaleString()} to ${application?.candidate_name}?\n\nThis will update the application status to "Offer Sent".`,
      type: 'info',
      icon: 'document-text',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Offer',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              const benefitsList = benefits
                .split('\n')
                .map(b => b.trim())
                .filter(Boolean);

              await HiringHubService.generateOffer(
                {
                  application_id: applicationId!,
                  salary_offered: Number(salary),
                  start_date: startDate.toISOString().split('T')[0],
                  employment_type: employmentType,
                  terms: {
                    probation_period_months: Number(probationMonths) || 3,
                    notice_period_days: Number(noticeDays) || 30,
                    leave_days: Number(leaveDays) || 21,
                    work_hours: workHours,
                    benefits: benefitsList,
                    additional_notes: additionalNotes || undefined,
                  },
                },
                user!.id
              );

              showAlert({
                title: 'Offer Sent!',
                message: `The offer is saved for ${application?.candidate_name} and notifications are being sent.`,
                type: 'success',
                icon: 'checkmark-circle',
                buttons: [{ text: 'Done', onPress: () => router.back() }],
              });
            } catch (error: any) {
              showAlert({
                title: 'Error',
                message: error.message || 'Failed to send offer letter',
                type: 'error',
              });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    });
  }, [salary, startDate, application, applicationId, user, employmentType, benefits, probationMonths, noticeDays, leaveDays, workHours, additionalNotes, showAlert]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const empTypes: EmploymentType[] = [
    EmploymentType.FULL_TIME,
    EmploymentType.PART_TIME,
    EmploymentType.CONTRACT,
    EmploymentType.TEMPORARY,
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Offer Letter', headerShown: false }} />
      <AlertModalComponent />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Generate Offer</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Candidate Info Card */}
          <View style={styles.candidateCard}>
            <View style={styles.candidateAvatar}>
              <Ionicons name="person" size={28} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.candidateName}>{application?.candidate_name || 'Candidate'}</Text>
              <Text style={styles.candidateJob}>{application?.job_posting?.title || 'Position'}</Text>
              <Text style={styles.candidateEmail}>{application?.candidate_email}</Text>
            </View>
          </View>

          {/* Salary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compensation</Text>
            <Text style={styles.inputLabel}>Monthly Salary (ZAR)</Text>
            <View style={styles.salaryRow}>
              <Text style={styles.currencyPrefix}>R</Text>
              <TextInput
                style={styles.salaryInput}
                value={salary}
                onChangeText={setSalary}
                placeholder="e.g. 15000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Employment Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employment Type</Text>
            <View style={styles.chipRow}>
              {empTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    employmentType === type && styles.chipActive,
                  ]}
                  onPress={() => setEmploymentType(type)}
                >
                  <Text style={[
                    styles.chipText,
                    employmentType === type && styles.chipTextActive,
                  ]}>
                    {getEmploymentTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.primary} />
              <Text style={styles.dateText}>
                {startDate.toLocaleDateString('en-ZA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                minimumDate={new Date()}
                onChange={handleDateChange}
              />
            )}
          </View>

          {/* Terms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employment Terms</Text>

            <View style={styles.termsGrid}>
              <View style={styles.termItem}>
                <Text style={styles.inputLabel}>Probation (months)</Text>
                <TextInput
                  style={styles.termInput}
                  value={probationMonths}
                  onChangeText={setProbationMonths}
                  keyboardType="numeric"
                  placeholder="3"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.termItem}>
                <Text style={styles.inputLabel}>Notice (days)</Text>
                <TextInput
                  style={styles.termInput}
                  value={noticeDays}
                  onChangeText={setNoticeDays}
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.termItem}>
                <Text style={styles.inputLabel}>Annual Leave (days)</Text>
                <TextInput
                  style={styles.termInput}
                  value={leaveDays}
                  onChangeText={setLeaveDays}
                  keyboardType="numeric"
                  placeholder="21"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.termItem}>
                <Text style={styles.inputLabel}>Work Hours</Text>
                <TextInput
                  style={styles.termInput}
                  value={workHours}
                  onChangeText={setWorkHours}
                  placeholder="07:30 - 15:30"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Benefits</Text>
            <Text style={styles.helperText}>One benefit per line</Text>
            <TextInput
              style={styles.textArea}
              value={benefits}
              onChangeText={setBenefits}
              placeholder="Medical aid contribution\nTransport allowance\nProfessional development"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Additional Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <TextInput
              style={styles.textArea}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              placeholder="Any additional terms or conditions..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Preview Summary */}
          <View style={[styles.section, styles.previewSection]}>
            <View style={styles.previewHeader}>
              <Ionicons name="eye-outline" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8 }]}>
                Offer Summary
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Candidate</Text>
              <Text style={styles.previewValue}>{application?.candidate_name}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Position</Text>
              <Text style={styles.previewValue}>{application?.job_posting?.title}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Salary</Text>
              <Text style={styles.previewValue}>R{Number(salary || 0).toLocaleString()}/month</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Type</Text>
              <Text style={styles.previewValue}>{getEmploymentTypeLabel(employmentType)}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Start Date</Text>
              <Text style={styles.previewValue}>
                {startDate.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <EduDashSpinner size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Send Offer Letter</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: theme.textSecondary,
      fontSize: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    candidateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary + '10',
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.primary + '30',
    },
    candidateAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    candidateName: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
    },
    candidateJob: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
      marginTop: 2,
    },
    candidateEmail: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    section: {
      marginBottom: 20,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 6,
    },
    helperText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 8,
      fontStyle: 'italic',
    },
    salaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.background,
    },
    currencyPrefix: {
      paddingHorizontal: 14,
      fontSize: 18,
      fontWeight: '700',
      color: theme.primary,
    },
    salaryInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      paddingVertical: 14,
      paddingRight: 14,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    chipTextActive: {
      color: '#FFFFFF',
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.background,
    },
    dateText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '500',
    },
    termsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    termItem: {
      width: '47%',
    },
    termInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
      backgroundColor: theme.background,
    },
    textArea: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.background,
      minHeight: 90,
    },
    previewSection: {
      borderColor: theme.primary + '40',
      backgroundColor: theme.primary + '08',
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    previewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + '40',
    },
    previewLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    previewValue: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
      textAlign: 'right',
      flex: 1,
      marginLeft: 16,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 16,
      marginTop: 8,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
