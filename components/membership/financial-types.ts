/**
 * Financial Types
 * Type definitions for organization financial operations
 */

import type { OrganizationWingCode, OrganizationMember } from './types';

// ============================================================================
// Financial Types
// ============================================================================

export type BankAccountType = 
  | 'main_operating' | 'membership_fees' | 'programmes' 
  | 'regional_float' | 'youth_wing' | 'women_league' | 'veterans_league' | 'petty_cash';

export type TransactionType = 
  | 'income' | 'expense' | 'transfer_in' | 'transfer_out' 
  | 'allocation' | 'refund' | 'adjustment' | 'membership_fee';

export type TransactionStatus = 
  | 'draft' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'paid' | 'cancelled' | 'reconciled';

export type PaymentMethod = 
  | 'eft' | 'cash' | 'cheque' | 'card' | 'mobile_money' | 'payfast' | 'other';

export type FeeType = 
  | 'registration' | 'annual' | 'monthly' | 'programme' | 'event' | 'id_card' | 'replacement_card';

export type MemberFeeStatus = 
  | 'pending' | 'partial' | 'paid' | 'overdue' | 'waived' | 'cancelled' | 'refunded';

// ============================================================================
// Bank Account
// ============================================================================

export interface OrganizationBankAccount {
  id: string;
  organization_id: string;
  account_name: string;
  account_type: BankAccountType;
  bank_name: string;
  account_number_masked?: string;
  branch_code?: string;
  swift_code?: string;
  region_id?: string;
  wing_id?: string;
  spending_limit_per_transaction?: number;
  spending_limit_daily?: number;
  spending_limit_monthly?: number;
  float_amount?: number;
  current_balance: number;
  signatories: string[]; // array of member IDs
  required_signatures: number;
  is_active: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Transactions
// ============================================================================

export interface OrganizationTransaction {
  id: string;
  organization_id: string;
  account_id?: string;
  region_id?: string;
  wing_id?: string;
  transaction_type: TransactionType;
  category: string;
  subcategory?: string;
  amount: number;
  currency: string;
  vat_amount: number;
  description: string;
  reference_number?: string;
  external_reference?: string;
  invoice_number?: string;
  member_id?: string;
  receipt_url?: string;
  invoice_url?: string;
  attachments: string[];
  status: TransactionStatus;
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  payment_method?: PaymentMethod;
  payment_date?: string;
  payee_name?: string;
  payee_account?: string;
  reconciled: boolean;
  reconciled_by?: string;
  reconciled_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Budgets
// ============================================================================

export interface OrganizationBudget {
  id: string;
  organization_id: string;
  fiscal_year: number;
  period_type: 'monthly' | 'quarterly' | 'annual';
  period_start: string;
  period_end: string;
  region_id?: string;
  wing_id?: string;
  department?: string;
  category: string;
  budgeted_amount: number;
  allocated_amount: number;
  spent_amount: number;
  committed_amount: number;
  remaining_amount: number; // computed
  utilization_percent: number; // computed
  notes?: string;
  status: 'draft' | 'proposed' | 'approved' | 'active' | 'frozen' | 'closed';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Membership Fees
// ============================================================================

export interface MembershipFeeStructure {
  id: string;
  organization_id: string;
  fee_name: string;
  fee_code: string;
  fee_type: FeeType;
  description?: string;
  member_types: string[];
  wings: OrganizationWingCode[];
  membership_tiers: string[];
  regions?: string[];
  amount: number;
  currency: string;
  includes_vat: boolean;
  vat_percent: number;
  valid_from: string;
  valid_to?: string;
  early_bird_discount_percent: number;
  early_bird_deadline_days: number;
  pensioner_discount_percent: number;
  student_discount_percent: number;
  allow_installments: boolean;
  installment_count: number;
  is_active: boolean;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberFee {
  id: string;
  organization_id: string;
  member_id: string;
  fee_structure_id?: string;
  fee_type: string;
  fee_name: string;
  description?: string;
  period_start?: string;
  period_end?: string;
  due_date: string;
  original_amount: number;
  discount_amount: number;
  discount_reason?: string;
  final_amount: number;
  paid_amount: number;
  balance_due: number; // computed
  status: MemberFeeStatus;
  last_payment_date?: string;
  last_payment_amount?: number;
  payment_count: number;
  reminder_sent_count: number;
  last_reminder_sent_at?: string;
  transaction_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  member?: OrganizationMember;
  fee_structure?: MembershipFeeStructure;
}
