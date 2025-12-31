// Payment-related types for parent payments screen

export interface PaymentChild {
  id: string;
  first_name: string;
  last_name: string;
  preschool_id: string;
  preschool_name?: string;
  student_code: string; // Unique payment reference (e.g., YE-2026-0001)
  registration_fee_amount?: number;
  registration_fee_paid?: boolean;
  payment_verified?: boolean;
}

export interface StudentFee {
  id: string;
  student_id: string;
  fee_type: string;
  description: string;
  amount: number;
  due_date: string;
  grace_period_days?: number;
  paid_date?: string;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'waived';
  payment_method?: string;
}

export interface FeeStructure {
  id: string;
  fee_type: string;
  amount: number;
  description: string;
  payment_frequency?: string;
  age_group?: string;
}

export interface PaymentMethod {
  id: string;
  method_name: string;
  display_name: string;
  processing_fee: number;
  fee_type: string;
  description?: string;
  instructions?: string;
  bank_name?: string;
  account_number?: string;
  branch_code?: string;
  preferred: boolean;
}

export interface POPUpload {
  id: string;
  student_id: string;
  upload_type: string;
  title: string;
  description?: string;
  file_path: string;
  file_name: string;
  status: 'pending' | 'approved' | 'rejected';
  payment_amount?: number;
  payment_reference?: string;
  created_at: string;
}

export interface SelectedFile {
  uri: string;
  name: string;
  size?: number;
  type?: string;
}

export type PaymentTabType = 'upcoming' | 'history' | 'upload';

export interface FeeStatusInfo {
  color: string;
  bgColor: string;
  label: string;
}

export interface SchoolBankDetails {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string; // Full number for display to parents
  branch_code?: string;
  swift_code?: string;
  account_type?: string;
}
