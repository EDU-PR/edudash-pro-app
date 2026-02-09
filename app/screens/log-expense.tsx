/**
 * Log Expense Screen
 * 
 * Simple form for principals to record any expense:
 * - Teacher salaries
 * - Rent / lease payments
 * - Utilities (water, electricity)
 * - Supplies & equipment
 * - Maintenance & repairs
 * - Transport, food, insurance, other
 * 
 * Uses the existing `financial_transactions` table.
 * Principals are non-accountants — keep it dead simple.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { derivePreschoolId } from '@/lib/roleUtils';
import { SimpleHeader } from '@/components/ui/SimpleHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FinancialDataService } from '@/services/FinancialDataService';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { normalizePaymentMethodCode } from '@/lib/utils/paymentMethod';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

type IconName = keyof typeof Ionicons.glyphMap;

interface ExpenseType {
  key: string;
  label: string;
  icon: IconName;
  color: string;
}

const EXPENSE_TYPES: ExpenseType[] = [
  { key: 'salary', label: 'Staff Salary', icon: 'people', color: '#6366F1' },
  { key: 'operational_expense', label: 'Rent / Lease', icon: 'home', color: '#F59E0B' },
  { key: 'expense_utilities', label: 'Utilities', icon: 'flash', color: '#3B82F6' },
  { key: 'purchase', label: 'Supplies / Equipment', icon: 'cart', color: '#10B981' },
  { key: 'expense_maintenance', label: 'Maintenance', icon: 'construct', color: '#EF4444' },
  { key: 'expense_transport', label: 'Transport', icon: 'car', color: '#8B5CF6' },
  { key: 'expense_food', label: 'Food / Catering', icon: 'restaurant', color: '#EC4899' },
  { key: 'expense_insurance', label: 'Insurance', icon: 'shield-checkmark', color: '#14B8A6' },
  { key: 'expense_other', label: 'Other', icon: 'ellipsis-horizontal-circle', color: '#6B7280' },
];

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

export default function LogExpenseScreen() {
  const { profile, user } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const { showAlert, AlertModalComponent } = useAlertModal();

  const preschoolId = derivePreschoolId(profile);

  // Form state
  const [selectedType, setSelectedType] = useState<ExpenseType | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  // Staff list for salary payments
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const isSalary = selectedType?.key === 'salary';

  // Load staff when salary is selected
  useEffect(() => {
    if (isSalary && preschoolId && staff.length === 0) {
      setLoadingStaff(true);
      FinancialDataService.getStaffForSalary(preschoolId)
        .then(setStaff)
        .catch(() => {})
        .finally(() => setLoadingStaff(false));
    }
  }, [isSalary, preschoolId]);

  const handleSave = useCallback(async () => {
    if (!selectedType) {
      showAlert({ title: 'Select Type', message: 'Please select what kind of expense this is.' });
      return;
    }
    const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!parsedAmount || parsedAmount <= 0) {
      showAlert({ title: 'Enter Amount', message: 'Please enter a valid amount greater than zero.' });
      return;
    }
    if (!description.trim()) {
      showAlert({ title: 'Add Description', message: 'Please describe this expense briefly.' });
      return;
    }
    if (!preschoolId || !user?.id) {
      showAlert({ title: 'Error', message: 'Could not determine your school. Please try again.' });
      return;
    }

    setSaving(true);
    try {
      // Map all expense subtypes to the DB-allowed 'expense' type.
      // The original key is preserved in metadata.expense_sub_type for categorisation.
      const dbType = selectedType.key === 'fee_payment' ? 'fee_payment' : 'expense';

      await FinancialDataService.logExpense({
        preschoolId,
        createdBy: user.id,
        type: dbType,
        amount: parsedAmount,
        description: description.trim(),
        category: selectedType.label,
        vendorName: isSalary && selectedStaff ? selectedStaff.name : vendorName.trim() || undefined,
        paymentMethod: paymentMethod.trim() ? normalizePaymentMethodCode(paymentMethod) : undefined,
        paymentReference: reference.trim() || undefined,
        metadata: {
          ...(isSalary && selectedStaff ? { staff_id: selectedStaff.id, staff_name: selectedStaff.name } : {}),
          expense_sub_type: selectedType.key,
        },
      });

      showAlert({
        title: 'Expense Logged!',
        message: `R${parsedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} recorded as ${selectedType.label}.`,
        buttons: [
          {
            text: 'Log Another',
            onPress: () => {
              setAmount('');
              setDescription('');
              setVendorName('');
              setPaymentMethod('');
              setReference('');
              setSelectedStaff(null);
            },
          },
          {
            text: 'Done',
            onPress: () => router.back(),
            style: 'cancel',
          },
        ],
      });
    } catch (err: any) {
      showAlert({ title: 'Failed', message: err?.message || 'Could not save expense. Please try again.' });
    } finally {
      setSaving(false);
    }
  }, [selectedType, amount, description, vendorName, paymentMethod, reference, preschoolId, user, isSalary, selectedStaff, showAlert]);

  const paymentMethods = [
    { code: 'cash', label: 'Cash' },
    { code: 'bank_transfer', label: 'Bank Transfer' },
    { code: 'eft', label: 'EFT' },
    { code: 'card', label: 'Card' },
    { code: 'debit_order', label: 'Debit Order' },
    { code: 'other', label: 'Other' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <SimpleHeader title="Log an Expense" />
      <AlertModalComponent />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: What kind of expense? */}
          <View style={styles.section}>
            <Text style={styles.stepLabel}>1. What is this expense for?</Text>
            <View style={styles.typeGrid}>
              {EXPENSE_TYPES.map((type) => {
                const isSelected = selectedType?.key === type.key;
                return (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeCard,
                      isSelected && { borderColor: type.color, backgroundColor: type.color + '15' },
                    ]}
                    onPress={() => setSelectedType(type)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: type.color + '20' }]}>
                      <Ionicons name={type.icon} size={20} color={type.color} />
                    </View>
                    <Text style={[styles.typeLabel, isSelected && { color: type.color, fontWeight: '700' }]}>
                      {type.label}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkBadge, { backgroundColor: type.color }]}>
                        <Ionicons name="checkmark" size={12} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Step 1b: Staff picker for salary */}
          {isSalary && (
            <View style={styles.section}>
              <Text style={styles.stepLabel}>Who is this salary for?</Text>
              {loadingStaff ? (
                <EduDashSpinner size="small" />
              ) : staff.length === 0 ? (
                <Text style={styles.hint}>No staff found. You can type the name below.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.staffScroll}>
                  {staff.map((member) => {
                    const isSelected = selectedStaff?.id === member.id;
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[styles.staffChip, isSelected && styles.staffChipActive]}
                        onPress={() => setSelectedStaff(isSelected ? null : member)}
                      >
                        <Ionicons name="person" size={14} color={isSelected ? 'white' : theme.text} />
                        <Text style={[styles.staffName, isSelected && { color: 'white' }]}>
                          {member.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {/* Step 2: How much? */}
          <View style={styles.section}>
            <Text style={styles.stepLabel}>2. How much did you pay?</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencyLabel}>R</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Step 3: Description */}
          <View style={styles.section}>
            <Text style={styles.stepLabel}>3. Short description</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder={isSalary ? 'e.g. January 2026 salary' : 'e.g. Electricity bill for January'}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={2}
              maxLength={200}
            />
          </View>

          {/* Optional: Vendor / Paid To */}
          {!isSalary && (
            <View style={styles.section}>
              <Text style={styles.stepLabel}>Paid to (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={vendorName}
                onChangeText={setVendorName}
                placeholder="e.g. Eskom, Landlord name"
                placeholderTextColor={theme.textSecondary}
                maxLength={100}
              />
            </View>
          )}

          {/* Optional: Payment Method */}
          <View style={styles.section}>
            <Text style={styles.stepLabel}>How did you pay? (optional)</Text>
            <View style={styles.methodRow}>
              {paymentMethods.map((method) => {
                const isSelected = paymentMethod === method.code;
                return (
                  <TouchableOpacity
                    key={method.code}
                    style={[styles.methodChip, isSelected && styles.methodChipActive]}
                    onPress={() => setPaymentMethod(isSelected ? '' : method.code)}
                  >
                    <Text style={[styles.methodText, isSelected && { color: 'white' }]}>
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Optional: Reference */}
          <View style={styles.section}>
            <Text style={styles.stepLabel}>Reference number (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={reference}
              onChangeText={setReference}
              placeholder="e.g. Invoice #, receipt number"
              placeholderTextColor={theme.textSecondary}
              maxLength={100}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!selectedType || !amount || !description.trim()) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving || !selectedType || !amount || !description.trim()}
            activeOpacity={0.8}
          >
            {saving ? (
              <EduDashSpinner size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={styles.saveButtonText}>Save Expense</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme?.text || '#1e293b',
    marginBottom: 10,
  },
  hint: {
    fontSize: 13,
    color: theme?.textSecondary || '#94a3b8',
    fontStyle: 'italic',
  },
  // Type grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: theme?.cardBackground || 'white',
    borderWidth: 2,
    borderColor: theme?.border || '#e2e8f0',
    position: 'relative',
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme?.text || '#334155',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Staff picker
  staffScroll: {
    flexDirection: 'row',
  },
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme?.cardBackground || 'white',
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
    marginRight: 8,
  },
  staffChipActive: {
    backgroundColor: theme?.primary || '#6366F1',
    borderColor: theme?.primary || '#6366F1',
  },
  staffName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme?.text || '#334155',
  },
  // Amount
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
    paddingHorizontal: 16,
  },
  currencyLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: theme?.text || '#1e293b',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: theme?.text || '#1e293b',
    paddingVertical: 14,
  },
  // Text input
  textInput: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme?.text || '#1e293b',
    minHeight: 48,
  },
  // Payment method chips
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme?.cardBackground || 'white',
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
  },
  methodChipActive: {
    backgroundColor: theme?.primary || '#6366F1',
    borderColor: theme?.primary || '#6366F1',
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme?.text || '#334155',
  },
  // Save button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: theme?.primary || '#6366F1',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
});
