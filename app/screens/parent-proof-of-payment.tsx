/**
 * Proof of Payment Screen
 *
 * Parent uploads receipt / proof-of-payment for a student fee.
 *
 * State/handlers extracted → hooks/useProofOfPayment.ts
 * Styles extracted → parent-proof-of-payment.styles.ts
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { formatFileSize } from '@/lib/popUpload';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { useProofOfPayment } from '@/hooks/useProofOfPayment';
import { createProofOfPaymentStyles } from '@/lib/screen-styles/parent-proof-of-payment.styles';
import type { FeeCategoryCode } from '@/types/finance';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card Payment' },
  { value: 'mobile_payment', label: 'Mobile Payment' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_OPTIONS: Array<{ code: FeeCategoryCode; label: string }> = [
  { code: 'tuition', label: 'Tuition' },
  { code: 'registration', label: 'Registration' },
  { code: 'uniform', label: 'Uniform' },
  { code: 'aftercare', label: 'Aftercare' },
  { code: 'transport', label: 'Transport' },
  { code: 'meal', label: 'Meal' },
  { code: 'ad_hoc', label: 'Other' },
];

export default function ProofOfPaymentScreen() {
  const rawParams = useLocalSearchParams<{ studentId: string; studentName: string; feeId?: string; paymentPurpose?: string }>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { showAlert, alertProps } = useAlertModal();
  const styles = useMemo(() => createProofOfPaymentStyles(theme), [theme]);

  const params = useMemo(() => ({
    studentId: rawParams.studentId || '',
    studentName: rawParams.studentName || '',
    feeId: rawParams.feeId,
    paymentPurpose: rawParams.paymentPurpose,
  }), [rawParams]);

  const h = useProofOfPayment(showAlert, t, params);

  const methodLabel = PAYMENT_METHODS.find(m => m.value === h.paymentMethod)?.label || t('pop.selectPaymentMethod');

  return (
    <View style={styles.container}>
      <RoleBasedHeader title={t('pop.uploadProofOfPayment')} showBackButton />
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Student Info */}
        {rawParams.studentName ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('pop.paymentFor')}: {decodeURIComponent(rawParams.studentName)}</Text>
          </View>
        ) : null}

        {/* Category Chips */}
        <View style={styles.section}>
          <Text style={styles.label}>Payment Category *</Text>
          <View style={styles.categoryRow}>
            {CATEGORY_OPTIONS.map(opt => {
              const sel = h.categoryCode === opt.code;
              return (
                <TouchableOpacity key={opt.code} style={[styles.categoryChip, { backgroundColor: sel ? theme.primary : theme.primary + '10', borderColor: sel ? theme.primary : theme.primary + '30' }]} onPress={() => h.setCategoryCode(opt.code)}>
                  <Text style={[styles.categoryChipText, { color: sel ? '#fff' : theme.primary }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('pop.paymentDetails')}</Text>

          <Text style={styles.label}>{t('pop.title')} *</Text>
          <TextInput style={styles.input} value={h.title} onChangeText={h.setTitle} placeholder={t('pop.titlePlaceholder')} placeholderTextColor={theme.textSecondary} />

          <Text style={styles.label}>{t('pop.amount')} *</Text>
          <TextInput style={styles.input} value={h.amount} onChangeText={h.setAmount} placeholder="0.00" placeholderTextColor={theme.textSecondary} keyboardType="decimal-pad" />

          {/* Payment Method Dropdown */}
          <Text style={styles.label}>{t('pop.paymentMethod')} *</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => h.setShowPaymentMethods(!h.showPaymentMethods)}>
              <Text style={styles.dropdownButtonText}>{methodLabel}</Text>
              <Ionicons name={h.showPaymentMethods ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            {h.showPaymentMethods && (
              <View style={styles.dropdownList}>
                {PAYMENT_METHODS.map(m => <TouchableOpacity key={m.value} style={styles.dropdownItem} onPress={() => { h.setPaymentMethod(m.value); h.setShowPaymentMethods(false); }}><Text style={styles.dropdownItemText}>{m.label}</Text></TouchableOpacity>)}
              </View>
            )}
          </View>

          {/* Payment-For-Month */}
          {h.showPaymentForField ? (
            <>
              <Text style={styles.label}>{t('pop.paymentForMonth', { defaultValue: 'Payment For Month' })} *</Text>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => h.setShowPaymentForPicker(true)}>
                <Text style={styles.datePickerText}>{h.paymentForMonth ? h.paymentForMonth.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) : t('pop.selectMonth', { defaultValue: 'Select month' })}</Text>
                <Ionicons name="calendar" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              {h.showPaymentForPicker && <DateTimePicker value={h.paymentForMonth || new Date()} mode="date" onChange={(_, d) => { h.setShowPaymentForPicker(false); if (d) h.setPaymentForMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} />}

              {/* Advance Months Selector */}
              <Text style={styles.label}>Number of Months</Text>
              <View style={styles.categoryRow}>
                {[1, 2, 3, 6].map(n => {
                  const sel = h.advanceMonths === n;
                  return (
                    <TouchableOpacity key={n} style={[styles.categoryChip, { backgroundColor: sel ? theme.primary : theme.primary + '10', borderColor: sel ? theme.primary : theme.primary + '30' }]} onPress={() => h.setAdvanceMonths(n)}>
                      <Text style={[styles.categoryChipText, { color: sel ? '#fff' : theme.primary }]}>{n === 1 ? '1 month' : `${n} months`}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {h.advanceMonths > 1 && h.coversMonths.length > 0 && (
                <View style={{ backgroundColor: theme.primary + '08', borderRadius: 8, padding: 10, marginTop: 6 }}>
                  <Text style={[styles.label, { marginBottom: 4, fontSize: 12, color: theme.primary }]}>
                    Covers: {h.coversMonths.map(m => new Date(m + 'T00:00:00').toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })).join(', ')}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.autoMonthRow}>
              <Text style={styles.label}>Payment Month</Text>
              <Text style={styles.autoMonthText}>Recorded automatically for {h.autoPaymentForMonth.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}.</Text>
            </View>
          )}

          {/* Payment Date */}
          <Text style={styles.label}>{t('pop.paymentDate')} *</Text>
          <TouchableOpacity style={styles.datePickerButton} onPress={() => h.setShowDatePicker(true)}>
            <Text style={styles.datePickerText}>{h.paymentDate.toLocaleDateString()}</Text>
            <Ionicons name="calendar" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          {h.showDatePicker && <DateTimePicker value={h.paymentDate} mode="date" onChange={(_, d) => { h.setShowDatePicker(false); if (d) h.setPaymentDate(d); }} />}

          <Text style={styles.label}>{t('pop.reference')}</Text>
          <TextInput style={styles.input} value={h.paymentReference} onChangeText={h.setPaymentReference} placeholder={t('pop.referencePlaceholder')} placeholderTextColor={theme.textSecondary} />

          <Text style={styles.label}>{t('pop.notes')}</Text>
          <TextInput style={[styles.input, styles.textArea]} value={h.description} onChangeText={h.setDescription} placeholder={t('pop.notesPlaceholder')} placeholderTextColor={theme.textSecondary} multiline />
        </View>

        {/* File Upload */}
        <View style={styles.fileSection}>
          <Text style={styles.fileSectionTitle}>{t('pop.uploadReceipt')} *</Text>
          {!h.selectedFile ? (
            <View style={styles.fileButtons}>
              <TouchableOpacity style={styles.fileButton} onPress={h.handleCameraPicker}><Ionicons name="camera" size={24} color={theme.primary} /><Text style={styles.fileButtonText}>{t('pop.takePhoto')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.fileButton} onPress={h.handleDocumentPicker}><Ionicons name="document" size={24} color={theme.primary} /><Text style={styles.fileButtonText}>{t('pop.selectFile')}</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectedFileContainer}>
              {h.selectedFile.type?.startsWith('image/') ? (
                <Image source={{ uri: h.selectedFile.uri }} style={styles.filePreview} />
              ) : (
                <View style={[styles.filePreview, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="document-text" size={24} color={theme.textSecondary} />
                </View>
              )}
              <View style={styles.fileInfo}>
                <Text style={styles.fileName}>{h.selectedFile.name}</Text>
                <Text style={styles.fileDetails}>{h.selectedFile.size ? formatFileSize(h.selectedFile.size) : 'Unknown size'}</Text>
              </View>
              <TouchableOpacity style={styles.removeFileButton} onPress={() => h.setSelectedFile(null)}><Ionicons name="close-circle" size={24} color={theme.error} /></TouchableOpacity>
            </View>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity style={[styles.submitButton, (h.createUpload.isPending || h.validateForm().length > 0) && styles.submitButtonDisabled]} onPress={h.handleSubmit} disabled={h.createUpload.isPending || h.validateForm().length > 0}>
          {h.createUpload.isPending ? <EduDashSpinner size="small" color={theme.onPrimary} /> : <Text style={styles.submitButtonText}>{t('pop.uploadPaymentProof')}</Text>}
        </TouchableOpacity>
      </ScrollView>
      <AlertModal {...alertProps} />
    </View>
  );
}
