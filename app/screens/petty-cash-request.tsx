import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { derivePreschoolId } from '@/lib/roleUtils';
import { ApprovalWorkflowService } from '@/services/ApprovalWorkflowService';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

const CATEGORIES = [
  'Stationery',
  'Classroom Supplies',
  'Cleaning',
  'Maintenance',
  'Transport',
  'Refreshments',
  'Other',
] as const;

const URGENCY_OPTIONS: Array<'low' | 'normal' | 'high' | 'urgent'> = ['low', 'normal', 'high', 'urgent'];

function normalizeRoleLabel(role?: string | null): string {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'principal_admin') return 'principal_admin';
  if (value === 'principal') return 'principal';
  if (value === 'teacher') return 'teacher';
  if (value === 'admin') return 'admin';
  return value || 'staff';
}

export default function PettyCashRequestScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, alertProps } = useAlertModal();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Stationery');
  const [description, setDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [neededBy, setNeededBy] = useState('');
  const [receiptRequired, setReceiptRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const preschoolId = derivePreschoolId(profile);
  const normalizedRole = normalizeRoleLabel(profile?.role);
  const canSubmit =
    normalizedRole === 'teacher' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'principal' ||
    normalizedRole === 'principal_admin';

  const requestorName =
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
    profile?.full_name ||
    user?.email ||
    'Staff Member';

  const handleSubmit = async () => {
    const parsedAmount = Number(String(amount).replace(/[^0-9.]/g, ''));
    if (!parsedAmount || parsedAmount <= 0) {
      showAlert({
        title: 'Invalid Amount',
        message: 'Enter a valid request amount greater than zero.',
        type: 'warning',
      });
      return;
    }

    if (!description.trim()) {
      showAlert({
        title: 'Missing Description',
        message: 'Add a short description for what the petty cash is needed for.',
        type: 'warning',
      });
      return;
    }

    if (!justification.trim()) {
      showAlert({
        title: 'Missing Justification',
        message: 'Please add a brief reason so the principal can review the request.',
        type: 'warning',
      });
      return;
    }

    if (!user?.id || !preschoolId) {
      showAlert({
        title: 'School Context Missing',
        message: 'We could not determine your school profile. Please sign in again.',
        type: 'error',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await ApprovalWorkflowService.submitPettyCashRequest(
        preschoolId,
        user.id,
        requestorName,
        normalizedRole,
        {
          amount: parsedAmount,
          category,
          description: description.trim(),
          justification: justification.trim(),
          urgency,
          needed_by: neededBy.trim() || undefined,
          receipt_required: receiptRequired,
        }
      );

      if (!result) {
        showAlert({
          title: 'Request Failed',
          message: 'Could not submit petty cash request. Please try again.',
          type: 'error',
        });
        return;
      }

      showAlert({
        title: 'Request Submitted',
        message: 'Your petty cash request was sent for principal review.',
        type: 'success',
        buttons: [
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ],
      });
    } catch (error: any) {
      showAlert({
        title: 'Request Failed',
        message: error?.message || 'Could not submit petty cash request.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canSubmit) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Petty Cash Request</Text>
          <View style={styles.iconSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={28} color={theme.textSecondary} />
          <Text style={styles.emptyTitle}>Access Restricted</Text>
          <Text style={styles.emptyText}>Only teacher/admin school staff can submit petty cash requests.</Text>
        </View>
        <AlertModal {...alertProps} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Petty Cash Request</Text>
          <Text style={styles.headerSubtitle}>Submit for principal approval</Text>
        </View>
        <View style={styles.iconSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.label}>Amount (R)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="e.g. 350.00"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipWrap}>
              {CATEGORIES.map((item) => {
                const active = category === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(item)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.multilineInput]}
              multiline
              placeholder="What will this be used for?"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.label}>Justification</Text>
            <TextInput
              value={justification}
              onChangeText={setJustification}
              style={[styles.input, styles.multilineInput]}
              multiline
              placeholder="Why is this needed now?"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.label}>Urgency</Text>
            <View style={styles.chipWrap}>
              {URGENCY_OPTIONS.map((item) => {
                const active = urgency === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setUrgency(item)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Needed By (Optional)</Text>
            <TextInput
              value={neededBy}
              onChangeText={setNeededBy}
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textSecondary}
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Receipt Required</Text>
                <Text style={styles.switchHint}>Keep this on for expense tracking compliance.</Text>
              </View>
              <Switch
                value={receiptRequired}
                onValueChange={setReceiptRequired}
                thumbColor="#FFFFFF"
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            disabled={submitting}
            onPress={handleSubmit}
          >
            <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    headerTextWrap: {
      flex: 1,
      marginHorizontal: 10,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
    },
    headerSubtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    iconSpacer: {
      width: 36,
      height: 36,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 24,
      gap: 14,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      padding: 14,
    },
    label: {
      color: theme.text,
      fontWeight: '700',
      marginBottom: 6,
      marginTop: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.background,
      color: theme.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    multilineInput: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 2,
    },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}20`,
    },
    chipText: {
      color: theme.textSecondary,
      fontWeight: '600',
      fontSize: 12,
    },
    chipTextActive: {
      color: theme.primary,
    },
    switchRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    switchHint: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    submitButton: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
    },
    submitButtonDisabled: {
      opacity: 0.65,
    },
    submitText: {
      color: theme.onPrimary || '#FFFFFF',
      fontWeight: '800',
      fontSize: 15,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 8,
    },
    emptyTitle: {
      color: theme.text,
      fontWeight: '800',
      fontSize: 17,
      marginTop: 4,
    },
    emptyText: {
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });
