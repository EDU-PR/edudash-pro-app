import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createRegistrationStyles } from './child-registration.styles';
import type { RegistrationFormErrors, AgeRange } from '@/hooks/useChildRegistration';

interface ChildInfoSectionProps {
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  dob: Date | null;
  setDob: (value: Date | null) => void;
  gender: 'male' | 'female' | 'other' | '';
  setGender: (value: 'male' | 'female' | 'other' | '') => void;
  errors: RegistrationFormErrors;
  clearError: (field: keyof RegistrationFormErrors) => void;
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
  ageRange?: AgeRange;
}

export function ChildInfoSection({
  firstName, setFirstName,
  lastName, setLastName,
  dob, setDob,
  gender, setGender,
  errors, clearError,
  showDatePicker, setShowDatePicker,
  ageRange,
}: ChildInfoSectionProps) {
  const { theme } = useTheme();
  const styles = createRegistrationStyles(theme);

  const formatDate = (date: Date): string => date.toISOString().split('T')[0];
  
  // Default age hint if no ageRange provided
  const ageHint = ageRange?.label || 'Child must be between 2 and 7 years old';

  return (
    <>
      <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Child Information</Text>
      
      <Text style={styles.label}>First name *</Text>
      <TextInput 
        value={firstName} 
        onChangeText={(text) => {
          setFirstName(text);
          clearError('firstName');
        }} 
        style={[styles.input, errors.firstName && styles.inputError]} 
        placeholder="e.g. Thandi" 
        placeholderTextColor={theme.textSecondary} 
      />
      {errors.firstName ? <Text style={styles.error}>{errors.firstName}</Text> : null}

      <Text style={styles.label}>Last name *</Text>
      <TextInput 
        value={lastName} 
        onChangeText={(text) => {
          setLastName(text);
          clearError('lastName');
        }} 
        style={[styles.input, errors.lastName && styles.inputError]} 
        placeholder="e.g. Ndlovu" 
        placeholderTextColor={theme.textSecondary} 
      />
      {errors.lastName ? <Text style={styles.error}>{errors.lastName}</Text> : null}

      <Text style={styles.label}>Date of birth *</Text>
      <Text style={styles.hint}>{ageHint}</Text>
      <TouchableOpacity 
        style={[styles.dateButton, errors.dob && styles.inputError]} 
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={dob ? styles.dateButtonText : styles.dateButtonPlaceholder}>
          {dob ? formatDate(dob) : 'Select date of birth'}
        </Text>
        <Ionicons name="calendar" size={20} color={theme.primary} />
      </TouchableOpacity>
      {errors.dob ? <Text style={styles.error}>{errors.dob}</Text> : null}
      
      {showDatePicker && (
        <DateTimePicker
          value={dob || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          minimumDate={new Date(1990, 0, 1)}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setDob(selectedDate);
              clearError('dob');
            }
          }}
        />
      )}

      <Text style={styles.label}>Gender *</Text>
      <View style={styles.genderRow}>
        {(['male', 'female', 'other'] as const).map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.genderButton, gender === g && styles.genderButtonActive]}
            onPress={() => {
              setGender(g);
              clearError('gender');
            }}
          >
            <Text style={[styles.genderButtonText, gender === g && styles.genderButtonTextActive]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.gender ? <Text style={styles.error}>{errors.gender}</Text> : null}
    </>
  );
}
