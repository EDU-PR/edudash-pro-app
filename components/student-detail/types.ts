/**
 * Student Detail Types
 * Shared interfaces for student detail components
 */

export interface StudentFee {
  id: string;
  fee_structure_id: string;
  fee_name: string;
  amount: number;
  final_amount: number;
  amount_paid: number;
  amount_outstanding: number;
  status: 'pending' | 'paid' | 'overdue' | 'waived' | 'partial';
  billing_month: string;
  due_date: string;
  category_code: string;
}

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
  gender?: string | null;
  grade?: string | null;
  grade_level?: string | null;
  academic_year?: string | null;
  student_id?: string | null;
  id_number?: string | null;
  home_address?: string | null;
  home_phone?: string | null;
  notes?: string | null;
  payment_verified?: boolean | null;
  payment_date?: string | null;
  registration_fee_amount?: number | null;
  registration_fee_paid?: boolean | null;
  medical_conditions?: string | null;
  allergies?: string | null;
  medication?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  profile_photo?: string;
  // Related data
  class_name?: string;
  teacher_name?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  age_group_name?: string;
  // Fee tier info
  fee_tier_name?: string;
  monthly_fee_amount?: number;
  fee_structure_id?: string;
  // Monthly fee breakdown
  student_fees?: StudentFee[];
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

export const calculateAge = (dateOfBirth?: string | null): { months: number; years: number } => {
  if (!dateOfBirth) {
    return { months: 0, years: 0 };
  }

  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) {
    return { months: 0, years: 0 };
  }
  const today = new Date();
  const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + 
                     (today.getMonth() - birth.getMonth());
  const years = Math.floor(totalMonths / 12);
  return { months: totalMonths, years };
};
