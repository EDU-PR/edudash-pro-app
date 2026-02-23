/**
 * Types for the Student Fee Management screen.
 * Shared across hooks and component files.
 */

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  is_active?: boolean | null;
  status?: 'active' | 'inactive' | 'pending' | string | null;
  deleted_at?: string | null;
  permanent_delete_after?: string | null;
  registration_fee_amount?: number | null;
  registration_fee_paid?: boolean | null;
  payment_verified?: boolean | null;
  payment_date?: string | null;
  class_name?: string;
  parent_name?: string;
  parent_id?: string | null;
  preschool_id?: string | null;
  enrollment_date?: string | null;
  date_of_birth?: string | null;
}

export interface StudentFee {
  id: string;
  student_id: string;
  fee_structure_id?: string | null;
  billing_month?: string | null;
  amount: number;
  final_amount: number;
  discount_amount?: number;
  amount_paid?: number;
  amount_outstanding?: number;
  category_code?: string;
  status: 'pending' | 'paid' | 'overdue' | 'waived' | 'partially_paid';
  due_date: string;
  fee_type: string;
  description?: string;
  // Backward-compatible aliases (derived from discount_amount in current schema).
  waived_amount?: number;
  waived_reason?: string;
  waived_at?: string;
  waived_by?: string;
  paid_date?: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
}

export interface FeeStructureRow {
  id: string;
  amount: number;
  fee_type: string | null;
  name: string | null;
  description: string | null;
  grade_levels: string[] | null;
  effective_from: string | null;
  created_at: string | null;
}

export interface SchoolFeeStructureRow {
  id: string;
  amount_cents: number;
  fee_category?: string | null;
  name?: string | null;
  description?: string | null;
  age_group?: string | null;
  grade_level?: string | null;
  billing_frequency?: string | null;
  created_at?: string | null;
}

export interface ParentProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export type ModalType = 'waive' | 'adjust' | 'change_class' | null;

export interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>;
}

/**
 * Check whether a fee represents a registration / admission / enrollment fee.
 */
export const isRegistrationFeeEntry = (
  feeType?: string | null,
  name?: string | null,
  description?: string | null,
): boolean => {
  const text = `${feeType ?? ''} ${name ?? ''} ${description ?? ''}`.toLowerCase();
  return (
    text.includes('registration') ||
    text.includes('admission') ||
    text.includes('enrol') ||
    text.includes('enroll')
  );
};
