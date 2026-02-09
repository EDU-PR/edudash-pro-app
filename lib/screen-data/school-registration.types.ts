// Types and constants for school-registration screen

export interface RegistrationData {
  schoolName: string;
  schoolType: 'preschool' | 'k12_school' | 'hybrid';
  gradelevels: string[];
  contactEmail: string;
  contactPhone: string;
  physicalAddress: string;
  principalName: string;
  principalEmail: string;
  selectedPlanId?: string;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationData, string | string[]>>;

export const GRADE_LEVELS = {
  preschool: [
    { id: 'infants', label: 'Infants (6m-12m)', description: 'Infant care programs' },
    { id: 'toddlers', label: 'Toddlers (1-2 years)', description: 'Toddler development programs' },
    { id: 'pre_k', label: 'Pre-K (3-4 years)', description: 'Pre-kindergarten preparation' },
    { id: 'reception', label: 'Reception (4-5 years)', description: 'School readiness programs' },
  ],
  k12_school: [
    { id: 'foundation', label: 'Foundation Phase (Grade R-3)', description: 'Ages 5-9' },
    { id: 'intermediate', label: 'Intermediate Phase (Grade 4-6)', description: 'Ages 9-12' },
    { id: 'senior', label: 'Senior Phase (Grade 7-9)', description: 'Ages 12-15' },
    { id: 'fet', label: 'FET Phase (Grade 10-12)', description: 'Ages 15-18' },
  ],
  hybrid: [
    { id: 'infants', label: 'Infants (6m-12m)', description: 'Infant care programs' },
    { id: 'toddlers', label: 'Toddlers (1-2 years)', description: 'Toddler development programs' },
    { id: 'pre_k', label: 'Pre-K (3-4 years)', description: 'Pre-kindergarten preparation' },
    { id: 'foundation', label: 'Foundation Phase (Grade R-3)', description: 'Ages 5-9' },
    { id: 'intermediate', label: 'Intermediate Phase (Grade 4-6)', description: 'Ages 9-12' },
    { id: 'senior', label: 'Senior Phase (Grade 7-9)', description: 'Ages 12-15' },
    { id: 'fet', label: 'FET Phase (Grade 10-12)', description: 'Ages 15-18' },
  ],
};

/**
 * Map error code/message to user-friendly error message
 */
export function getRegistrationErrorMessage(error: any): string {
  const errorCode = error.code;
  const errorMessage = error.message || 'Failed to register school. Please try again.';
  const errorDetails = error.details;
  const errorHint = error.hint;

  if (errorCode === '23505' || errorMessage?.includes('duplicate') || errorMessage?.includes('already exists')) {
    return 'A school with this name or email already exists. Please use a different name or contact support if you believe this is an error.';
  }
  if (errorCode === '42501' || errorMessage?.includes('permission denied') || errorMessage?.includes('row-level security')) {
    return 'Permission denied. Please ensure you are logged in and have the necessary permissions to register a school.';
  }
  if (errorCode === '23503' || errorMessage?.includes('foreign key')) {
    return 'Invalid data provided. Please check your information and try again.';
  }
  if (errorCode === 'PGRST116' || (errorMessage?.includes('relation') && errorMessage?.includes('does not exist'))) {
    return 'System error: Registration service is unavailable. Please contact support.';
  }
  if (errorDetails) {
    return `${errorMessage}\n\nDetails: ${errorDetails}`;
  }
  if (errorHint) {
    return `${errorMessage}\n\nHint: ${errorHint}`;
  }
  return errorMessage;
}
