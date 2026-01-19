// 🔐 Registration Steps Shared Styles
// Common styles used across registration step components

import { StyleSheet } from 'react-native';

export const registrationStepStyles = StyleSheet.create({
  // Step container styles
  stepContent: {
    marginVertical: 24,
  },
  stepTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  
  // Form field styles
  fieldsContainer: {
    gap: 20,
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontWeight: '600',
  },
  label: {
    fontWeight: '600',
  },
  helperText: {
    lineHeight: 18,
  },
  
  // Input styles
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  passwordInputContainer: {
    position: 'relative',
  },
  visibilityToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  
  // Error styles
  errorText: {
    fontSize: 12,
    marginLeft: 4,
  },
  errorContainer: {
    padding: 20,
  },
  
  // Layout styles
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  
  // Select styles
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
  
  // Multi-select styles
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
  
  // Checkbox/Terms styles
  termsContainer: {
    marginVertical: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    lineHeight: 20,
  },
  
  // Organization selection styles
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  scrollView: {
    maxHeight: 350,
    marginTop: 16,
  },
  orgOption: {
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
  },
  orgContent: {
    flex: 1,
  },
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orgName: {
    fontWeight: '600',
    flex: 1,
  },
  orgMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  defaultBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  // Info/Help box styles
  helpBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  warningBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
});
