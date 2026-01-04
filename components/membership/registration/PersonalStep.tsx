/**
 * Personal Information Step
 * Second step - collecting personal details and account credentials
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RegistrationData } from './types';

interface PersonalStepProps {
  data: RegistrationData;
  onUpdate: (field: keyof RegistrationData, value: string) => void;
  theme: any;
}

export function PersonalStep({ data, onUpdate, theme }: PersonalStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  
  const passwordsMatch = data.password === data.confirm_password;
  const passwordValid = data.password.length >= 6;
  
  // Email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  const emailValid = isValidEmail(data.email);
  const showEmailError = emailTouched && data.email.length > 0 && !emailValid;
  
  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Personal Information</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Tell us about yourself and create your account
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
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: showEmailError ? '#ef4444' : theme.border 
          }]}
          placeholder="your@email.com"
          placeholderTextColor={theme.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          value={data.email}
          onChangeText={(v) => onUpdate('email', v)}
          onBlur={() => setEmailTouched(true)}
        />
        {showEmailError && (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
            Please enter a valid email address
          </Text>
        )}
        {emailValid && data.email.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            <Text style={{ color: '#10b981', fontSize: 12, marginLeft: 4 }}>Valid email</Text>
          </View>
        )}
      </View>

      {/* Account Password Section */}
      <View style={[styles.formSection, { backgroundColor: theme.primary + '08', padding: 16, borderRadius: 12, marginVertical: 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Ionicons name="lock-closed" size={20} color={theme.primary} />
          <Text style={[styles.formLabel, { color: theme.primary, marginBottom: 0, marginLeft: 8 }]}>Create Password *</Text>
        </View>
        <Text style={[{ color: theme.textSecondary, fontSize: 13, marginBottom: 12 }]}>
          You'll use this to log in to your account
        </Text>
        
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, styles.passwordInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="Password (min. 6 characters)"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry={!showPassword}
            value={data.password}
            onChangeText={(v) => onUpdate('password', v)}
          />
          <TouchableOpacity 
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        {data.password.length > 0 && !passwordValid && (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
            Password must be at least 6 characters
          </Text>
        )}
        
        <View style={[styles.passwordContainer, { marginTop: 12 }]}>
          <TextInput
            style={[styles.input, styles.passwordInput, { 
              backgroundColor: theme.surface, 
              color: theme.text, 
              borderColor: data.confirm_password && !passwordsMatch ? '#ef4444' : theme.border 
            }]}
            placeholder="Confirm Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry={!showConfirmPassword}
            value={data.confirm_password}
            onChangeText={(v) => onUpdate('confirm_password', v)}
          />
          <TouchableOpacity 
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        {data.confirm_password.length > 0 && !passwordsMatch && (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
            Passwords do not match
          </Text>
        )}
        {data.confirm_password.length > 0 && passwordsMatch && passwordValid && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
            <Text style={{ color: '#22c55e', fontSize: 12, marginLeft: 4 }}>Passwords match</Text>
          </View>
        )}
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
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
});

