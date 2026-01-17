/**
 * Custom hook for member registration logic
 * Handles the Edge Function call, retries, and error handling
 */
import { useState, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { 
  generateTemporaryPassword, 
  generateMemberNumber, 
} from '@/lib/memberRegistrationUtils';
import {
  AddMemberFormData,
  RegistrationStatus,
  RetryStatus,
  Region,
  buildPhysicalAddress,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface RegistrationResult {
  success: boolean;
  user_id?: string;
  member_id?: string;
  member_number?: string;
  wing?: string;
  temp_password?: string;
  error?: string;
  code?: string;
  debug?: Record<string, any>;
}

interface UseAddMemberSubmitOptions {
  organizationId: string | null | undefined;
  userId: string | null | undefined;
  selectedRegion: Region | undefined;
  isYouthWing: boolean;
  onSuccess: (result: RegistrationResult, tempPassword: string) => void;
  onError: (errorMessage: string) => void;
}

interface UseAddMemberSubmitReturn {
  handleSubmit: (formData: AddMemberFormData) => Promise<void>;
  isSubmitting: boolean;
  registrationStatus: RegistrationStatus;
  retryStatus: RetryStatus | null;
  errorMessage: string | null;
  clearError: () => void;
  resetStatus: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAddMemberSubmit(options: UseAddMemberSubmitOptions): UseAddMemberSubmitReturn {
  const { 
    organizationId, 
    userId, 
    selectedRegion, 
    isYouthWing,
    onSuccess,
    onError,
  } = options;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>('idle');
  const [retryStatus, setRetryStatus] = useState<RetryStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const resetStatus = useCallback(() => {
    setRegistrationStatus('idle');
    setRetryStatus(null);
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(async (formData: AddMemberFormData) => {
    // Validation
    if (!organizationId || !userId) {
      onError('Missing user or organization context');
      return;
    }

    setIsSubmitting(true);
    setRegistrationStatus('registering');
    setErrorMessage(null);

    try {
      const supabase = assertSupabase();
      
      // Generate credentials
      const tempPassword = generateTemporaryPassword();
      const memberNumber = generateMemberNumber(selectedRegion?.code || 'ZA');
      
      console.log('[useAddMemberSubmit] Creating member:', { 
        email: formData.email, 
        memberNumber,
        organizationId,
      });
      
      // Look up actual region_id from organization_regions
      let actualRegionId: string | null = null;
      if (selectedRegion?.code && organizationId) {
        try {
          const { data: regionData, error: regionError } = await supabase
            .from('organization_regions')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('province_code', selectedRegion.code)
            .maybeSingle();
          
          if (regionError) {
            console.error('[useAddMemberSubmit] Error looking up region:', regionError);
          } else if (regionData?.id) {
            actualRegionId = regionData.id;
            console.log('[useAddMemberSubmit] Found region UUID:', actualRegionId);
          }
        } catch (error) {
          console.error('[useAddMemberSubmit] Exception looking up region:', error);
        }
      }
      
      // Determine region_id to use
      const regionIdToUse = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.region_id)
        ? formData.region_id
        : actualRegionId;
      
      // Build physical address
      const physicalAddress = buildPhysicalAddress(formData);
      
      // Retry configuration
      const maxRetries = 3;
      const retryDelays = [2000, 3000, 5000];
      
      let edgeFunctionResult: RegistrationResult | null = null;
      let edgeFunctionError: any = null;
      let retries = 0;
      
      // Edge Function call with retries
      while (retries < maxRetries) {
        setRetryStatus({ retry: retries, maxRetries });
        
        try {
          console.log(`[useAddMemberSubmit] Attempt ${retries + 1}/${maxRetries}`);
          
          const requestBody = {
            email: formData.email.trim().toLowerCase(),
            password: tempPassword,
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            phone: formData.phone.trim() || null,
            id_number: formData.id_number.trim() || null,
            date_of_birth: formData.date_of_birth || null,
            physical_address: physicalAddress,
            organization_id: organizationId,
            region_id: regionIdToUse || null,
            member_number: memberNumber,
            member_type: formData.member_type || (isYouthWing ? 'youth_member' : 'learner'),
            membership_tier: formData.membership_tier || 'standard',
            membership_status: formData.membership_status || 'active',
          };
          
          console.log('[useAddMemberSubmit] Request body:', {
            ...requestBody,
            password: '[REDACTED]',
          });
          
          const { data, error } = await (supabase as any).functions.invoke('create-organization-member', {
            body: requestBody,
          });
          
          if (error) {
            console.error('[useAddMemberSubmit] Edge Function error:', error);
            edgeFunctionError = {
              message: error.message || 'Network error',
              code: error.code || 'NETWORK_ERROR',
            };
            
            retries++;
            if (retries < maxRetries) {
              const delay = retryDelays[retries - 1] || 5000;
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            break;
          }
          
          edgeFunctionResult = data;
          console.log('[useAddMemberSubmit] Edge Function result:', {
            success: data?.success,
            code: data?.code,
            error: data?.error,
            debug: data?.debug,
          });
          
          if (!edgeFunctionResult?.success) {
            edgeFunctionError = edgeFunctionResult;
            
            // Non-retryable errors
            const nonRetryableCodes = [
              'EMAIL_EXISTS', 
              'WEAK_PASSWORD', 
              'INVALID_EMAIL', 
              'UNAUTHORIZED', 
              'NO_ORGANIZATION', 
              'PROFILE_NOT_FOUND'
            ];
            
            if (nonRetryableCodes.includes(edgeFunctionResult?.code || '')) {
              console.log('[useAddMemberSubmit] Non-retryable error:', edgeFunctionResult?.code);
              break;
            }
            
            // Retry for timing issues
            if (edgeFunctionResult?.code === 'USER_NOT_FOUND' || edgeFunctionResult?.code === 'RPC_ERROR') {
              retries++;
              if (retries < maxRetries) {
                const delay = retryDelays[retries - 1] || 5000;
                console.log(`[useAddMemberSubmit] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
            }
            break;
          } else {
            // Success!
            setRetryStatus(null);
            setErrorMessage(null);
            setRegistrationStatus('success');
            onSuccess(edgeFunctionResult, tempPassword);
            return;
          }
        } catch (fetchError: any) {
          console.error('[useAddMemberSubmit] Exception:', fetchError);
          edgeFunctionError = {
            message: fetchError.message || 'Network error',
            code: 'NETWORK_ERROR',
          };
          
          retries++;
          if (retries < maxRetries) {
            const delay = retryDelays[retries - 1] || 5000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          break;
        }
      }
      
      // Handle final error
      setRegistrationStatus('error');
      const errorMsg = formatErrorMessage(edgeFunctionError || edgeFunctionResult, formData.email);
      setErrorMessage(errorMsg);
      onError(errorMsg);
      
    } catch (error: any) {
      console.error('[useAddMemberSubmit] Unexpected error:', error);
      setRegistrationStatus('error');
      const errorMsg = error.message || 'Failed to add member. Please try again.';
      setErrorMessage(errorMsg);
      onError(errorMsg);
    } finally {
      setIsSubmitting(false);
      setRetryStatus(null);
    }
  }, [organizationId, userId, selectedRegion, isYouthWing, onSuccess, onError]);

  return {
    handleSubmit,
    isSubmitting,
    registrationStatus,
    retryStatus,
    errorMessage,
    clearError,
    resetStatus,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatErrorMessage(error: any, email: string): string {
  if (!error) return 'An unknown error occurred';
  
  const code = error.code;
  const message = error.message || error.error;
  
  switch (code) {
    case 'AUTH_ERROR':
    case 'Unauthorized':
      return 'Authentication failed. Please log in again.';
    
    case 'UNAUTHORIZED':
      const debugInfo = error.debug 
        ? `\n\nDebug: member_type=${error.debug.member_type}, profile_role=${error.debug.profile_role}`
        : '';
      return `You do not have permission to create members. Only organization executives can create members.${debugInfo}`;
    
    case 'EMAIL_EXISTS':
      return `This email address (${email}) is already registered with another user account. Please use a different email address.`;
    
    case 'DUPLICATE_ERROR':
      return 'A member with this email already exists in the organization.';
    
    case 'NO_ORGANIZATION':
      return 'You are not associated with any organization. Please contact support.';
    
    case 'PROFILE_NOT_FOUND':
      return 'Your profile could not be found. Please log out and log in again.';
    
    case 'USER_NOT_FOUND':
      return 'User account creation timed out. Please try again.';
    
    case 'RPC_ERROR':
      const details = error.details || error.hint || '';
      return `Database error: ${message}${details ? `\n\nDetails: ${details}` : ''}`;
    
    case 'NETWORK_ERROR':
      return 'Network error. Please check your connection and try again.';
    
    default:
      return `Registration error: ${message || 'Unknown error'}`;
  }
}
