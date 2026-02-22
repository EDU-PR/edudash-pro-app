import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useChildRegistration } from '@/hooks/useChildRegistration';
import {
  ChildInfoSection,
  OrganizationSelector,
  RegistrationFeeSection,
  HealthEmergencySection,
  createRegistrationStyles,
} from '@/components/registration';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
export default function ParentChildRegistrationScreen() {
  const { theme } = useTheme();
  const styles = createRegistrationStyles(theme);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const {
    // Child info
    firstName, setFirstName,
    lastName, setLastName,
    dob, setDob,
    gender, setGender,
    
    // Organization
    selectedOrganizationId, setSelectedOrganizationId,
    organizations, loadingOrganizations,
    selectedOrganization,
    currentAgeRange,
    
    // Health & emergency
    dietary, setDietary,
    medicalInfo, setMedicalInfo,
    specialNeeds, setSpecialNeeds,
    emergencyName, setEmergencyName,
    emergencyPhone, setEmergencyPhone,
    emergencyRelation, setEmergencyRelation,
    notes, setNotes,
    
    // Payment
    registrationFee,
    paymentMethod, setPaymentMethod,
    proofOfPayment, setProofOfPaymentUrl,
    uploadingPop, setUploadingPop,
    
    // Promo
    promoCode, setPromoCode,
    promoDiscount, promoValidating,
    promoApplied, handleValidatePromo, handleRemovePromo,
    finalAmount,
    
    // UI
    loading, errors, clearError,
    onSubmit,
  } = useChildRegistration();

  const flowSteps = [
    '1. Complete your child details exactly as on school records.',
    '2. Select the correct school/campus for this child.',
    '3. If a registration fee appears, upload proof of payment before submitting.',
    '4. Add health, emergency, and special-care details for safety.',
    '5. Submit request and wait for school approval confirmation.',
  ];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen 
        options={{ 
          title: 'Register a Child', 
          headerStyle: styles.headerTint as any, 
          headerTitleStyle: { color: theme.text }, 
          headerTintColor: theme.primary 
        }} 
      />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View
            style={{
              backgroundColor: theme.primary + '12',
              borderWidth: 1,
              borderColor: theme.primary + '44',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 6 }}>
              Registration flow for parents
            </Text>
            {flowSteps.map((step) => (
              <Text key={step} style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
                {step}
              </Text>
            ))}
          </View>

          <ChildInfoSection
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            dob={dob}
            setDob={setDob}
            gender={gender}
            setGender={setGender}
            errors={errors}
            clearError={clearError}
            showDatePicker={showDatePicker}
            setShowDatePicker={setShowDatePicker}
            ageRange={currentAgeRange}
          />

          <OrganizationSelector
            organizations={organizations}
            loadingOrganizations={loadingOrganizations}
            selectedOrganizationId={selectedOrganizationId}
            setSelectedOrganizationId={setSelectedOrganizationId}
            errors={errors}
            clearError={clearError}
          />

          {/* Registration Fee Section - only show when organization selected and has fee */}
          {selectedOrganizationId && registrationFee > 0 && (
            <RegistrationFeeSection
              registrationFee={registrationFee}
              finalAmount={finalAmount}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              promoDiscount={promoDiscount}
              promoValidating={promoValidating}
              promoApplied={promoApplied}
              handleValidatePromo={handleValidatePromo}
              handleRemovePromo={handleRemovePromo}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              proofOfPayment={proofOfPayment}
              setProofOfPaymentUrl={setProofOfPaymentUrl}
              uploadingPop={uploadingPop}
              setUploadingPop={setUploadingPop}
              errors={errors}
              clearError={clearError}
            />
          )}

          <HealthEmergencySection
            dietary={dietary}
            setDietary={setDietary}
            medicalInfo={medicalInfo}
            setMedicalInfo={setMedicalInfo}
            specialNeeds={specialNeeds}
            setSpecialNeeds={setSpecialNeeds}
            emergencyName={emergencyName}
            setEmergencyName={setEmergencyName}
            emergencyPhone={emergencyPhone}
            setEmergencyPhone={setEmergencyPhone}
            emergencyRelation={emergencyRelation}
            setEmergencyRelation={setEmergencyRelation}
            notes={notes}
            setNotes={setNotes}
            errors={errors}
            clearError={clearError}
          />

          <View
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 6 }}>
              Before you submit
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
              The school will review this child registration and notify you in-app once approved.
              {registrationFee > 0
                ? ' Fee proof is required when a registration fee applies.'
                : ' No registration fee is required for this selection.'}
            </Text>
          </View>

          <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
            {loading ? (
              <EduDashSpinner color={theme.onPrimary} />
            ) : (
              <Text style={styles.btnText}>Submit Registration Request</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
