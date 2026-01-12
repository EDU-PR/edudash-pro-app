import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { createRegistrationStyles } from './child-registration.styles';
import type { RegistrationFormErrors } from '@/hooks/useChildRegistration';

interface HealthEmergencySectionProps {
  dietary: string;
  setDietary: (value: string) => void;
  medicalInfo: string;
  setMedicalInfo: (value: string) => void;
  specialNeeds: string;
  setSpecialNeeds: (value: string) => void;
  emergencyName: string;
  setEmergencyName: (value: string) => void;
  emergencyPhone: string;
  setEmergencyPhone: (value: string) => void;
  emergencyRelation: string;
  setEmergencyRelation: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  errors: RegistrationFormErrors;
  clearError: (field: keyof RegistrationFormErrors) => void;
}

export function HealthEmergencySection({
  dietary, setDietary,
  medicalInfo, setMedicalInfo,
  specialNeeds, setSpecialNeeds,
  emergencyName, setEmergencyName,
  emergencyPhone, setEmergencyPhone,
  emergencyRelation, setEmergencyRelation,
  notes, setNotes,
  errors, clearError,
}: HealthEmergencySectionProps) {
  const { theme } = useTheme();
  const styles = createRegistrationStyles(theme);

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health & Dietary Information</Text>
        
        <Text style={styles.label}>Dietary requirements (optional)</Text>
        <TextInput 
          value={dietary} 
          onChangeText={setDietary} 
          style={styles.input} 
          placeholder="e.g. Halal, Vegetarian, Gluten-free" 
          placeholderTextColor={theme.textSecondary} 
          multiline 
        />

        <Text style={styles.label}>Medical information (optional)</Text>
        <TextInput 
          value={medicalInfo} 
          onChangeText={setMedicalInfo} 
          style={styles.input} 
          placeholder="e.g. Asthma, Allergies, Medication" 
          placeholderTextColor={theme.textSecondary} 
          multiline 
        />

        <Text style={styles.label}>Special needs (optional)</Text>
        <TextInput 
          value={specialNeeds} 
          onChangeText={setSpecialNeeds} 
          style={styles.input} 
          placeholder="e.g. Learning support, mobility" 
          placeholderTextColor={theme.textSecondary} 
          multiline 
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Contact</Text>
        
        <Text style={styles.label}>Emergency contact name (optional)</Text>
        <TextInput 
          value={emergencyName} 
          onChangeText={setEmergencyName} 
          style={styles.input} 
          placeholder="e.g. Sipho Mthethwa" 
          placeholderTextColor={theme.textSecondary} 
        />

        <Text style={styles.label}>Emergency contact phone (optional)</Text>
        <Text style={styles.hint}>Format: +27 XX XXX XXXX or 0XX XXX XXXX</Text>
        <TextInput 
          value={emergencyPhone} 
          onChangeText={(text) => {
            setEmergencyPhone(text);
            clearError('emergencyPhone');
          }} 
          style={[styles.input, errors.emergencyPhone && styles.inputError]} 
          placeholder="e.g. +27 82 123 4567" 
          keyboardType="phone-pad" 
          placeholderTextColor={theme.textSecondary} 
        />
        {errors.emergencyPhone ? <Text style={styles.error}>{errors.emergencyPhone}</Text> : null}

        <Text style={styles.label}>Relationship to child (optional)</Text>
        <TextInput 
          value={emergencyRelation} 
          onChangeText={setEmergencyRelation} 
          style={styles.input} 
          placeholder="e.g. Mother, Father, Aunt" 
          placeholderTextColor={theme.textSecondary} 
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Information</Text>
        
        <Text style={styles.label}>Additional notes (optional)</Text>
        <TextInput 
          value={notes} 
          onChangeText={setNotes} 
          style={[styles.input, { minHeight: 80 }]} 
          placeholder="Anything else the school should know" 
          placeholderTextColor={theme.textSecondary} 
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </>
  );
}
