/**
 * Personal Information Step
 * Second step - collecting personal details
 */
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { RegistrationData } from './types';

interface PersonalStepProps {
  data: RegistrationData;
  onUpdate: (field: keyof RegistrationData, value: string) => void;
  theme: any;
}

export function PersonalStep({ data, onUpdate, theme }: PersonalStepProps) {
  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Personal Information</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Tell us about yourself
      </Text>
      
      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Full Name *</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={[styles.input, styles.inputHalf, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="First Name"
            placeholderTextColor={theme.textSecondary}
            value={data.first_name}
            onChangeText={(v) => onUpdate('first_name', v)}
          />
          <TextInput
            style={[styles.input, styles.inputHalf, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="Last Name"
            placeholderTextColor={theme.textSecondary}
            value={data.last_name}
            onChangeText={(v) => onUpdate('last_name', v)}
          />
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Email Address *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="your@email.com"
          placeholderTextColor={theme.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          value={data.email}
          onChangeText={(v) => onUpdate('email', v)}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Phone Number *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="+27 82 123 4567"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          value={data.phone}
          onChangeText={(v) => onUpdate('phone', v)}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>SA ID Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="9001015012089"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          maxLength={13}
          value={data.id_number}
          onChangeText={(v) => onUpdate('id_number', v)}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Address</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="Street Address"
          placeholderTextColor={theme.textSecondary}
          value={data.address_line1}
          onChangeText={(v) => onUpdate('address_line1', v)}
        />
        <View style={[styles.nameRow, { marginTop: 10 }]}>
          <TextInput
            style={[styles.input, styles.inputHalf, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="City"
            placeholderTextColor={theme.textSecondary}
            value={data.city}
            onChangeText={(v) => onUpdate('city', v)}
          />
          <TextInput
            style={[styles.input, styles.inputHalf, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="Postal Code"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={data.postal_code}
            onChangeText={(v) => onUpdate('postal_code', v)}
          />
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Emergency Contact</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="Contact Name"
          placeholderTextColor={theme.textSecondary}
          value={data.emergency_contact_name}
          onChangeText={(v) => onUpdate('emergency_contact_name', v)}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, marginTop: 10 }]}
          placeholder="Contact Phone"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          value={data.emergency_contact_phone}
          onChangeText={(v) => onUpdate('emergency_contact_phone', v)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  inputHalf: {
    width: '48%',
  },
});

