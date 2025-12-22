/**
 * Student Detail Types
 * Shared interfaces for student detail components
 */

export interface StudentDetail {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  age_months: number;
  age_years: number;
  status: string;
  enrollment_date: string;
  preschool_id: string;
  class_id: string | null;
  parent_id: string | null;
  guardian_id: string | null;
  medical_conditions?: string;
  allergies?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  profile_photo?: string;
  // Related data
  class_name?: string;
  teacher_name?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  age_group_name?: string;
  // Calculated fields
  attendance_rate?: number;
  last_attendance?: string;
  outstanding_fees?: number;
  payment_status?: 'current' | 'overdue' | 'pending';
}

export interface Class {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string | null;
  teacher_name?: string;
  capacity: number;
  current_enrollment: number;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
}

// Helper functions
export const formatAge = (ageMonths: number, ageYears: number): string => {
  if (ageYears < 2) {
    return `${ageMonths} months`;
  } else {
    const remainingMonths = ageMonths % 12;
    return remainingMonths > 0 
      ? `${ageYears}y ${remainingMonths}m`
      : `${ageYears} years`;
  }
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
};

export const calculateAge = (dateOfBirth: string): { months: number; years: number } => {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + 
                     (today.getMonth() - birth.getMonth());
  const years = Math.floor(totalMonths / 12);
  return { months: totalMonths, years };
};
