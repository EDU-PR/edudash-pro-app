/** Types, constants, and helpers for useAftercareRegistration */
export const COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
export const EARLY_BIRD_LIMIT = 20;
export const REGISTRATION_FEE_ORIGINAL = 400.0;
export const REGISTRATION_FEE_DISCOUNTED = 200.0;
export type Grade = 'R' | '1' | '2' | '3' | '4' | '5' | '6' | '7';
export const GRADES: Grade[] = ['R', '1', '2', '3', '4', '5', '6', '7'];
export type ShowAlert = (cfg: {
  title: string;
  message: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}) => void;
export const formatDate = (date: Date): string => date.toISOString().split('T')[0];
export const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('27')) {
    const rest = digits.slice(2);
    return rest.length >= 9
      ? `+27 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 9)}`
      : `+27 ${rest}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+27 ${digits.slice(1, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }
  return phone;
};
export const generatePaymentReference = (childFirst: string, childLast: string, phone: string) => {
  const childPart = (childFirst.substring(0, 3) + childLast.substring(0, 3)).toUpperCase();
  return `AC-${childPart}-${phone.slice(-4)}`;
};
export interface AftercareFields {
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childLastName: string;
  childDateOfBirth: Date | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  acceptTerms: boolean;
  profileId?: string;
}
export function validateAftercareFields(fields: AftercareFields): Record<string, string> {
  const e: Record<string, string> = {};
  if (!fields.parentFirstName.trim()) e.parentFirstName = 'First name is required';
  if (!fields.parentLastName.trim()) e.parentLastName = 'Last name is required';
  if (!fields.parentEmail.trim()) e.parentEmail = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.parentEmail)) e.parentEmail = 'Invalid email format';
  if (!fields.parentPhone.trim()) e.parentPhone = 'Phone number is required';
  if (!fields.childFirstName.trim()) e.childFirstName = 'Child first name is required';
  if (!fields.childLastName.trim()) e.childLastName = 'Child last name is required';
  if (!fields.childDateOfBirth) e.childDateOfBirth = 'Date of birth is required';
  if (!fields.emergencyContactName.trim()) e.emergencyContactName = 'Emergency contact name is required';
  if (!fields.emergencyContactPhone.trim()) e.emergencyContactPhone = 'Emergency contact phone is required';
  if (!fields.emergencyContactRelation.trim()) e.emergencyContactRelation = 'Emergency contact relation is required';
  if (!fields.acceptTerms) e.acceptTerms = 'You must accept the terms and conditions';
  if (fields.parentPhone && !/^\+?[0-9]{10,13}$/.test(fields.parentPhone.replace(/\s/g, ''))) e.parentPhone = 'Invalid phone number format';
  if (fields.emergencyContactPhone && !/^\+?[0-9]{10,13}$/.test(fields.emergencyContactPhone.replace(/\s/g, ''))) e.emergencyContactPhone = 'Invalid phone number format';
  return e;
}
