// 🔐 Registration Form Field Components
// Reusable field rendering components for registration forms

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

// Registration form state interface
export interface RegistrationFormState {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone?: string;
  role?: string;
  subjects?: string[];
  gradeLevel?: string;
  schoolCode?: string;
  [key: string]: string | string[] | undefined;
}

interface FieldTheme {
  colors: {
    surface: string;
    outline: string;
    error: string;
    onSurface: string;
    onSurfaceVariant: string;
    primary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
  };
  typography: {
    body2: { fontSize: number };
    subtitle2: { fontWeight: string };
  };
}

interface BaseFieldProps {
  theme: FieldTheme;
  loading: boolean;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  formState: RegistrationFormState;
  onFieldChange: (fieldName: keyof RegistrationFormState, value: any) => void;
  onFieldBlur: (fieldName: string) => void;
}

interface TextFieldProps extends BaseFieldProps {
  fieldName: keyof RegistrationFormState;
  label: string;
  placeholder: string;
  required?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}

export const RegistrationTextField: React.FC<TextFieldProps> = ({
  theme,
  loading,
  errors,
  touched,
  formState,
  onFieldChange,
  onFieldBlur,
  fieldName,
  label,
  placeholder,
  required = false,
  keyboardType = 'default'
}) => {
  const fieldErrors = errors[fieldName] || [];
  const hasError = fieldErrors.length > 0 && touched[fieldName];
  const value = formState[fieldName] as string || '';
  
  return (
    <View style={styles.fieldContainer}>
      <Text style={[
        styles.fieldLabel,
        { 
          color: theme.colors.onSurface,
          fontSize: theme.typography.body2.fontSize,
          fontWeight: theme.typography.subtitle2.fontWeight as any
        }
      ]}>
        {label}
        {required && <Text style={{ color: theme.colors.error }}> *</Text>}
      </Text>
      
      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: theme.colors.surface,
            borderColor: hasError ? theme.colors.error : theme.colors.outline,
            color: theme.colors.onSurface
          }
        ]}
        value={value}
        onChangeText={(text) => onFieldChange(fieldName, text)}
        onBlur={() => onFieldBlur(fieldName as string)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      
      {hasError && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {fieldErrors[0]}
        </Text>
      )}
    </View>
  );
};

interface PasswordFieldProps extends BaseFieldProps {
  fieldName: 'password' | 'confirmPassword';
  label: string;
  required?: boolean;
  showPassword: boolean;
  onToggleVisibility: () => void;
}

export const RegistrationPasswordField: React.FC<PasswordFieldProps> = ({
  theme,
  loading,
  errors,
  touched,
  formState,
  onFieldChange,
  onFieldBlur,
  fieldName,
  label,
  required = false,
  showPassword,
  onToggleVisibility
}) => {
  const fieldErrors = errors[fieldName] || [];
  const hasError = fieldErrors.length > 0 && touched[fieldName];
  const value = formState[fieldName];
  
  return (
    <View style={styles.fieldContainer}>
      <Text style={[
        styles.fieldLabel,
        { 
          color: theme.colors.onSurface,
          fontSize: theme.typography.body2.fontSize,
          fontWeight: theme.typography.subtitle2.fontWeight as any
        }
      ]}>
        {label}
        {required && <Text style={{ color: theme.colors.error }}> *</Text>}
      </Text>
      
      <View style={{ position: 'relative' }}>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.colors.surface,
              borderColor: hasError ? theme.colors.error : theme.colors.outline,
              color: theme.colors.onSurface,
              paddingRight: 50
            }
          ]}
          value={value}
          onChangeText={(text) => onFieldChange(fieldName, text)}
          onBlur={() => onFieldBlur(fieldName)}
          placeholder="••••••••"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        
        <TouchableOpacity
          onPress={onToggleVisibility}
          style={styles.visibilityToggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ fontSize: 14, color: theme.colors.primary, fontWeight: '600' }}>
            {showPassword ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {hasError && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {fieldErrors[0]}
        </Text>
      )}
    </View>
  );
};

interface MultiSelectProps extends BaseFieldProps {
  fieldName: keyof RegistrationFormState;
  label: string;
  options: string[];
  required?: boolean;
}

export const RegistrationMultiSelect: React.FC<MultiSelectProps> = ({
  theme,
  loading,
  formState,
  onFieldChange,
  fieldName,
  label,
  options,
  required = false
}) => {
  const values = (formState[fieldName] as string[]) || [];
  
  const toggleOption = (option: string) => {
    const currentValues = [...values];
    const index = currentValues.indexOf(option);
    
    if (index > -1) {
      currentValues.splice(index, 1);
    } else {
      currentValues.push(option);
    }
    
    onFieldChange(fieldName, currentValues);
  };
  
  return (
    <View style={styles.fieldContainer}>
      <Text style={[
        styles.fieldLabel,
        { 
          color: theme.colors.onSurface,
          fontSize: theme.typography.body2.fontSize,
          fontWeight: theme.typography.subtitle2.fontWeight as any
        }
      ]}>
        {label}
        {required && <Text style={{ color: theme.colors.error }}> *</Text>}
      </Text>
      
      <View style={styles.multiSelectContainer}>
        {options.map(option => (
          <TouchableOpacity
            key={option}
            style={[
              styles.multiSelectOption,
              {
                backgroundColor: values.includes(option) 
                  ? theme.colors.primaryContainer 
                  : theme.colors.surface,
                borderColor: values.includes(option) 
                  ? theme.colors.primary 
                  : theme.colors.outline
              }
            ]}
            onPress={() => toggleOption(option)}
            disabled={loading}
          >
            <Text style={[
              styles.multiSelectOptionText,
              { 
                color: values.includes(option) 
                  ? theme.colors.onPrimaryContainer 
                  : theme.colors.onSurface
              }
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

interface SelectProps extends BaseFieldProps {
  fieldName: keyof RegistrationFormState;
  label: string;
  options: string[];
  required?: boolean;
}

export const RegistrationSelect: React.FC<SelectProps> = ({
  theme,
  loading,
  formState,
  onFieldChange,
  fieldName,
  label,
  options,
  required = false
}) => {
  const value = formState[fieldName] as string || '';
  
  return (
    <View style={styles.fieldContainer}>
      <Text style={[
        styles.fieldLabel,
        { 
          color: theme.colors.onSurface,
          fontSize: theme.typography.body2.fontSize,
          fontWeight: theme.typography.subtitle2.fontWeight as any
        }
      ]}>
        {label}
        {required && <Text style={{ color: theme.colors.error }}> *</Text>}
      </Text>
      
      <ScrollView 
        style={[
          styles.selectContainer,
          { 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline
          }
        ]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {options.map(option => (
          <TouchableOpacity
            key={option}
            style={[
              styles.selectOption,
              {
                backgroundColor: value === option 
                  ? theme.colors.primaryContainer 
                  : theme.colors.surface,
                borderColor: value === option
                  ? theme.colors.primary
                  : theme.colors.outline
              }
            ]}
            onPress={() => onFieldChange(fieldName, option)}
            disabled={loading}
          >
            <Text style={[
              styles.selectOptionText,
              { 
                color: value === option 
                  ? theme.colors.onPrimaryContainer 
                  : theme.colors.onSurface
              }
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    marginLeft: 4,
  },
  visibilityToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  multiSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  multiSelectOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  multiSelectOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  selectContainer: {
    maxHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 4,
    marginVertical: 6,
    borderWidth: 1,
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
