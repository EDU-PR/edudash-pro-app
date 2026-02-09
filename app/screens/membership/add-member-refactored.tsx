/**
 * Admin Add Member Screen (Refactored)
 * Form for administrators to manually add members to the organization
 * 
 * This file has been refactored from a 1300+ line file to use:
 * - Extracted types and constants (./add-member/types.ts)
 * - Custom hooks for submit logic (./add-member/useAddMemberSubmit.ts)
 * - Custom hooks for validation (./add-member/useFormValidation.ts)
 * - Reusable components (./add-member/PickerModal.tsx, StatusDisplay.tsx)
 * - Separated styles (./add-member/styles.ts)
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { MemberType, MembershipTier } from '@/components/membership/types';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

// Import refactored modules from add-member-modules directory
import {
  AddMemberFormData,
  REGIONS,
  MEMBERSHIP_TIERS,
  STATUS_OPTIONS,
  getInitialFormData,
  getMemberTypesForWing,
  formatCurrency,
  styles,
  PickerModal,
  ErrorDisplay,
  RetryStatusDisplay,
  useAddMemberSubmit,
  useFormValidation,
  RegistrationResult,
} from '@/components/membership/add-member-modules';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { logger } from '@/lib/logger';
export default function AddMemberScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert, alertProps } = useAlertModal();
  
  // ============================================================================
  // User Context & Wing Detection
  // ============================================================================
  
  const organizationId = profile?.organization_id;
  const currentUserMemberType = (profile as any)?.organization_membership?.member_type;
  const isYouthWing = currentUserMemberType?.startsWith('youth_');
  const isWomensWing = currentUserMemberType?.startsWith('women_');
  const isVeteransWing = currentUserMemberType?.startsWith('veterans_');
  
  const availableMemberTypes = getMemberTypesForWing(isYouthWing, isWomensWing, isVeteransWing);
  const defaultMemberType = availableMemberTypes[0]?.value || 'learner';
  
  // ============================================================================
  // Form State
  // ============================================================================
  
  const [formData, setFormData] = useState<AddMemberFormData>(getInitialFormData(defaultMemberType));
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showTierPicker, setShowTierPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDob, setSelectedDob] = useState<Date | null>(null);
  
  // Derived values
  const selectedRegion = REGIONS.find(r => r.id === formData.region_id);
  const selectedType = availableMemberTypes.find(t => t.value === formData.member_type);
  const selectedTier = MEMBERSHIP_TIERS.find(t => t.value === formData.membership_tier);
  const selectedStatus = STATUS_OPTIONS.find(s => s.value === formData.membership_status);
  
  // ============================================================================
  // Form Helpers
  // ============================================================================
  
  const updateField = useCallback(<K extends keyof AddMemberFormData>(
    field: K, 
    value: AddMemberFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    clearError();
  }, []);
  
  const resetForm = useCallback(() => {
    setFormData(getInitialFormData(defaultMemberType));
    setSelectedDob(null);
    resetStatus();
  }, [defaultMemberType]);
  
  // ============================================================================
  // Validation
  // ============================================================================
  
  const { validateForm } = useFormValidation({ organizationId });
  
  // ============================================================================
  // Submit Handler
  // ============================================================================
  
  const handleSuccess = useCallback((result: RegistrationResult, tempPassword: string) => {
    const passwordToShare = result.temp_password || tempPassword;
    const memberNumber = result.member_number || 'N/A';
    
    showAlert({
      title: '✅ Member Added Successfully',
      message: `${formData.first_name} ${formData.last_name} has been registered.\n\n` +
        `📋 Member Number: ${memberNumber}\n` +
        `🔑 Temporary Password: ${passwordToShare}\n\n` +
        `⚠️ IMPORTANT: Please securely share the temporary password with the new member. ` +
        `They will be prompted to change it after their first login.`,
      type: 'success',
      buttons: [
        { 
          text: '📋 Copy Password', 
          onPress: async () => {
            try {
              await Clipboard.setStringAsync(passwordToShare);
              resetForm();
              showAlert({
                title: '✅ Copied',
                message: 'Temporary password copied to clipboard. Share it securely with the new member.',
                type: 'success',
                buttons: [{ text: 'OK', style: 'default' }]
              });
            } catch (error) {
              logger.error('[AddMember] Failed to copy password:', error);
            }
          }
        },
        { text: '➕ Add Another', onPress: resetForm },
        { text: '✓ Done', onPress: () => { resetForm(); router.back(); } },
      ]
    });
  }, [formData.first_name, formData.last_name, showAlert, resetForm]);
  
  const handleError = useCallback((errorMessage: string) => {
    logger.error('[AddMember] Registration error:', errorMessage);
  }, []);
  
  const {
    handleSubmit: submitMember,
    isSubmitting,
    registrationStatus,
    retryStatus,
    errorMessage,
    clearError,
    resetStatus,
  } = useAddMemberSubmit({
    organizationId,
    userId: user?.id,
    selectedRegion,
    isYouthWing,
    onSuccess: handleSuccess,
    onError: handleError,
  });
  
  const handleSubmit = useCallback(() => {
    const validation = validateForm(formData);
    if (!validation.isValid) {
      showAlert({
        title: validation.errorTitle || 'Error',
        message: validation.errorMessage || 'Please check the form',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }
    
    if (!organizationId || !user?.id) {
      showAlert({
        title: 'Error',
        message: 'Missing user or organization context',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }
    
    submitMember(formData);
  }, [formData, validateForm, organizationId, user?.id, submitMember, showAlert]);
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Add New Member',
          headerRight: () => (
            <TouchableOpacity onPress={resetForm}>
              <Text style={[styles.resetText, { color: theme.primary }]}>Reset</Text>
            </TouchableOpacity>
          ),
        }}
      />
      
      <AlertModal {...alertProps} />

      <DashboardWallpaperBackground>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Status Displays */}
            <ErrorDisplay errorMessage={errorMessage} onDismiss={clearError} />
            <RetryStatusDisplay retryStatus={retryStatus} errorMessage={errorMessage} />
            
            {/* Region Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Region *</Text>
              <TouchableOpacity
                style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setShowRegionPicker(true)}
              >
                <View style={styles.selectContent}>
                  <Ionicons name="location-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.selectText, { color: selectedRegion ? theme.text : theme.textSecondary }]}>
                    {selectedRegion ? selectedRegion.name : 'Select Region'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Personal Information */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>First Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="First Name"
                    placeholderTextColor={theme.textSecondary}
                    value={formData.first_name}
                    onChangeText={(v) => updateField('first_name', v)}
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Last Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="Last Name"
                    placeholderTextColor={theme.textSecondary}
                    value={formData.last_name}
                    onChangeText={(v) => updateField('last_name', v)}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email Address *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="email@example.com"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(v) => updateField('email', v)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Phone Number *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="+27 82 123 4567"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  value={formData.phone}
                  onChangeText={(v) => updateField('phone', v)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SA ID Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="9001015012089"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={13}
                  value={formData.id_number}
                  onChangeText={(v) => updateField('id_number', v)}
                />
              </View>

              {/* Date of Birth */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Date of Birth</Text>
                <TouchableOpacity 
                  style={[styles.datePickerButton, { backgroundColor: theme.surface, borderColor: theme.border }]} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.datePickerText, { color: formData.date_of_birth ? theme.text : theme.textSecondary }]}>
                    {formData.date_of_birth || 'Select date of birth'}
                  </Text>
                  <Ionicons name="calendar" size={20} color={theme.primary} />
                </TouchableOpacity>
                
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDob || new Date(2000, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    minimumDate={new Date(1920, 0, 1)}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (event.type === 'dismissed') {
                        setShowDatePicker(false);
                        return;
                      }
                      if (selectedDate) {
                        setSelectedDob(selectedDate);
                        const year = selectedDate.getFullYear();
                        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(selectedDate.getDate()).padStart(2, '0');
                        updateField('date_of_birth', `${year}-${month}-${day}`);
                        if (Platform.OS === 'android') {
                          setShowDatePicker(false);
                        }
                      }
                    }}
                  />
                )}
                
                {showDatePicker && Platform.OS === 'ios' && (
                  <TouchableOpacity 
                    style={[styles.datePickerDoneButton, { backgroundColor: theme.primary }]}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Address Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Address</Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Street Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="123 Main Road"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.address_line1}
                  onChangeText={(v) => updateField('address_line1', v)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Address Line 2</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="Apartment, suite, etc."
                  placeholderTextColor={theme.textSecondary}
                  value={formData.address_line2}
                  onChangeText={(v) => updateField('address_line2', v)}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>City</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="City"
                    placeholderTextColor={theme.textSecondary}
                    value={formData.city}
                    onChangeText={(v) => updateField('city', v)}
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Postal Code</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="0000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={formData.postal_code}
                    onChangeText={(v) => updateField('postal_code', v)}
                  />
                </View>
              </View>
            </View>

            {/* Membership Details */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Membership Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Member Type * {isYouthWing ? '(Youth Wing)' : isWomensWing ? "(Women's Wing)" : isVeteransWing ? "(Veterans Wing)" : ''}
                </Text>
                <TouchableOpacity
                  style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setShowTypePicker(true)}
                >
                  <View style={styles.selectContent}>
                    <Ionicons name="ribbon-outline" size={20} color={theme.textSecondary} />
                    <Text style={[styles.selectText, { color: theme.text }]}>
                      {selectedType?.label || availableMemberTypes[0]?.label || 'Select Type'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Membership Tier *</Text>
                <TouchableOpacity
                  style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setShowTierPicker(true)}
                >
                  <View style={styles.selectContent}>
                    <Ionicons name="star-outline" size={20} color={theme.textSecondary} />
                    <Text style={[styles.selectText, { color: theme.text }]}>
                      {selectedTier?.label} - {formatCurrency(selectedTier?.price || 0)}/year
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Status *</Text>
                <TouchableOpacity
                  style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setShowStatusPicker(true)}
                >
                  <View style={styles.selectContent}>
                    <View style={[styles.statusDot, { backgroundColor: selectedStatus?.color }]} />
                    <Text style={[styles.selectText, { color: theme.text }]}>
                      {selectedStatus?.label}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Emergency Contact */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Contact</Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contact Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="Emergency Contact Name"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.emergency_contact_name}
                  onChangeText={(v) => updateField('emergency_contact_name', v)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contact Phone</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="+27 82 123 4567"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  value={formData.emergency_contact_phone}
                  onChangeText={(v) => updateField('emergency_contact_phone', v)}
                />
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Notes</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="Additional notes about this member..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={formData.notes}
                onChangeText={(v) => updateField('notes', v)}
              />
            </View>

            {/* Options */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Options</Text>
              
              <View style={[styles.optionRow, { backgroundColor: theme.card }]}>
                <View style={styles.optionInfo}>
                  <Ionicons name="mail-outline" size={22} color={theme.primary} />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>Send Welcome Email</Text>
                    <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                      Notify member of their registration
                    </Text>
                  </View>
                </View>
                <Switch
                  value={formData.send_welcome_email}
                  onValueChange={(v) => updateField('send_welcome_email', v)}
                  trackColor={{ false: theme.border, true: theme.primary + '50' }}
                  thumbColor={formData.send_welcome_email ? theme.primary : '#f4f3f4'}
                />
              </View>
              
              <View style={[styles.optionRow, { backgroundColor: theme.card }]}>
                <View style={styles.optionInfo}>
                  <Ionicons name="card-outline" size={22} color={theme.primary} />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>Generate ID Card</Text>
                    <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                      Create digital ID card immediately
                    </Text>
                  </View>
                </View>
                <Switch
                  value={formData.generate_id_card}
                  onValueChange={(v) => updateField('generate_id_card', v)}
                  trackColor={{ false: theme.border, true: theme.primary + '50' }}
                  thumbColor={formData.generate_id_card ? theme.primary : '#f4f3f4'}
                />
              </View>
              
              <View style={[styles.optionRow, { backgroundColor: theme.card }]}>
                <View style={styles.optionInfo}>
                  <Ionicons name="cash-outline" size={22} color={theme.primary} />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>Waive Payment</Text>
                    <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                      Skip membership fee requirement
                    </Text>
                  </View>
                </View>
                <Switch
                  value={formData.waive_payment}
                  onValueChange={(v) => updateField('waive_payment', v)}
                  trackColor={{ false: theme.border, true: theme.primary + '50' }}
                  thumbColor={formData.waive_payment ? theme.primary : '#f4f3f4'}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Submit Button */}
        <View style={[styles.bottomNav, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity 
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={handleSubmit}
            disabled={isSubmitting || !!retryStatus}
          >
            {isSubmitting || retryStatus ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <EduDashSpinner color="#fff" />
                <Text style={styles.submitText}>
                  {retryStatus ? `Creating... (${retryStatus.retry + 1}/${retryStatus.maxRetries})` : 'Creating Member...'}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.submitText}>Add Member</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Picker Modals */}
        <PickerModal
          visible={showRegionPicker}
          onClose={() => setShowRegionPicker(false)}
          title="Select Region"
          options={REGIONS.map(r => ({ value: r.id, label: r.name }))}
          selectedValue={formData.region_id}
          onSelect={(v) => updateField('region_id', v)}
          theme={theme}
        />
        
        <PickerModal
          visible={showTypePicker}
          onClose={() => setShowTypePicker(false)}
          title={`Select Member Type${isYouthWing ? ' (Youth Wing)' : isWomensWing ? " (Women's Wing)" : isVeteransWing ? " (Veterans Wing)" : ''}`}
          options={availableMemberTypes.map(t => ({ value: t.value, label: t.label }))}
          selectedValue={formData.member_type}
          onSelect={(v) => updateField('member_type', v as MemberType)}
          theme={theme}
        />
        
        <PickerModal
          visible={showTierPicker}
          onClose={() => setShowTierPicker(false)}
          title="Select Membership Tier"
          options={MEMBERSHIP_TIERS.map(t => ({ value: t.value, label: `${t.label} - ${formatCurrency(t.price)}/year` }))}
          selectedValue={formData.membership_tier}
          onSelect={(v) => updateField('membership_tier', v as MembershipTier)}
          theme={theme}
        />
        
        <PickerModal
          visible={showStatusPicker}
          onClose={() => setShowStatusPicker(false)}
          title="Select Status"
          options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label, color: s.color }))}
          selectedValue={formData.membership_status}
          onSelect={(v) => updateField('membership_status', v as 'active' | 'pending' | 'suspended')}
          theme={theme}
        />
      </DashboardWallpaperBackground>
    </SafeAreaView>
  );
}
