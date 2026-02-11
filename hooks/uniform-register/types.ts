import type { AlertButton } from '@/components/ui/AlertModal';

export interface UniformEntry {
  id: string;
  student_id: string;
  student_name: string;
  parent_id: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  uniform_items: UniformItem[];
  total_amount: number;
  amount_paid: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  payment_date: string | null;
  payment_verified: boolean;
  proof_of_payment_url: string | null;
  filled_out: boolean;
  filled_out_at: string | null;
  notes: string | null;
  preschool_id: string;
}

export interface UniformItem {
  name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface UniformRegisterSummary {
  total_students: number;
  forms_filled: number;
  forms_pending: number;
  total_paid: number;
  total_partial: number;
  total_unpaid: number;
  total_revenue: number;
  total_outstanding: number;
}

export interface UniformRegisterFilter {
  status: 'all' | 'paid' | 'partial' | 'unpaid';
  filledOut: 'all' | 'yes' | 'no';
  searchQuery: string;
}

export type ShowAlert = (
  title: string,
  message: string,
  type?: 'info' | 'warning' | 'success' | 'error',
  buttons?: AlertButton[],
) => void;
