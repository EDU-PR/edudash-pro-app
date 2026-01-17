/**
 * Form validation hook for Add Member screen
 */
import { useCallback } from 'react';
import { 
  isValidEmail, 
  isValidSAPhoneNumber 
} from '@/lib/memberRegistrationUtils';
import { AddMemberFormData } from './types';

interface ValidationResult {
  isValid: boolean;
  errorTitle?: string;
  errorMessage?: string;
}

interface UseFormValidationOptions {
  organizationId: string | null | undefined;
}

export function useFormValidation(options: UseFormValidationOptions) {
  const { organizationId } = options;

  const validateForm = useCallback((formData: AddMemberFormData): ValidationResult => {
    if (!organizationId) {
      return {
        isValid: false,
        errorTitle: 'Error',
        errorMessage: 'Organization context missing. Please try logging in again.',
      };
    }

    if (!formData.region_id) {
      return {
        isValid: false,
        errorTitle: 'Required Field',
        errorMessage: 'Please select a region',
      };
    }

    if (!formData.first_name || !formData.last_name) {
      return {
        isValid: false,
        errorTitle: 'Required Field',
        errorMessage: 'Please enter member name',
      };
    }

    if (!formData.email) {
      return {
        isValid: false,
        errorTitle: 'Required Field',
        errorMessage: 'Please enter email address',
      };
    }

    if (!isValidEmail(formData.email)) {
      return {
        isValid: false,
        errorTitle: 'Invalid Email',
        errorMessage: 'Please enter a valid email address',
      };
    }

    if (!formData.phone) {
      return {
        isValid: false,
        errorTitle: 'Required Field',
        errorMessage: 'Please enter phone number',
      };
    }

    if (!isValidSAPhoneNumber(formData.phone)) {
      return {
        isValid: false,
        errorTitle: 'Invalid Phone',
        errorMessage: 'Please enter a valid South African phone number',
      };
    }

    return { isValid: true };
  }, [organizationId]);

  return { validateForm };
}
