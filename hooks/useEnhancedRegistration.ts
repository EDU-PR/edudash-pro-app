// 🔐 Enhanced Registration Hook
// Manages state and logic for multi-step registration flow

import React from 'react';
import { Alert } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { AuthValidation } from '@/lib/auth/AuthValidation';
import {
  EnhancedUserRole,
  AuthFlowStep,
  EnhancedRegistration,
  PrincipalRegistration,
  TeacherRegistration,
  ParentRegistration,
  StudentRegistration,
  PasswordValidation,
  ChildRegistrationData,
} from '@/types/auth-enhanced';
import { OrganizationData } from '@/components/auth/OrganizationSetup';

// Default Community School ID
export const COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export interface PublicOrganization {
  id: string;
  name: string;
  school_type?: string;
  city?: string;
}

export interface RegistrationFormState {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Security
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  marketingConsent: boolean;
  
  // Role-specific
  jobTitle?: string;
  yearsExperience?: number;
  organization?: OrganizationData;
  subjects?: string[];
  gradeLevel?: string[];
  qualifications?: string[];
  bio?: string;
  invitationCode?: string;
  children?: Array<{
    firstName: string;
    lastName: string;
    grade?: string;
    studentId?: string;
  }>;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  selectedOrganizationId?: string;
  grade?: string;
  dateOfBirth?: Date;
  parentEmail?: string;
  schoolCode?: string;
  interests?: string[];
  registrationChildren: ChildRegistrationData[];
}

export interface UseEnhancedRegistrationProps {
  role: EnhancedUserRole;
  invitationToken?: string;
  organizationId?: string;
  onSuccess: (registration: EnhancedRegistration) => void;
  onError?: (error: string) => void;
}

export function useEnhancedRegistration({
  role,
  invitationToken,
  organizationId,
  onSuccess,
  onError
}: UseEnhancedRegistrationProps) {
  const shouldSelectSchoolInFlow = role === 'parent' && !invitationToken && !organizationId;

  // Organization state for parent registration
  const [organizations, setOrganizations] = React.useState<PublicOrganization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = React.useState(true);
  const [organizationError, setOrganizationError] = React.useState<string | null>(null);
  
  // Form state
  const [formState, setFormState] = React.useState<RegistrationFormState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    marketingConsent: false,
    selectedOrganizationId: organizationId || (shouldSelectSchoolInFlow ? undefined : COMMUNITY_SCHOOL_ID),
    registrationChildren: [],
  });
  
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(false);
  const [passwordValidation, setPasswordValidation] = React.useState<PasswordValidation | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  
  // Multi-step flow
  const [currentStep, setCurrentStep] = React.useState<AuthFlowStep>('personal_info');
  const [completedSteps, setCompletedSteps] = React.useState<AuthFlowStep[]>([]);
  
  // Memoized user info for password validation
  const userInfo = React.useMemo(() => ({
    email: formState.email,
    firstName: formState.firstName,
    lastName: formState.lastName
  }), [formState.email, formState.firstName, formState.lastName]);
  
  // Get available steps based on role
  const availableSteps = React.useMemo((): AuthFlowStep[] => {
    const baseSteps: AuthFlowStep[] = ['personal_info', 'security_setup'];
    
    switch (role) {
      case 'principal':
        return ['personal_info', 'organization_setup', 'security_setup'];
      case 'teacher':
        return invitationToken ? baseSteps : ['personal_info', 'security_setup'];
      case 'parent':
        return invitationToken 
          ? ['personal_info', 'security_setup', 'child_registration']
          : ['personal_info', 'organization_selection', 'security_setup', 'child_registration'];
      case 'student':
        return baseSteps;
      default:
        return baseSteps;
    }
  }, [role, invitationToken]);
  
  const currentStepIndex = availableSteps.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === availableSteps.length - 1;
  
  // Fetch organizations for parent registration
  React.useEffect(() => {
    if (role === 'parent' && !invitationToken) {
      const fetchOrganizations = async () => {
        try {
          setLoadingOrganizations(true);
          setOrganizationError(null);
          const { data, error } = await assertSupabase()
            .from('preschools')
            .select('id, name, school_type, city')
            .eq('is_active', true)
            .order('name');

          if (error) throw error;

          const orgList = (data || []) as PublicOrganization[];
          const uniqueOrganizations = Array.from(new Map(orgList.map(org => [org.id, org])).values());
          const communitySchool = uniqueOrganizations.find(org => org.id === COMMUNITY_SCHOOL_ID);
          const otherOrgs = uniqueOrganizations.filter(org => org.id !== COMMUNITY_SCHOOL_ID);
          const allOrganizations = communitySchool
            ? [...otherOrgs, communitySchool]
            : [
                ...otherOrgs,
                { id: COMMUNITY_SCHOOL_ID, name: 'EduDash Pro Community School', school_type: 'community_school' },
              ];

          setOrganizations(allOrganizations);
          setFormState(prev => {
            if (prev.selectedOrganizationId && allOrganizations.some(org => org.id === prev.selectedOrganizationId)) {
              return prev;
            }

            // Auto-select only when there is exactly one non-community option.
            if (otherOrgs.length === 1) {
              return { ...prev, selectedOrganizationId: otherOrgs[0].id };
            }

            return { ...prev, selectedOrganizationId: undefined };
          });
        } catch (err) {
          console.error('Failed to load organizations:', err);
          setOrganizationError('Failed to load schools. You can continue with EduDash Pro Community School.');
          setOrganizations([
            { id: COMMUNITY_SCHOOL_ID, name: 'EduDash Pro Community School', school_type: 'community_school' }
          ]);
          setFormState(prev => ({
            ...prev,
            selectedOrganizationId: prev.selectedOrganizationId || COMMUNITY_SCHOOL_ID,
          }));
        } finally {
          setLoadingOrganizations(false);
        }
      };

      fetchOrganizations();
    } else {
      setLoadingOrganizations(false);
    }
  }, [role, invitationToken]);
  
  // Field validation
  const validateField = (fieldName: string, value: any): string[] => {
    const fieldErrors: string[] = [];
    
    switch (fieldName) {
      case 'firstName':
      case 'lastName': {
        const nameValidation = AuthValidation.validateName(value, fieldName === 'firstName' ? 'First name' : 'Last name');
        if (!nameValidation.isValid) fieldErrors.push(...nameValidation.errors);
        break;
      }
      case 'email': {
        const emailValidation = AuthValidation.validateEmail(value);
        if (!emailValidation.isValid) fieldErrors.push(...emailValidation.errors);
        break;
      }
      case 'phone':
        if (value) {
          const phoneValidation = AuthValidation.validatePhone(value);
          if (!phoneValidation.isValid) fieldErrors.push(...phoneValidation.errors);
        }
        break;
      case 'confirmPassword': {
        const confirmValidation = AuthValidation.validateConfirmPassword(formState.password, value);
        if (!confirmValidation.isValid) fieldErrors.push(...confirmValidation.errors);
        break;
      }
      case 'acceptTerms':
        if (!value) fieldErrors.push('You must accept the terms and conditions');
        break;
    }
    
    return fieldErrors;
  };
  
  // Handle field changes
  const handleFieldChange = (fieldName: keyof RegistrationFormState, value: any) => {
    setFormState(prev => ({ ...prev, [fieldName]: value }));
    
    if (touched[fieldName]) {
      const fieldErrors = validateField(fieldName, value);
      setErrors(prev => ({ ...prev, [fieldName]: fieldErrors }));
    }
  };
  
  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    const fieldErrors = validateField(fieldName, (formState as any)[fieldName]);
    setErrors(prev => ({ ...prev, [fieldName]: fieldErrors }));
  };
  
  // Validate current step
  const validateCurrentStep = (): boolean => {
    const stepErrors: Record<string, string[]> = {};
    let isValid = true;
    
    switch (currentStep) {
      case 'personal_info': {
        ['firstName', 'lastName', 'email', 'phone'].forEach(field => {
          const fieldErrors = validateField(field, (formState as any)[field]);
          if (fieldErrors.length > 0) {
            stepErrors[field] = fieldErrors;
            isValid = false;
          }
        });
        if (role === 'principal' && !formState.jobTitle) {
          stepErrors.jobTitle = ['Job title is required'];
          isValid = false;
        }
        break;
      }
      case 'organization_setup':
        if (!formState.organization) isValid = false;
        break;
      case 'organization_selection':
        if (!formState.selectedOrganizationId) {
          stepErrors.selectedOrganizationId = ['Select your child\'s school to continue'];
          isValid = false;
        }
        break;
      case 'security_setup': {
        if (!passwordValidation?.isValid) {
          stepErrors.password = passwordValidation?.errors || ['Invalid password'];
          isValid = false;
        }
        const confirmErrors = validateField('confirmPassword', formState.confirmPassword);
        if (confirmErrors.length > 0) {
          stepErrors.confirmPassword = confirmErrors;
          isValid = false;
        }
        if (!formState.acceptTerms) {
          stepErrors.acceptTerms = ['You must accept the terms and conditions'];
          isValid = false;
        }
        break;
      }
    }
    
    setErrors(stepErrors);
    Object.keys(stepErrors).forEach(field => {
      setTouched(prev => ({ ...prev, [field]: true }));
    });
    
    return isValid;
  };
  
  // Child registration helpers
  const addChild = (child: ChildRegistrationData) => {
    setFormState(prev => ({
      ...prev,
      registrationChildren: [...prev.registrationChildren, child],
    }));
  };

  const removeChild = (index: number) => {
    setFormState(prev => ({
      ...prev,
      registrationChildren: prev.registrationChildren.filter((_, i) => i !== index),
    }));
  };

  const updateChild = (index: number, child: ChildRegistrationData) => {
    setFormState(prev => ({
      ...prev,
      registrationChildren: prev.registrationChildren.map((c, i) => (i === index ? child : c)),
    }));
  };

  // Navigation
  const handleNextStep = async () => {
    if (currentStep !== 'child_registration' && !validateCurrentStep()) {
      Alert.alert('Validation Error', 'Please correct the errors before continuing.', [{ text: 'OK' }]);
      return;
    }
    
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    
    if (isLastStep) {
      await handleSubmit();
    } else {
      setCurrentStep(availableSteps[currentStepIndex + 1]);
    }
  };

  const handleSkipChildRegistration = async () => {
    if (!completedSteps.includes('child_registration')) {
      setCompletedSteps(prev => [...prev, 'child_registration']);
    }
    setFormState(prev => ({ ...prev, registrationChildren: [] }));
    await handleSubmit();
  };
  
  const handlePreviousStep = () => {
    if (!isFirstStep) {
      setCurrentStep(availableSteps[currentStepIndex - 1]);
    }
  };
  
  const handleStepChange = (step: AuthFlowStep) => {
    const stepIndex = availableSteps.indexOf(step);
    if (stepIndex >= 0 && completedSteps.includes(step)) {
      setCurrentStep(step);
    }
  };
  
  // Submit registration
  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const baseRegistration = {
        email: formState.email,
        password: formState.password,
        confirmPassword: formState.confirmPassword,
        firstName: formState.firstName,
        lastName: formState.lastName,
        phone: formState.phone,
        acceptTerms: formState.acceptTerms,
        marketingConsent: formState.marketingConsent
      };
      
      let registration: EnhancedRegistration;
      
      switch (role) {
        case 'principal':
          registration = {
            ...baseRegistration,
            role: 'principal',
            organization: {
              name: formState.organization!.name,
              type: formState.organization!.type,
              address: formState.organization!.address,
              phone: formState.organization!.phone
            },
            jobTitle: formState.jobTitle || 'Principal',
            yearsExperience: formState.yearsExperience
          } as PrincipalRegistration;
          break;
        case 'teacher':
          registration = {
            ...baseRegistration,
            role: 'teacher',
            organizationId,
            invitationToken,
            subjects: formState.subjects || [],
            gradeLevel: formState.gradeLevel || [],
            qualifications: formState.qualifications,
            bio: formState.bio
          } as TeacherRegistration;
          break;
        case 'parent': {
          const legacyChildren = (formState.children || []).map(c => ({
            firstName: c.firstName,
            lastName: c.lastName,
            grade: c.grade,
            studentId: c.studentId,
          }));
          const newChildren = formState.registrationChildren.map(c => ({
            firstName: c.firstName,
            lastName: c.lastName,
            grade: c.grade,
          }));
          registration = {
            ...baseRegistration,
            role: 'parent',
            invitationToken: invitationToken || formState.invitationCode,
            children: [...legacyChildren, ...newChildren],
            emergencyContact: formState.emergencyContact,
            organizationId: formState.selectedOrganizationId || COMMUNITY_SCHOOL_ID
          } as ParentRegistration;
        }
          break;
        case 'student':
        default:
          registration = {
            ...baseRegistration,
            role: 'student',
            grade: formState.grade,
            dateOfBirth: formState.dateOfBirth,
            parentEmail: formState.parentEmail,
            schoolCode: formState.schoolCode,
            interests: formState.interests
          } as StudentRegistration;
          break;
      }
      
      onSuccess(registration);
    } catch (error) {
      console.error('Registration submission error:', error);
      onError?.(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };
  
  return {
    // State
    formState,
    errors,
    touched,
    loading,
    passwordValidation,
    showPassword,
    showConfirmPassword,
    currentStep,
    completedSteps,
    availableSteps,
    isFirstStep,
    isLastStep,
    userInfo,
    organizations,
    loadingOrganizations,
    organizationError,
    
    // Setters
    setFormState,
    setPasswordValidation,
    setShowPassword,
    setShowConfirmPassword,
    
    // Handlers
    handleFieldChange,
    handleFieldBlur,
    handleNextStep,
    handlePreviousStep,
    handleStepChange,
    handleSkipChildRegistration,
    addChild,
    removeChild,
    updateChild,
  };
}
