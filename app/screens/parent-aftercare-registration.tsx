import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Platform, Image } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { ImageConfirmModal } from '@/components/ui/ImageConfirmModal';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { useAftercareRegistration, GRADES, REGISTRATION_FEE_ORIGINAL, REGISTRATION_FEE_DISCOUNTED } from '@/hooks/useAftercareRegistration';
import { createAftercareRegistrationStyles } from '@/lib/screen-styles/parent-aftercare-registration.styles';

const PAYMENT_METHODS = [
  { value: 'eft' as const, label: '🏦 EFT' },
  { value: 'cash' as const, label: '💵 Cash' },
  { value: 'card' as const, label: '💳 Card' },
];

export default function ParentAftercareRegistrationScreen() {
  const { theme } = useTheme();
  const { showAlert, alertProps } = useAlertModal();
  const styles = useMemo(() => createAftercareRegistrationStyles(theme), [theme]);

  const h = useAftercareRegistration(showAlert);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Aftercare Registration', headerStyle: styles.headerTint as any, headerTitleStyle: { color: theme.text }, headerTintColor: theme.primary }} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Early Bird Banner */}
          {h.spotsRemaining !== null && h.spotsRemaining > 0 && (
            <View style={styles.infoBanner}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                🎉 Early Bird Special: {h.spotsRemaining} spots remaining at R{REGISTRATION_FEE_DISCOUNTED.toFixed(2)} (50% off!)
              </Text>
            </View>
          )}
          {h.registrationsClosed && (
            <View style={[styles.infoBanner, { backgroundColor: theme.error + '15', borderLeftColor: theme.error }]}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>⚠️ Early bird registrations are now full. Regular pricing applies.</Text>
            </View>
          )}

          {/* Pricing */}
          <View style={styles.priceBox}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 8 }]}>Registration Fee</Text>
            {h.spotsRemaining !== null && h.spotsRemaining > 0 ? (
              <>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Original Price</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 18, textDecorationLine: 'line-through', marginTop: 4 }}>R {REGISTRATION_FEE_ORIGINAL.toFixed(2)}</Text>
                <Text style={{ color: '#10b981', fontSize: 28, fontWeight: '800', marginTop: 8 }}>R {REGISTRATION_FEE_DISCOUNTED.toFixed(2)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#10b98120', padding: 8, borderRadius: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600', marginLeft: 6 }}>EARLYBIRD50 applied - You save R{REGISTRATION_FEE_DISCOUNTED.toFixed(2)}!</Text>
                </View>
              </>
            ) : (
              <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 4 }}>R {REGISTRATION_FEE_ORIGINAL.toFixed(2)}</Text>
            )}
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>One-time registration fee</Text>
          </View>

          {/* Parent Info */}
          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Parent Information</Text>
          <FormField label="First name *" value={h.parentFirstName} onChangeText={t => { h.setParentFirstName(t); if (h.errors.parentFirstName) h.clearFieldError('parentFirstName'); }} error={h.errors.parentFirstName} placeholder="e.g. Thandi" styles={styles} theme={theme} />
          <FormField label="Last name *" value={h.parentLastName} onChangeText={t => { h.setParentLastName(t); if (h.errors.parentLastName) h.clearFieldError('parentLastName'); }} error={h.errors.parentLastName} placeholder="e.g. Ndlovu" styles={styles} theme={theme} />
          <FormField label="Email *" value={h.parentEmail} onChangeText={t => { h.setParentEmail(t); if (h.errors.parentEmail) h.clearFieldError('parentEmail'); }} error={h.errors.parentEmail} placeholder="e.g. thandi@example.com" styles={styles} theme={theme} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>Phone number *</Text>
          <Text style={styles.hint}>Format: +27 XX XXX XXXX or 0XX XXX XXXX</Text>
          <TextInput value={h.parentPhone} onChangeText={t => { h.setParentPhone(t); if (h.errors.parentPhone) h.clearFieldError('parentPhone'); }} style={[styles.input, h.errors.parentPhone && styles.inputError]} placeholder="e.g. +27 82 123 4567" keyboardType="phone-pad" placeholderTextColor={theme.textSecondary} />
          {h.errors.parentPhone ? <Text style={styles.error}>{h.errors.parentPhone}</Text> : null}
          <FormField label="ID Number (optional)" value={h.parentIdNumber} onChangeText={h.setParentIdNumber} placeholder="e.g. 9001015800085" styles={styles} theme={theme} keyboardType="numeric" />

          {/* Child Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Child Information</Text>
            <FormField label="First name *" value={h.childFirstName} onChangeText={t => { h.setChildFirstName(t); if (h.errors.childFirstName) h.clearFieldError('childFirstName'); }} error={h.errors.childFirstName} placeholder="e.g. Sipho" styles={styles} theme={theme} />
            <FormField label="Last name *" value={h.childLastName} onChangeText={t => { h.setChildLastName(t); if (h.errors.childLastName) h.clearFieldError('childLastName'); }} error={h.errors.childLastName} placeholder="e.g. Ndlovu" styles={styles} theme={theme} />

            <Text style={styles.label}>Grade *</Text>
            <View style={styles.gradeRow}>
              {GRADES.map(g => (
                <TouchableOpacity key={g} style={[styles.gradeButton, h.childGrade === g && styles.gradeButtonActive]} onPress={() => h.setChildGrade(g)}>
                  <Text style={[styles.gradeButtonText, h.childGrade === g && styles.gradeButtonTextActive]}>Grade {g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Date of birth *</Text>
            <TouchableOpacity style={[styles.dateButton, h.errors.childDateOfBirth && styles.inputError]} onPress={() => h.setShowDatePicker(true)}>
              <Text style={h.childDateOfBirth ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {h.childDateOfBirth ? h.formatDate(h.childDateOfBirth) : 'Select date of birth'}
              </Text>
              <Ionicons name="calendar" size={20} color={theme.primary} />
            </TouchableOpacity>
            {h.errors.childDateOfBirth ? <Text style={styles.error}>{h.errors.childDateOfBirth}</Text> : null}
            {h.showDatePicker && (
              <DateTimePicker
                value={h.childDateOfBirth || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                minimumDate={new Date(2000, 0, 1)}
                onChange={(_, d) => { h.setShowDatePicker(Platform.OS === 'ios'); if (d) { h.setChildDateOfBirth(d); if (h.errors.childDateOfBirth) h.clearFieldError('childDateOfBirth'); } }}
              />
            )}

            <FormField label="Allergies (optional)" value={h.childAllergies} onChangeText={h.setChildAllergies} placeholder="e.g. Peanuts, Dairy" styles={styles} theme={theme} multiline />
            <FormField label="Medical conditions (optional)" value={h.childMedicalConditions} onChangeText={h.setChildMedicalConditions} placeholder="e.g. Asthma, Diabetes" styles={styles} theme={theme} multiline />
          </View>

          {/* Emergency Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <FormField label="Name *" value={h.emergencyContactName} onChangeText={t => { h.setEmergencyContactName(t); if (h.errors.emergencyContactName) h.clearFieldError('emergencyContactName'); }} error={h.errors.emergencyContactName} placeholder="e.g. Sipho Mthethwa" styles={styles} theme={theme} />
            <Text style={styles.label}>Phone number *</Text>
            <Text style={styles.hint}>Format: +27 XX XXX XXXX or 0XX XXX XXXX</Text>
            <TextInput value={h.emergencyContactPhone} onChangeText={t => { h.setEmergencyContactPhone(t); if (h.errors.emergencyContactPhone) h.clearFieldError('emergencyContactPhone'); }} style={[styles.input, h.errors.emergencyContactPhone && styles.inputError]} placeholder="e.g. +27 82 123 4567" keyboardType="phone-pad" placeholderTextColor={theme.textSecondary} />
            {h.errors.emergencyContactPhone ? <Text style={styles.error}>{h.errors.emergencyContactPhone}</Text> : null}
            <FormField label="Relationship *" value={h.emergencyContactRelation} onChangeText={t => { h.setEmergencyContactRelation(t); if (h.errors.emergencyContactRelation) h.clearFieldError('emergencyContactRelation'); }} error={h.errors.emergencyContactRelation} placeholder="e.g. Mother, Father, Aunt" styles={styles} theme={theme} />
          </View>

          {/* Additional Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            <FormField label="How did you hear about us? (optional)" value={h.howDidYouHear} onChangeText={h.setHowDidYouHear} placeholder="e.g. Facebook, Friend, School notice" styles={styles} theme={theme} />
          </View>

          {/* Payment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <Text style={styles.label}>Payment Method *</Text>
            <View style={styles.paymentMethodRow}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity key={m.value} style={[styles.paymentMethodButton, h.paymentMethod === m.value && styles.paymentMethodButtonActive]} onPress={() => h.setPaymentMethod(m.value)}>
                  <Text style={[styles.paymentMethodButtonText, h.paymentMethod === m.value && styles.paymentMethodButtonTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>Proof of Payment (optional but recommended)</Text>
            <Text style={styles.hint}>Upload proof now to get approved within 24 hours. Otherwise, approval takes 2-3 days.</Text>

            {h.proofOfPayment ? (
              <View style={{ marginTop: 8 }}>
                <Image source={{ uri: h.proofOfPayment }} style={{ width: '100%', height: 200, borderRadius: 10, backgroundColor: theme.surface }} resizeMode="cover" />
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.error, marginTop: 8 }]} onPress={() => h.setProofOfPayment(null)}>
                  <Text style={styles.btnText}>Remove & Upload Different Image</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.primary, borderStyle: 'dashed' }]} onPress={h.handlePopUpload} disabled={h.uploadingProof}>
                {h.uploadingProof ? <EduDashSpinner color={theme.primary} /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="cloud-upload" size={24} color={theme.primary} />
                    <Text style={[styles.btnText, { color: theme.primary, marginLeft: 8 }]}>Upload Proof of Payment</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Terms */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => h.setAcceptTerms(!h.acceptTerms)} activeOpacity={0.7}>
              <View style={[styles.checkbox, h.acceptTerms && styles.checkboxActive]}>
                {h.acceptTerms && <Ionicons name="checkmark" size={16} color={theme.onPrimary} />}
              </View>
              <Text style={{ color: theme.text, flex: 1, fontSize: 14 }}>I accept the terms and conditions and privacy policy *</Text>
            </TouchableOpacity>
            {h.errors.acceptTerms ? <Text style={styles.error}>{h.errors.acceptTerms}</Text> : null}
          </View>

          <TouchableOpacity style={styles.btn} onPress={h.onSubmit} disabled={h.loading || h.registrationsClosed}>
            {h.loading ? <EduDashSpinner color={theme.onPrimary} /> : <Text style={styles.btnText}>Submit Registration</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <ImageConfirmModal
        visible={!!h.pendingPopUri}
        imageUri={h.pendingPopUri}
        onConfirm={h.confirmPopUpload}
        onCancel={h.cancelPopUpload}
        title="Proof of Payment"
        confirmLabel="Upload"
        confirmIcon="cloud-upload-outline"
        loading={h.uploadingProof}
      />
      <AlertModal {...alertProps} />
    </View>
  );
}

/* ── Inline helper component ── */
interface FormFieldProps {
  label: string; value: string; onChangeText: (t: string) => void;
  error?: string; placeholder: string; styles: any; theme: any;
  keyboardType?: any; autoCapitalize?: any; multiline?: boolean;
}
const FormField: React.FC<FormFieldProps> = ({ label, value, onChangeText, error, placeholder, styles, theme, keyboardType, autoCapitalize, multiline }) => (
  <>
    <Text style={styles.label}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} style={[styles.input, error && styles.inputError]} placeholder={placeholder} placeholderTextColor={theme.textSecondary} keyboardType={keyboardType} autoCapitalize={autoCapitalize} multiline={multiline} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </>
);
